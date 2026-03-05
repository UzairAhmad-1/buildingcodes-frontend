// src/components/DatalabDocumentViewer.tsx
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  datalabService,
  getSectionTitle,
  getReferenceCode,
  extractTextFromHtml,
} from "@/services/datalabService";
import {
  DatalabContentBlock,
  DocumentNavigation,
  NavigationNode,
} from "@/types/datalab";
import AnimatedPopup from "./AnimatedPopup";

// Declare MathJax global type
declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
      typesetClear?: (elements?: HTMLElement[]) => void;
      startup?: {
        promise?: Promise<void>;
      };
    };
  }
}

/**
 * Decode HTML entities in a string
 */
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

/**
 * Convert <math> tags to MathJax delimiters
 * Similar to convert_math_tags in json_to_html.py
 */
function convertMathTags(htmlContent: string): string {
  // Convert display math: <math display="block">...</math> to \[...\]
  htmlContent = htmlContent.replace(
    /<math\s+display="block">(.*?)<\/math>/gs,
    (match, mathContent) => {
      const decoded = decodeHtmlEntities(mathContent);
      return `\\[${decoded}\\]`;
    },
  );

  // Convert inline math: <math display="inline">...</math> to \(...\)
  htmlContent = htmlContent.replace(
    /<math\s+display="inline">(.*?)<\/math>/gs,
    (match, mathContent) => {
      const decoded = decodeHtmlEntities(mathContent);
      return `\\(${decoded}\\)`;
    },
  );

  // Convert inline math: <math>...</math> to \(...\)
  htmlContent = htmlContent.replace(
    /<math>(.*?)<\/math>/gs,
    (match, mathContent) => {
      const decoded = decodeHtmlEntities(mathContent);
      return `\\(${decoded}\\)`;
    },
  );

  return htmlContent;
}

interface DatalabDocumentViewerProps {
  documentId: string;
}

const DatalabDocumentViewer: React.FC<DatalabDocumentViewerProps> = ({
  documentId,
}) => {
  const [contentBlocks, setContentBlocks] = useState<DatalabContentBlock[]>([]);
  const [navigation, setNavigation] = useState<DocumentNavigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState({
    loaded: 0,
    total: 0,
  });
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [previewBlock, setPreviewBlock] = useState<DatalabContentBlock | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [definitionBlock, setDefinitionBlock] = useState<DatalabContentBlock | null>(null);
  const [definitionTerm, setDefinitionTerm] = useState<string>("");
  const [showDefinition, setShowDefinition] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Load document content
  useEffect(() => {
    const abortController = new AbortController();

    const loadDocument = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load navigation
        const navData = await datalabService.getDocumentNavigation(
          documentId,
          abortController.signal,
        );
        setNavigation(navData);

        // Expand all top-level nodes by default
        const topLevelIds = new Set(
          navData.navigation_tree.map((node: NavigationNode) => node.id)
        );
        setExpandedNodes(topLevelIds);

        // Load all content with progress
        const blocks = await datalabService.getAllContent(
          documentId,
          (loaded, total) => {
            setLoadingProgress({ loaded, total });
          },
          abortController.signal,
        );
        setContentBlocks(blocks);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load document");
        }
      } finally {
        setLoading(false);
      }
    };

    loadDocument();

    return () => {
      abortController.abort();
    };
  }, [documentId]);

  // Add CSS for block highlighting and images
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .datalab-content img {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 10px 0;
      }
      .datalab-block {
        margin-bottom: 2px;
        padding: 1px;
        background: white;
        border-radius: 4px;
        transition: background 0.3s;
      }
      .datalab-block.selected {
        background: #fffde7;
      }
      .nav-expand-btn:hover {
        background: rgba(0, 0, 0, 0.05);
        border-radius: 4px;
      }
      .nav-item-btn:hover {
        background: rgba(0, 0, 0, 0.03);
      }
      a[href^="#block-"] {
        color: #1976d2;
        text-decoration: underline;
        cursor: pointer;
      }
      a[href^="#block-"]:hover {
        color: #1565c0;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Trigger MathJax typesetting when content changes or section selected
  useEffect(() => {
    if (!loading && contentBlocks.length > 0 && contentRef.current) {
      // Wait for MathJax to be ready
      if (window.MathJax?.typesetPromise) {
        // Small delay to ensure DOM is updated
        setTimeout(() => {
          if (contentRef.current) {
            window.MathJax?.typesetPromise?.([contentRef.current]).catch(
              (err: any) => {
                console.error("MathJax typesetting failed:", err);
              },
            );
          }
        }, 50);
      }
    }
  }, [contentBlocks, loading, selectedSection]);

  // Trigger MathJax typesetting for preview popup
  useEffect(() => {
    if (showPreview && previewRef.current) {
      if (window.MathJax?.typesetPromise) {
        setTimeout(() => {
          if (previewRef.current) {
            window.MathJax?.typesetPromise?.([previewRef.current]).catch(
              (err: any) => {
                console.error("MathJax preview typesetting failed:", err);
              },
            );
          }
        }, 50);
      }
    }
  }, [showPreview, previewBlock]);

  // Intercept clicks on internal links
  useEffect(() => {
    const handleLinkClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if clicked element is a link or inside a link
      const link = target.closest("a");
      if (link && link.hash) {
        // Handle section reference links (#block-123)
        if (link.hash.startsWith("#block-")) {
          event.preventDefault();
          const blockId = parseInt(link.hash.replace("#block-", ""));
          // Find the block in contentBlocks
          const block = contentBlocks.find((b) => b.id === blockId);
          if (block) {
            setPreviewBlock(block);
            setShowPreview(true);
          }
        }
        // Handle definition links (# followed by datalab block ID)
        else if (link.hash.startsWith("#") && link.hash.length > 1) {
          event.preventDefault();
          const blockId = link.hash.substring(1); // Remove the '#'

          console.log("[DEFINITION DEBUG] Clicked link with blockId:", blockId);

          // Get the term text from the link
          const termText = link.textContent || "";
          setDefinitionTerm(termText);
          console.log("[DEFINITION DEBUG] Term:", termText);

          // Log first few blocks to see what block_ids look like
          console.log("[DEFINITION DEBUG] Sample block_ids from loaded content:",
            contentBlocks.slice(0, 5).map(b => ({ id: b.id, block_id: b.block_id }))
          );

          // Try to find block in loaded content first (hybrid approach)
          const foundBlock = contentBlocks.find((b) => b.block_id === blockId);

          if (foundBlock) {
            console.log("[DEFINITION DEBUG] Found block in loaded content:", foundBlock.id);
            setDefinitionBlock(foundBlock);
            setShowDefinition(true);
          } else {
            console.log("[DEFINITION DEBUG] Block not found in loaded content, fetching from API...");
            // Fetch from API if not found in loaded content
            try {
              const block = await datalabService.getBlockById(
                documentId,
                blockId
              );
              if (block) {
                console.log("[DEFINITION DEBUG] Fetched block from API:", block);
                setDefinitionBlock(block);
                setShowDefinition(true);
              } else {
                console.warn("[DEFINITION DEBUG] Block not found via API");
              }
            } catch (err) {
              console.error("[DEFINITION DEBUG] Failed to fetch definition block:", err);
            }
          }
        }
      }
    };

    const contentElement = contentRef.current;
    if (contentElement) {
      contentElement.addEventListener("click", handleLinkClick);
    }

    return () => {
      if (contentElement) {
        contentElement.removeEventListener("click", handleLinkClick);
      }
    };
  }, [contentBlocks, documentId]);

  // Search within document
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await datalabService.searchDocument(
        documentId,
        searchQuery,
      );
      setSearchResults(results.results);
    } catch (err: any) {
      console.error("Search failed:", err);
    }
  }, [documentId, searchQuery]);

  // Scroll to content block
  const scrollToBlock = useCallback((blockId: number) => {
    const element = document.getElementById(`block-${blockId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setSelectedSection(blockId);
    }
  }, []);

  // Toggle node expansion
  const toggleNodeExpansion = useCallback((nodeId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  // Close preview popup
  const closePreview = useCallback(() => {
    setShowPreview(false);
    setPreviewBlock(null);
  }, []);

  // Navigate to block and close preview
  const proceedToBlock = useCallback(() => {
    if (previewBlock) {
      scrollToBlock(previewBlock.id);
      closePreview();
    }
  }, [previewBlock, scrollToBlock, closePreview]);

  // Render navigation tree
  const renderNavigationNode = (node: NavigationNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);

    return (
      <div key={node.id} style={{ marginLeft: `${depth * 16}px` }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: selectedSection === node.id ? "#e3f2fd" : "transparent",
            borderRadius: "4px",
          }}
        >
          {/* Expand/Collapse Icon */}
          {hasChildren && (
            <button
              onClick={(e) => toggleNodeExpansion(node.id, e)}
              className="nav-expand-btn"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "8px 4px",
                fontSize: "12px",
                color: "#666",
                display: "flex",
                alignItems: "center",
                minWidth: "20px",
              }}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? "▼" : "▶"}
            </button>
          )}
          {/* Navigation Item */}
          <button
            onClick={() => scrollToBlock(node.id)}
            className="nav-item-btn"
            style={{
              flex: 1,
              display: "block",
              textAlign: "left",
              padding: "8px",
              paddingLeft: hasChildren ? "4px" : "28px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: depth === 0 ? "14px" : "13px",
              fontWeight: depth < 2 ? "600" : "400",
              borderRadius: "4px",
            }}
          >
            {node.reference_code && (
              <span style={{ marginRight: "8px" }}>{node.reference_code}</span>
            )}
            {node.title}
          </button>
        </div>
        {/* Children - only render if expanded */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderNavigationNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Memoize processed content blocks to prevent re-processing on every render
  const processedBlocks = useMemo(() => {
    return contentBlocks.map((block) => ({
      ...block,
      processedHtml: block.html_content
        ? convertMathTags(block.html_content)
        : "",
    }));
  }, [contentBlocks]);

  // Render content block
  const renderContentBlock = useCallback((block: DatalabContentBlock & { processedHtml: string }) => {
    return (
      <div
        key={block.id}
        id={`block-${block.id}`}
        className={`datalab-block ${selectedSection === block.id ? "selected" : ""}`}
      >
        {/* Section metadata */}
        {block.section_hierarchy && (
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "2px" }}>
            {/* {getReferenceCode(block.section_hierarchy) && (
              <span style={{ marginRight: "8px" }}>
                § {getReferenceCode(block.section_hierarchy)}
              </span>
            )} */}
          </div>
        )}

        {/* HTML content */}
        {block.processedHtml && (
          <div
            className="datalab-content"
            dangerouslySetInnerHTML={{ __html: block.processedHtml }}
          />
        )}
      </div>
    );
  }, [selectedSection]);

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <div>Loading document...</div>
        {loadingProgress.total > 0 && (
          <div style={{ marginTop: "10px", fontSize: "14px", color: "#666" }}>
            {loadingProgress.loaded} / {loadingProgress.total} blocks loaded
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return <div style={{ padding: "20px", color: "red" }}>Error: {error}</div>;
  }

  // Render preview modal
  const renderPreviewModal = () => {
    if (!showPreview || !previewBlock) return null;

    const processedHtml = previewBlock.html_content
      ? convertMathTags(previewBlock.html_content)
      : "";

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
        onClick={closePreview}
      >
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "8px",
            maxWidth: "800px",
            maxHeight: "80vh",
            width: "90%",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 20px",
              borderBottom: "1px solid #e0e0e0",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
              Section Preview
            </h3>
            <button
              onClick={closePreview}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "24px",
                cursor: "pointer",
                color: "#666",
                padding: "0",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "4px",
              }}
              aria-label="Close preview"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div
            ref={previewRef}
            style={{
              padding: "20px",
              overflowY: "auto",
              flex: 1,
            }}
          >
            <div
              className="datalab-content"
              dangerouslySetInnerHTML={{ __html: processedHtml }}
            />
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "16px 20px",
              borderTop: "1px solid #e0e0e0",
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
            }}
          >
            <button
              onClick={closePreview}
              style={{
                padding: "10px 20px",
                background: "#f5f5f5",
                border: "1px solid #ddd",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              Close
            </button>
            <button
              onClick={proceedToBlock}
              style={{
                padding: "10px 20px",
                background: "#1976d2",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              Proceed to this
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Navigation Sidebar */}
      <div
        style={{
          width: "300px",
          borderRight: "1px solid #ddd",
          overflowY: "auto",
          padding: "16px",
        }}
      >
        <h2 style={{ fontSize: "18px", marginBottom: "16px" }}>
          {navigation?.title || "Document"}
        </h2>

        {/* Search */}
        <div style={{ marginBottom: "16px" }}>
          <input
            type="text"
            placeholder="Search document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
            }}
          />
          <button
            onClick={handleSearch}
            style={{
              marginTop: "8px",
              padding: "8px 16px",
              background: "#1976d2",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              width: "100%",
            }}
          >
            Search
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ fontSize: "14px", marginBottom: "8px" }}>
              Search Results ({searchResults.length})
            </h3>
            {searchResults.map((result) => (
              <div
                key={result.content_id}
                onClick={() => scrollToBlock(result.content_id)}
                style={{
                  padding: "8px",
                  marginBottom: "8px",
                  background: "#f5f5f5",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                <div
                  dangerouslySetInnerHTML={{ __html: result.html_snippet }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Navigation Tree */}
        <div>
          <h3 style={{ fontSize: "14px", marginBottom: "8px" }}>Contents</h3>
          {navigation?.navigation_tree.map((node) =>
            renderNavigationNode(node),
          )}
        </div>
      </div>

      {/* Content Area */}
      <div
        ref={contentRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px",
        }}
      >
        {processedBlocks.map(renderContentBlock)}
      </div>

      {/* Preview Modal */}
      {renderPreviewModal()}

      {/* Definition Popup */}
      <AnimatedPopup
        isOpen={showDefinition}
        onClose={() => {
          setShowDefinition(false);
          setDefinitionBlock(null);
          setDefinitionTerm("");
        }}
        title={definitionTerm}
        copyText={
          definitionBlock?.html_content
            ? extractTextFromHtml(definitionBlock.html_content)
            : ""
        }
      >
        {definitionBlock?.html_content && (
          <div
            className="datalab-content"
            dangerouslySetInnerHTML={{
              __html: convertMathTags(definitionBlock.html_content),
            }}
          />
        )}
      </AnimatedPopup>
    </div>
  );
};

export default DatalabDocumentViewer;

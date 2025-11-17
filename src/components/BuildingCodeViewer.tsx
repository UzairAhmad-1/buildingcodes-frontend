// src/components/BuildingCodeViewer.tsx
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { ChevronRight, Search, X, ExternalLink } from "lucide-react";
import { HierarchyNode } from "@/types/buildingCode";
import { buildingCodeService } from "@/services/buildingCodeService";
import { useSearchParams } from "next/navigation";

interface Reference {
  id: number;
  reference_text: string;
  reference_type: string;
  target_content_id: number;
  target_reference_code: string;
  hyperlink_target: string;
  page_number: number;
  font_family: string;
  bbox: number[];
  reference_position: number;
  target_content?: any;
}

interface BuildingCodeViewerProps {
  documentId?: string;
  documentInfo?: {
    title: string;
    year: number;
    version?: string;
    jurisdiction_name: string;
  };
}

const BuildingCodeViewer: React.FC<BuildingCodeViewerProps> = ({
  documentId,
  documentInfo,
}) => {
  const [navigationData, setNavigationData] = useState<HierarchyNode[]>([]);
  const [currentContent, setCurrentContent] = useState<HierarchyNode[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [searchResults, setSearchResults] = useState<HierarchyNode[]>([]);
  const [hoveredItem, setHoveredItem] = useState<number | null>(null);
  const contentRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const [navigationExpandedItems, setNavigationExpandedItems] = useState<
    Set<number>
  >(new Set());
  const [contentExpandedItems, setContentExpandedItems] = useState<Set<number>>(
    new Set()
  );

  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const params = useSearchParams();
  const highlightParam = params.get("highlight");

  // Memoized values
  const isSearchMode = useMemo(() => {
    return searchTerm.trim().length > 0 && searchResults.length > 0;
  }, [searchTerm, searchResults]);

  // Main data fetching - only navigation
  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const fetchData = async () => {
      if (!documentId) return;

      try {
        setLoading(true);
        setError(null);

        console.log("Fetching navigation data...");
        const navigationResponse =
          await buildingCodeService.getDocumentNavigation(
            documentId,
            abortController.signal
          );

        if (!isMounted) return;

        console.log(
          "Navigation data received:",
          navigationResponse.navigation.length
        );
        setNavigationData(navigationResponse.navigation);

        // Auto-expand first level items in navigation
        const firstLevelIds = new Set<number>();
        navigationResponse.navigation.forEach((item) =>
          firstLevelIds.add(item.id)
        );
        setNavigationExpandedItems(firstLevelIds);

        // Load first division content automatically
        if (navigationResponse.navigation.length > 0) {
          const firstDivision = navigationResponse.navigation[0];
          console.log("Loading first division:", firstDivision.id);
          await loadContentForItem(firstDivision.id);
        }
      } catch (err) {
        if (!isMounted) return;
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Error fetching data:", err);
          setError("Failed to load building code data. Please try again.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      abortController.abort();
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [documentId]);

  // Load content for specific item
  const loadContentForItem = useCallback(
    async (contentId: number) => {
      if (!documentId) return;

      try {
        setContentLoading(true);
        console.log(`Loading content for item: ${contentId}`);

        const contentItem = await buildingCodeService.getContentItem(
          documentId,
          contentId
        );

        // Replace current content with the new item (as an array)
        setCurrentContent([contentItem]);
        setSelectedItem(contentId);

        // Auto-expand ALL items in the loaded content
        const allContentIds = new Set<number>();
        const collectAllIds = (nodes: HierarchyNode[]) => {
          nodes.forEach((node) => {
            allContentIds.add(node.id);
            if (node.children) {
              collectAllIds(node.children);
            }
          });
        };
        collectAllIds([contentItem]);
        setContentExpandedItems(allContentIds);
      } catch (error) {
        console.error("Error loading content:", error);
      } finally {
        setContentLoading(false);
      }
    },
    [documentId]
  );

  // Navigation click handler
  const handleNavigationClick = useCallback(
    (item: HierarchyNode) => {
      console.log("Navigation item clicked:", item.id);
      setSelectedItem(item.id);
      loadContentForItem(item.id);

      // Auto-expand the clicked item in navigation
      setNavigationExpandedItems((prev) => new Set(prev).add(item.id));
    },
    [loadContentForItem]
  );

  // Toggle navigation expansion
  const toggleNavigationExpand = useCallback(
    (id: number, event?: React.MouseEvent) => {
      if (event) event.stopPropagation();

      setNavigationExpandedItems((prev) => {
        const newExpanded = new Set(prev);
        if (newExpanded.has(id)) {
          newExpanded.delete(id);
        } else {
          newExpanded.add(id);
        }
        return newExpanded;
      });
    },
    []
  );

  // Toggle content expansion
  const toggleContentExpand = useCallback(
    (id: number, event?: React.MouseEvent) => {
      if (event) event.stopPropagation();

      setContentExpandedItems((prev) => {
        const newExpanded = new Set(prev);
        if (newExpanded.has(id)) {
          newExpanded.delete(id);
        } else {
          newExpanded.add(id);
        }
        return newExpanded;
      });
    },
    []
  );

  // Search functionality - calls backend API
  const handleSearch = useCallback(
    (term: string) => {
      setSearchTerm(term);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(async () => {
        if (!term.trim()) {
          setSearchResults([]);
          return;
        }

        try {
          console.log("Searching for:", term);
          const searchResponse = await buildingCodeService.searchContent(
            documentId!,
            term
          );
          setSearchResults(searchResponse.results);
        } catch (error) {
          console.error("Search error:", error);
          // Fallback to client-side search if API fails
          const results: HierarchyNode[] = [];
          const searchInNodes = (nodes: HierarchyNode[]) => {
            nodes.forEach((node) => {
              const matchesSearch =
                node.title?.toLowerCase().includes(term.toLowerCase()) ||
                node.content_text?.toLowerCase().includes(term.toLowerCase()) ||
                node.reference_code?.toLowerCase().includes(term.toLowerCase());

              if (matchesSearch) {
                results.push(node);
              }

              if (node.children) {
                searchInNodes(node.children);
              }
            });
          };

          searchInNodes(navigationData);
          setSearchResults(results);
        }
      }, 300);
    },
    [documentId, navigationData]
  );

  // Handle reference click
  const handleReferenceClick = useCallback(
    (reference: Reference) => {
      if (reference.target_content_id) {
        setSelectedItem(reference.target_content_id);
        loadContentForItem(reference.target_content_id);
      }
    },
    [loadContentForItem]
  );

  // Function to highlight references in text
  const highlightReferences = useCallback(
    (text: string, references: Reference[] = []) => {
      if (!text || !references || references.length === 0) {
        return <>{text}</>;
      }

      const sortedReferences = [...references].sort(
        (a, b) => a.reference_position - b.reference_position
      );

      let lastIndex = 0;
      const elements: JSX.Element[] = [];
      const textLower = text.toLowerCase();

      sortedReferences.forEach((ref, index) => {
        const refText = ref.reference_text;
        const refLower = refText.toLowerCase();

        const refIndex = textLower.indexOf(refLower, lastIndex);

        if (refIndex !== -1) {
          if (refIndex > lastIndex) {
            elements.push(
              <span key={`text-${index}`}>
                {text.substring(lastIndex, refIndex)}
              </span>
            );
          }

          elements.push(
            <span
              key={`ref-${index}`}
              className="text-purple-800 px-1 rounded cursor-pointer transition-colors border font-medium"
              title={`Click to view definition of ${refText}`}
              onClick={(e) => {
                e.stopPropagation();
                handleReferenceClick(ref);
              }}
            >
              {text.substring(refIndex, refIndex + refText.length)}
              <ExternalLink size={12} className="inline ml-1" />
            </span>
          );

          lastIndex = refIndex + refText.length;
        }
      });

      if (lastIndex < text.length) {
        elements.push(
          <span key="text-final">{text.substring(lastIndex)}</span>
        );
      }

      return <>{elements}</>;
    },
    [handleReferenceClick]
  );

  const highlightText = useCallback((text: string, highlight: string) => {
    if (!highlight || !text) return text;

    const parts = text.split(new RegExp(`(${highlight})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-yellow-300 px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  }, []);

  const getTypeStyles = (type: string) => {
    const styles: Record<string, { text: string }> = {
      division: { text: "text-3xl text-black font-normal" },
      part: { text: "text-2xl text-black font-normal" },
      section: { text: "text-xl text-black font-normal" },
      subsection: { text: "text-lg text-black font-normal" },
      article: { text: "text-lg text-black font-normal" },
      sentence: { text: "text-sm text-black font-normal" },
      clause: { text: "text-sm text-black font-normal" },
      subclause: { text: "text-sm text-black font-normal" },
    };

    return styles[type] || { text: "text-sm text-black font-normal" };
  };

  // Navigation item renderer - EXACTLY like your original but collapsed by default
  const renderNavigationItem = useCallback(
    (item: HierarchyNode, level: number = 0) => {
      const hasChildren = item.children && item.children.length > 0;
      const isExpanded = navigationExpandedItems.has(item.id);
      const isSelected = selectedItem === item.id;

      return (
        <div key={item.id}>
          <div
            className={`flex items-center px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors ${
              isSelected ? "bg-blue-100 border-l-4 border-blue-600" : ""
            }`}
            style={{ paddingLeft: `${level * 16 + 12}px` }}
            onClick={() => handleNavigationClick(item)}
          >
            {hasChildren && (
              <div
                className="flex-shrink-0 p-1 rounded hover:bg-gray-200 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNavigationExpand(item.id, e);
                }}
              >
                <ChevronRight
                  size={14}
                  className={`transition-transform ${
                    isExpanded ? "transform rotate-90" : ""
                  }`}
                />
              </div>
            )}
            {!hasChildren && <div className="w-6 mr-2"></div>}

            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">
                {item.reference_code && (
                  <span className="font-mono text-xs text-gray-500 mr-2">
                    {item.reference_code}
                  </span>
                )}
                <span
                  className={
                    level === 0
                      ? "font-semibold text-gray-900"
                      : "text-gray-700"
                  }
                >
                  {[
                    item.reference_code,
                    item.title,
                    item.content_text && item.content_text.substring(0, 80),
                  ]
                    .filter(Boolean)
                    .join(" – ")}
                </span>
              </div>
            </div>
          </div>

          {hasChildren && isExpanded && (
            <div>
              {item.children!.map((child) =>
                renderNavigationItem(child, level + 1)
              )}
            </div>
          )}
        </div>
      );
    },
    [
      navigationExpandedItems,
      selectedItem,
      handleNavigationClick,
      toggleNavigationExpand,
    ]
  );

  // Content item renderer - EXACTLY like your original (always expanded)
  const renderContentItem = useCallback(
    (item: HierarchyNode, level: number = 0) => {
      const hasChildren = item.children && item.children.length > 0;
      const isExpanded = contentExpandedItems.has(item.id);
      const isHighlighted = selectedItem === item.id;
      const isHovered = hoveredItem === item.id;
      const typeStyles = getTypeStyles(item.content_type);

      const showHighlight =
        isHighlighted &&
        ["division", "part", "section", "subsection", "article"].includes(
          item.content_type
        );

      if (item.content_type === "article") {
        return (
          <div key={item.id} className="mb-6">
            <div
              ref={(el) => {
                contentRefs.current[item.id] = el;
              }}
              className={`p-4 rounded-lg ${
                showHighlight
                  ? "bg-blue-50 border-blue-300 shadow-sm"
                  : isHovered
                  ? "bg-gray-200 border-gray-300 shadow-sm"
                  : "bg-white"
              }`}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={() => setSelectedItem(item.id)}
            >
              {(item.reference_code || item.title) && (
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {item.reference_code && (
                    <span className="px-2 py-1 rounded transition-colors">
                      {item.reference_code}
                    </span>
                  )}
                  {item.title && (
                    <h3 className={`${typeStyles.text}`}>
                      {searchTerm
                        ? highlightText(item.title, searchTerm)
                        : item.title}
                    </h3>
                  )}
                </div>
              )}

              {hasChildren && (
                <div className="space-y-3">
                  {item.children!.map((child) => renderArticleChild(child))}
                </div>
              )}
            </div>
          </div>
        );
      }

      return (
        <div key={item.id} className="mb-6">
          <div
            ref={(el) => {
              contentRefs.current[item.id] = el;
            }}
            className={`p-4 rounded-lg ${
              showHighlight
                ? "bg-blue-50 border-blue-300 shadow-sm"
                : isHovered
                ? "bg-gray-200 border-gray-300 shadow-sm"
                : "bg-white"
            }`}
            onMouseEnter={() => setHoveredItem(item.id)}
            onMouseLeave={() => setHoveredItem(null)}
            onClick={() => setSelectedItem(item.id)}
          >
            {(item.reference_code || item.title || item.content_text) && (
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {item.reference_code && (
                  <span className="px-2 py-1 rounded transition-colors">
                    {item.reference_code}
                  </span>
                )}
                {item.title && (
                  <h3 className={`${typeStyles.text}`}>
                    {searchTerm
                      ? highlightText(item.title, searchTerm)
                      : item.title}
                  </h3>
                )}
                {item.content_text && item.content_text !== item.title && (
                  <span className={`${typeStyles.text}`}>
                    {searchTerm
                      ? highlightText(item.content_text, searchTerm)
                      : highlightReferences(
                          item.content_text,
                          item.references || []
                        )}
                  </span>
                )}
              </div>
            )}
          </div>

          {hasChildren && item.content_type !== "article" && (
            <div className="ml-4">
              {item.children!.map((child) =>
                renderContentItem(child, level + 1)
              )}
            </div>
          )}
        </div>
      );
    },
    [
      contentExpandedItems,
      selectedItem,
      hoveredItem,
      searchTerm,
      highlightText,
      highlightReferences,
    ]
  );

  // Helper function to render children within an article
  const renderArticleChild = useCallback(
    (item: HierarchyNode, level: number = 0) => {
      const hasChildren = item.children && item.children.length > 0;
      const isHighlighted = selectedItem === item.id;
      const isHovered = hoveredItem === item.id;

      // Sentences get their own separate block with border
      if (item.content_type === "sentence") {
        return (
          <div
            key={item.id}
            ref={(el) => {
              contentRefs.current[item.id] = el;
            }}
            className={`p-3 rounded ${
              isHighlighted
                ? "bg-blue-50 border-blue-300 shadow-sm"
                : isHovered
                ? "bg-gray-200 border-gray-300"
                : "bg-white"
            }`}
            onMouseEnter={() => setHoveredItem(item.id)}
            onMouseLeave={() => setHoveredItem(null)}
            onClick={() => setSelectedItem(item.id)}
          >
            <div className="flex items-start gap-2">
              <div className="flex-1">
                {/* Sentence content with reference highlights */}
                {(item.reference_code || item.content_text) && (
                  <div className="text-gray-700 leading-relaxed">
                    <div className="flex flex-wrap items-start gap-2">
                      {/* Reference Code */}
                      {item.reference_code && (
                        <span>{item.reference_code}</span>
                      )}

                      {/* Sentence Text */}
                      {item.content_text && (
                        <span className="break-words flex-1">
                          {searchTerm
                            ? highlightText(item.content_text, searchTerm)
                            : highlightReferences(
                                item.content_text,
                                item.references || []
                              )}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Render all clauses and subclauses within this sentence block */}
                {hasChildren && (
                  <div className="mt-2 space-y-1">
                    {item.children!.map((child) => renderClauseContent(child))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }

      // Default case for non-sentence children
      return (
        <div
          key={item.id}
          ref={(el) => {
            contentRefs.current[item.id] = el;
          }}
          className="mb-2"
          onClick={() => setSelectedItem(item.id)}
        >
          {item.content_text && (
            <div className="text-gray-700 leading-relaxed">
              {searchTerm
                ? highlightText(item.content_text, searchTerm)
                : highlightReferences(item.content_text, item.references || [])}
            </div>
          )}
        </div>
      );
    },
    [selectedItem, hoveredItem, searchTerm, highlightText, highlightReferences]
  );

  // Helper function to render clauses and subclauses within a sentence
  const renderClauseContent = useCallback(
    (item: HierarchyNode, level: number = 0) => {
      const hasChildren = item.children && item.children.length > 0;
      const isHighlighted = selectedItem === item.id;
      const isHovered = hoveredItem === item.id;

      if (item.content_type === "clause") {
        return (
          <div
            key={item.id}
            ref={(el) => {
              contentRefs.current[item.id] = el;
            }}
            className={`ml-4 p-2 rounded ${
              isHighlighted
                ? "bg-blue-50"
                : isHovered
                ? "bg-gray-100 border border-black"
                : ""
            }`}
            onMouseEnter={() => setHoveredItem(item.id)}
            onMouseLeave={() => setHoveredItem(null)}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedItem(item.id);
            }}
          >
            {/* Reference code and title in one line */}
            <div className="flex items-start gap-1">
              <span className="font-medium text-black shrink-0">
                {item.reference_code}
              </span>
              <span className="text-black leading-relaxed">
                {item.title &&
                  (searchTerm
                    ? highlightText(item.title, searchTerm)
                    : highlightReferences(item.title, item.references || []))}
              </span>
            </div>

            {/* Render subclauses */}
            {hasChildren && (
              <div className="ml-4 mt-1 space-y-1">
                {item.children!.map((child) => renderClauseContent(child))}
              </div>
            )}
          </div>
        );
      }

      if (item.content_type === "subclause") {
        return (
          <div
            key={item.id}
            ref={(el) => {
              contentRefs.current[item.id] = el;
            }}
            className={`ml-4 p-1 rounded transition-colors ${
              isHighlighted
                ? "bg-blue-50"
                : isHovered
                ? "bg-gray-100 border border-black"
                : ""
            }`}
            onMouseEnter={() => setHoveredItem(item.id)}
            onMouseLeave={() => setHoveredItem(null)}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedItem(item.id);
            }}
          >
            {/* For subclauses, you might want similar treatment */}
            <div className="flex items-start gap-1">
              {item.reference_code && (
                <span className="font-medium text-gray-800 shrink-0">
                  {item.reference_code}
                </span>
              )}
              <span className="text-gray-700 leading-relaxed">
                {item.content_text &&
                  (searchTerm
                    ? highlightText(item.content_text, searchTerm)
                    : highlightReferences(
                        item.content_text,
                        item.references || []
                      ))}
              </span>
            </div>
          </div>
        );
      }

      return null;
    },
    [selectedItem, hoveredItem, searchTerm, highlightText, highlightReferences]
  );

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Loading Document
          </h2>
          <p className="text-gray-600">Loading building code data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center text-red-600 max-w-md">
          <p className="text-lg font-semibold mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header - EXACTLY like your original */}
      <header className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="max-w-[1800px] mx-auto px-8 py-2">
          <div className="flex items-center justify-between">
            {/* Left side - Document info */}
            <div className="flex items-center flex-1 min-w-0">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-gray-900 tracking-tight truncate">
                  {documentInfo?.title || "British Columbia Building Code 2024"}
                </h1>
              </div>
            </div>

            {/* Right side - Search bar */}
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <Search
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Search by title, content, or reference code..."
                  className="w-full pl-12 pr-12 py-3 border text-black border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white shadow-sm transition-all"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                />
                {searchTerm && (
                  <button
                    title="search"
                    onClick={() => {
                      setSearchTerm("");
                      setSearchResults([]);
                    }}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area - EXACTLY like your original */}
      <div
        className={`flex-1 flex overflow-hidden max-w-[1800px] mx-auto w-full px-6 py-2 gap-6`}
      >
        {/* Search Results Column - Only shown in search mode */}
        {isSearchMode && (
          <aside className="w-1/4 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex-shrink-0">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-5 py-4 border-b border-blue-200">
              <h2 className="text-sm font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">
                <Search size={16} />
                Search Results
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full ml-1">
                  {searchResults.length}
                </span>
              </h2>
            </div>
            <div className="overflow-y-auto h-full p-2">
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className={`flex items-center px-3 py-3 cursor-pointer hover:bg-blue-50 transition-colors rounded-lg mb-1 ${
                    selectedItem === result.id
                      ? "bg-blue-100 border-l-4 border-blue-600"
                      : ""
                  }`}
                  onClick={() => handleNavigationClick(result)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 line-clamp-1">
                      {result.reference_code && (
                        <span className="font-mono text-xs text-blue-600 mr-2">
                          {result.reference_code}
                        </span>
                      )}
                      {result.title || result.content_text?.substring(0, 60)}
                    </div>
                    {result.content_text &&
                      result.content_text !== result.title && (
                        <div className="text-xs text-gray-600 line-clamp-2 mt-1">
                          {searchTerm
                            ? highlightText(
                                result.content_text.substring(0, 100) + "...",
                                searchTerm
                              )
                            : result.content_text.substring(0, 100) + "..."}
                        </div>
                      )}
                    <div className="text-xs text-gray-400 mt-1 capitalize">
                      {result.content_type}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Navigation Sidebar - Hidden in search mode */}
        {!isSearchMode && (
          <aside className="w-1/4 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex-shrink-0">
            <div className="bg-gradient-to-r from-gray-50 to-white px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                Navigation
              </h2>
            </div>
            <div className="overflow-y-auto h-full p-2">
              {navigationData.map((item) => renderNavigationItem(item))}
            </div>
          </aside>
        )}

        {/* Content Area */}
        <main
          className={`bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden ${
            isSearchMode ? "flex-1" : "w-3/4"
          }`}
        >
          <div ref={contentContainerRef} className="h-full overflow-y-auto">
            <div
              className={`px-8 py-6 ${isSearchMode ? "max-w-4xl mx-auto" : ""}`}
            >
              {contentLoading && (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              )}

              {currentContent.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-gray-500 text-lg">
                    {navigationData.length === 0
                      ? "No building code data available."
                      : "Select an item from the navigation to view content."}
                  </p>
                </div>
              ) : (
                <div>
                  {isSearchMode && (
                    <div className="mb-6 pb-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Search Results for "{searchTerm}"
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Found {searchResults.length} matching items
                      </p>
                    </div>
                  )}
                  {currentContent.map((item) => renderContentItem(item))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <footer className="bg-white border-t border-gray-200 py-11 flex-shrink-0"></footer>
    </div>
  );
};

export default React.memo(BuildingCodeViewer);

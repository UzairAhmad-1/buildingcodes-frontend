// src/components/BuildingCodeViewer.tsx
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { ChevronRight, Search, X, ExternalLink, Menu } from "lucide-react";
import { HierarchyNode } from "@/types/buildingCode";
import { buildingCodeService } from "@/services/buildingCodeService";
import { useSearchParams } from "next/navigation";
import AnimatedPopup from "@/components/AnimatedPopup";

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

interface ReferencePopup {
  isOpen: boolean;
  reference: Reference | null;
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
  const [showMobileNav, setShowMobileNav] = useState(false);
  const contentRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const [navigationExpandedItems, setNavigationExpandedItems] = useState<
    Set<number>
  >(new Set());
  const [contentExpandedItems, setContentExpandedItems] = useState<Set<number>>(
    new Set()
  );
  const [referencePopup, setReferencePopup] = useState<ReferencePopup>({
    isOpen: false,
    reference: null,
  });
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const params = useSearchParams();
  const highlightParam = params.get("highlight");

  // Check if mobile view
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  // Memoized values
  const isSearchMode = useMemo(() => {
    return searchTerm.trim().length > 0 && searchResults.length > 0;
  }, [searchTerm, searchResults]);

  // Check if content is already loaded in current content
  const isContentAlreadyLoaded = useCallback(
    (contentId: number): boolean => {
      const checkInContent = (nodes: HierarchyNode[]): boolean => {
        for (const node of nodes) {
          if (node.id === contentId) {
            return true;
          }
          if (node.children && node.children.length > 0) {
            if (checkInContent(node.children)) {
              return true;
            }
          }
        }
        return false;
      };

      return checkInContent(currentContent);
    },
    [currentContent]
  );

  // Find parent content ID based on item type
  const findParentContentId = useCallback(
    (item: HierarchyNode): number => {
      // For division, part, section - load the item itself
      if (["division", "part", "section"].includes(item.content_type)) {
        return item.id;
      }

      // For subsection, article, sentence, clause, subclause - find the parent part or section
      let current = item;
      while (current) {
        if (
          current.content_type === "part" ||
          current.content_type === "section"
        ) {
          return current.id;
        }
        // Move up the hierarchy
        current = findParentInNavigation(navigationData, current.parent_id);
      }

      // Fallback to the item itself
      return item.id;
    },
    [navigationData]
  );

  // Helper function to find parent in navigation data
  const findParentInNavigation = (
    nodes: HierarchyNode[],
    parentId: number | null
  ): HierarchyNode | null => {
    for (const node of nodes) {
      if (node.id === parentId) {
        return node;
      }
      if (node.children) {
        const found = findParentInNavigation(node.children, parentId);
        if (found) return found;
      }
    }
    return null;
  };

  // Helper function to find item in navigation data
  const findItemInNavigation = useCallback(
    (nodes: HierarchyNode[], id: number): HierarchyNode | null => {
      for (const node of nodes) {
        if (node.id === id) {
          return node;
        }
        if (node.children) {
          const found = findItemInNavigation(node.children, id);
          if (found) return found;
        }
      }
      return null;
    },
    []
  );

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

        // Close mobile nav when content is loaded on mobile
        if (isMobile) {
          setShowMobileNav(false);
        }
      } catch (error) {
        console.error("Error loading content:", error);
      } finally {
        setContentLoading(false);
      }
    },
    [documentId, isMobile]
  );

  // Scroll to element without affecting layout
  const scrollToElement = useCallback((elementId: number) => {
    requestAnimationFrame(() => {
      const element = contentRefs.current[elementId];
      const container = contentContainerRef.current;

      if (element && container) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();

        const scrollTop =
          container.scrollTop +
          (elementRect.top - containerRect.top) -
          containerRect.height / 2 +
          elementRect.height / 2;

        container.scrollTo({
          top: scrollTop,
          behavior: "smooth",
        });
      }
    });
  }, []);

  // Navigation click handler
  const handleNavigationClick = useCallback(
    (item: HierarchyNode) => {
      console.log("Navigation item clicked:", item.id, item.content_type);

      const contentIdToLoad = findParentContentId(item);
      console.log("Content to load:", contentIdToLoad);
      console.log(
        "Is content already loaded?",
        isContentAlreadyLoaded(item.id)
      );

      // Always set the selected item for navigation
      setSelectedItem(item.id);

      // Auto-expand the clicked item in navigation
      setNavigationExpandedItems((prev) => new Set(prev).add(item.id));

      // Check if the content is already loaded in current view
      if (isContentAlreadyLoaded(item.id)) {
        console.log("Content already loaded, just scrolling to item");
        scrollToElement(item.id);
        return;
      }

      console.log("Loading content for:", contentIdToLoad);
      loadContentForItem(contentIdToLoad).then(() => {
        setTimeout(() => scrollToElement(item.id), 150);
      });
    },
    [
      loadContentForItem,
      findParentContentId,
      isContentAlreadyLoaded,
      scrollToElement,
    ]
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

        if (isContentAlreadyLoaded(reference.target_content_id)) {
          console.log("Reference content already loaded, just scrolling");
          scrollToElement(reference.target_content_id);
        } else {
          loadContentForItem(reference.target_content_id).then(() => {
            setTimeout(() => scrollToElement(reference.target_content_id), 150);
          });
        }
      }
    },
    [loadContentForItem, isContentAlreadyLoaded, scrollToElement]
  );

  // Handle "see also" click
  const handleSeeAlsoClick = useCallback(
    (seeAlsoText: string) => {
      const match = seeAlsoText.match(/Note\s+([A-Za-z0-9.-]+)/);
      if (match) {
        const noteReference = match[1];
        console.log("Looking for note:", noteReference);

        const findNote = (nodes: HierarchyNode[]): HierarchyNode | null => {
          for (const node of nodes) {
            if (
              node.reference_code === noteReference ||
              node.title?.includes(noteReference) ||
              node.content_text?.includes(noteReference)
            ) {
              return node;
            }
            if (node.children) {
              const found = findNote(node.children);
              if (found) return found;
            }
          }
          return null;
        };

        const noteItem = findNote(navigationData);
        if (noteItem) {
          console.log("Found note item:", noteItem.id);
          handleNavigationClick(noteItem);
        }
      }
    },
    [navigationData, handleNavigationClick]
  );

  const handleReferenceClickWithPopup = useCallback(
    (reference: Reference, event: React.MouseEvent) => {
      event.stopPropagation();

      setReferencePopup({
        isOpen: true,
        reference,
      });
    },
    []
  );

  // Update the popup close function
  const closeReferencePopup = useCallback(() => {
    setReferencePopup({
      isOpen: false,
      reference: null,
    });
  }, []);

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
              className="text-purple-800 cursor-pointer italic hover:underline"
              title={`Click to view definition of ${refText}`}
              onClick={(e) => handleReferenceClickWithPopup(ref, e)}
            >
              {text.substring(refIndex, refIndex + refText.length)}
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
    [handleReferenceClickWithPopup]
  );

  // Function to render "see also" content
  const renderSeeAlsoContent = useCallback(
    (item: HierarchyNode) => {
      if (item.content_type !== "see_also" || !item.content_text) {
        return null;
      }

      const seeAlsoText = item.content_text;
      const seeAlsoMatch = seeAlsoText.match(
        /\((See)\s+(Note\s+[A-Za-z0-9.-]+)\)/
      );

      if (seeAlsoMatch) {
        const [, seePart, notePart] = seeAlsoMatch;
        return (
          <div className="mt-2 text-sm">
            <span className="text-black">({seePart} </span>
            <span
              className="text-blue-600 underline cursor-pointer hover:text-blue-800 transition-colors"
              onClick={() => handleSeeAlsoClick(seeAlsoText)}
            >
              {notePart}
            </span>
            <span className="text-black">)</span>
          </div>
        );
      }

      return (
        <div
          className="mt-2 text-sm text-blue-600 underline cursor-pointer hover:text-blue-800 transition-colors"
          onClick={() => handleSeeAlsoClick(seeAlsoText)}
        >
          {seeAlsoText}
        </div>
      );
    },
    [handleSeeAlsoClick]
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
      sentence: { text: "text-xs text-black font-normal" },
      clause: { text: "text-xs text-black font-normal" },
      subclause: { text: "text-xs text-black font-normal" },
      see_also: { text: "text-xs text-blue-600 underline cursor-pointer" },
      definition: { text: "text-sm text-black font-normal" },
    };

    return styles[type] || { text: "text-xs text-black font-normal" };
  };

  // Navigation item renderer
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

  const renderDefinition = useCallback(
    (definition: HierarchyNode, level: number = 0) => {
      const hasChildren = definition.children && definition.children.length > 0;

      return (
        <div
          key={definition.id}
          ref={(el) => {
            contentRefs.current[definition.id] = el;
          }}
          className="bg-white"
          onMouseEnter={() => setHoveredItem(definition.id)}
          onMouseLeave={() => setHoveredItem(null)}
          onClick={() => setSelectedItem(definition.id)}
        >
          <div className="text-sm text-black leading-relaxed">
            {definition.title && (
              <span className="italic text-black">
                {searchTerm
                  ? highlightText(definition.title, searchTerm)
                  : definition.title}
              </span>
            )}

            {definition.content_text && (
              <span className="ml-1">
                {searchTerm
                  ? highlightText(definition.content_text, searchTerm)
                  : highlightReferences(
                      definition.content_text,
                      definition.references || []
                    )}
              </span>
            )}
          </div>

          {hasChildren && (
            <div className="mt-2 ml-4 space-y-1">
              {definition.children!.map((child) => {
                if (child.content_type === "clause") {
                  return (
                    <div
                      key={child.id}
                      className="text-sm text-black leading-relaxed hover:bg-gray-100 hover:border hover:border-black"
                    >
                      {child.title && (
                        <div className="flex items-start gap-1">
                          <span className="font-medium">
                            {child.reference_code}
                          </span>
                          <span>
                            {searchTerm
                              ? highlightText(child.title, searchTerm)
                              : highlightReferences(
                                  child.title,
                                  child.references || []
                                )}
                          </span>
                        </div>
                      )}

                      {child.content_text && (
                        <div className="ml-4">
                          {searchTerm
                            ? highlightText(child.content_text, searchTerm)
                            : highlightReferences(
                                child.content_text,
                                child.references || []
                              )}
                        </div>
                      )}
                    </div>
                  );
                }

                if (child.content_type === "see_also") {
                  return (
                    <div key={child.id}>{renderSeeAlsoContent(child)}</div>
                  );
                }

                return null;
              })}
            </div>
          )}
        </div>
      );
    },
    [searchTerm, highlightText, highlightReferences, renderSeeAlsoContent]
  );

  const handleGridItemClick = useCallback(
    (child: HierarchyNode) => {
      console.log("Grid item clicked:", child.id, child.content_type);
      setSelectedItem(child.id);

      console.log("Loading grid item content:", child.id);
      loadContentForItem(child.id).then(() => {
        setTimeout(() => scrollToElement(child.id), 150);
      });
    },
    [loadContentForItem, scrollToElement]
  );

  // Content item renderer
  const renderContentItem = useCallback(
    (item: HierarchyNode, level: number = 0) => {
      if (item.content_type === "see_also") {
        return (
          <div key={item.id} className="mb-2">
            {renderSeeAlsoContent(item)}
          </div>
        );
      }

      const isLargeContent = item.metadata?.isLargeContent;
      const contentType = item.content_type;

      const hasChildren = item.children && item.children.length > 0;
      const isHighlighted = selectedItem === item.id;
      const isHovered = hoveredItem === item.id;
      const typeStyles = getTypeStyles(contentType);

      const showHighlight =
        isHighlighted &&
        ["division", "part", "section", "subsection", "article"].includes(
          contentType
        );

      if (isLargeContent) {
        return (
          <div key={item.id} className="py-4 px-2 bg-blue-50">
            <div
              ref={(el) => {
                contentRefs.current[item.id] = el;
              }}
              className="p-2 rounded-lg mb-6"
            >
              {(item.reference_code || item.title || item.content_text) && (
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  {item.reference_code && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm font-mono">
                      {item.reference_code}
                    </span>
                  )}
                  {item.title && (
                    <h1 className={`text-3xl text-gray-500`}>
                      {searchTerm
                        ? highlightText(item.title, searchTerm)
                        : item.title}
                    </h1>
                  )}
                  {item.content_text && item.content_text !== item.title && (
                    <p className={`text-3xl text-gray-500`}>
                      {searchTerm
                        ? highlightText(item.content_text, searchTerm)
                        : highlightReferences(
                            item.content_text,
                            item.references || []
                          )}
                    </p>
                  )}
                </div>
              )}
            </div>

            {hasChildren && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {item.children!.map((child) => (
                  <div
                    key={child.id}
                    ref={(el) => {
                      contentRefs.current[child.id] = el;
                    }}
                    className={`p-4 rounded-lg cursor-pointer transition-all
                ${
                  selectedItem === child.id
                    ? "shadow-md shadow-black/20 bg-white"
                    : "bg-white"
                }
                hover:shadow-md hover:shadow-black/10
              `}
                    onMouseEnter={() => setHoveredItem(child.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                    onClick={() => handleGridItemClick(child)}
                  >
                    <div className="flex flex-col h-full">
                      <div className="flex items-start gap-2 mb-2">
                        {child.reference_code && (
                          <span className="font-mono text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            {child.reference_code}
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base text-gray-900 mb-2">
                          {(child.title ? child.title + " " : "") +
                            (child.content_text || "")}
                        </h3>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

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
                  {item.children!.map((child) => {
                    if (child.content_type === "see_also") {
                      return renderSeeAlsoContent(child);
                    }
                    return renderArticleChild(child, 0, item);
                  })}
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

            {hasChildren &&
              item.children!.some(
                (child) => child.content_type === "see_also"
              ) && (
                <div className="mt-2">
                  {item
                    .children!.filter(
                      (child) => child.content_type === "see_also"
                    )
                    .map((child) => renderSeeAlsoContent(child))}
                </div>
              )}
          </div>

          {hasChildren && item.content_type !== "article" && (
            <div className="ml-4">
              {item
                .children!.filter((child) => child.content_type !== "see_also")
                .map((child) => renderContentItem(child, level + 1))}
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
      renderSeeAlsoContent,
      handleNavigationClick,
    ]
  );

  const renderClauseContent = useCallback(
    (item: HierarchyNode, level: number = 0) => {
      if (item.content_type === "see_also") {
        return renderSeeAlsoContent(item);
      }

      if (item.content_type === "definition") {
        return renderDefinition(item, level);
      }

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
            <div className="flex items-start gap-1 text-sm">
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

            {hasChildren &&
              item.children!.some(
                (child) => child.content_type === "see_also"
              ) && (
                <div className="mt-1">
                  {item
                    .children!.filter(
                      (child) => child.content_type === "see_also"
                    )
                    .map((child) => renderSeeAlsoContent(child))}
                </div>
              )}

            {hasChildren && (
              <div className="ml-4 mt-1 space-y-2">
                {item
                  .children!.filter(
                    (child) => child.content_type !== "see_also"
                  )
                  .map((child) => {
                    if (child.content_type === "definition") {
                      return renderDefinition(child, level + 1);
                    }
                    return renderClauseContent(child, level + 1);
                  })}
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

            {hasChildren &&
              item.children!.some(
                (child) => child.content_type === "see_also"
              ) && (
                <div className="mt-1">
                  {item
                    .children!.filter(
                      (child) => child.content_type === "see_also"
                    )
                    .map((child) => renderSeeAlsoContent(child))}
                </div>
              )}
          </div>
        );
      }

      return null;
    },
    [
      selectedItem,
      hoveredItem,
      searchTerm,
      highlightText,
      highlightReferences,
      renderSeeAlsoContent,
      renderDefinition,
    ]
  );

  const renderArticleChild = useCallback(
    (item: HierarchyNode, level: number = 0, parentItem?: HierarchyNode) => {
      const hasChildren = item.children && item.children.length > 0;

      if (item.content_type === "definition") {
        return renderDefinition(item, level);
      }

      if (item.content_type === "see_also") {
        return renderSeeAlsoContent(item);
      }

      const isDefinedTermsSection =
        parentItem &&
        parentItem.content_type === "article" &&
        (parentItem.title?.toLowerCase().includes("defined terms") ||
          parentItem.content_text?.toLowerCase().includes("defined terms"));

      if (item.content_type === "sentence" && isDefinedTermsSection) {
        const isHighlighted = selectedItem === item.id;
        const isHovered = hoveredItem === item.id;

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
            {(item.reference_code || item.content_text) && (
              <div className="text-gray-700 leading-relaxed mb-3">
                <div className="flex flex-wrap items-start gap-2">
                  {item.reference_code && <span>{item.reference_code}</span>}

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

            {hasChildren && (
              <div className="space-y-4">
                {item.children!.map((child) => {
                  if (child.content_type === "definition") {
                    return renderDefinition(child);
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        );
      }

      if (item.content_type === "sentence") {
        const isHighlighted = selectedItem === item.id;
        const isHovered = hoveredItem === item.id;

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
                {(item.reference_code || item.content_text) && (
                  <div className="text-gray-700 leading-relaxed">
                    <div className="flex flex-wrap items-start gap-2">
                      {item.reference_code && (
                        <span>{item.reference_code}</span>
                      )}

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

                {hasChildren &&
                  item.children!.some(
                    (child) => child.content_type === "see_also"
                  ) && (
                    <div className="mt-2">
                      {item
                        .children!.filter(
                          (child) => child.content_type === "see_also"
                        )
                        .map((child) => renderSeeAlsoContent(child))}
                    </div>
                  )}

                {hasChildren && (
                  <div className="mt-2 space-y-3">
                    {item.children!.map((child) => {
                      if (child.content_type === "definition") {
                        return renderDefinition(child);
                      }
                      if (
                        child.content_type === "clause" ||
                        child.content_type === "subclause"
                      ) {
                        return renderClauseContent(child);
                      }
                      return null;
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }

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

          {hasChildren &&
            item.children!.some(
              (child) => child.content_type === "see_also"
            ) && (
              <div className="mt-1">
                {item
                  .children!.filter(
                    (child) => child.content_type === "see_also"
                  )
                  .map((child) => renderSeeAlsoContent(child))}
              </div>
            )}
        </div>
      );
    },
    [
      selectedItem,
      hoveredItem,
      searchTerm,
      highlightText,
      highlightReferences,
      renderSeeAlsoContent,
      renderDefinition,
      renderClauseContent,
    ]
  );

  // Mobile navigation overlay
  const MobileNavOverlay = () => (
    <>
      {showMobileNav && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setShowMobileNav(false)}
        />
      )}
      <div
        className={`
        fixed top-0 left-0 h-full bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out
        ${showMobileNav ? "translate-x-0" : "-translate-x-full"}
        w-80 md:hidden
      `}
      >
        <div className="bg-gradient-to-r from-gray-50 to-white px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
            Navigation
          </h2>
          <button
            onClick={() => setShowMobileNav(false)}
            className="p-1 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto h-full p-2">
          {navigationData.map((item) => renderNavigationItem(item))}
        </div>
      </div>
    </>
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
      {/* Mobile Navigation Overlay */}
      <MobileNavOverlay />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="max-w-[1800px] mx-auto px-4 md:px-8 py-2">
          <div className="flex items-center justify-between">
            {/* Left side - Document info and mobile menu */}
            <div className="flex items-center flex-1 min-w-0">
              {/* Mobile menu button */}
              <button
                onClick={() => setShowMobileNav(true)}
                className="md:hidden mr-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Menu size={20} />
              </button>

              <div className="min-w-0 flex-1">
                <h1 className="text-lg md:text-xl font-bold text-gray-900 tracking-tight truncate">
                  {documentInfo?.title || "British Columbia Building Code 2024"}
                </h1>
              </div>
            </div>

            {/* Right side - Search bar */}
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <Search
                  className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search by title, content, or reference code..."
                  className="w-full pl-10 md:pl-12 pr-10 md:pr-12 py-2 md:py-3 border text-black border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white shadow-sm transition-all"
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
                    className="absolute right-3 md:right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div
        className={`flex-1 flex overflow-hidden max-w-[1800px] mx-auto w-full px-3 md:px-6 py-2 gap-4 md:gap-6`}
      >
        {/* Search Results Column - Only shown in search mode */}
        {isSearchMode && (
          <aside
            className={`
            bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex-shrink-0
            ${isMobile ? "fixed inset-4 z-40" : "w-1/4"}
          `}
          >
            {isMobile && (
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-5 py-4 border-b border-blue-200 flex items-center justify-between">
                <h2 className="text-sm font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">
                  <Search size={16} />
                  Search Results
                  <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full ml-1">
                    {searchResults.length}
                  </span>
                </h2>
                <button
                  onClick={() => setSearchTerm("")}
                  className="p-1 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            )}
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

        {/* Navigation Sidebar - Hidden in search mode and mobile */}
        {!isSearchMode && !isMobile && (
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
          className={`
            bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden 
            ${isSearchMode ? "flex-1" : isMobile ? "w-full" : "w-3/4"}
          `}
        >
          <div ref={contentContainerRef} className="h-full overflow-y-auto">
            <div
              className={`px-4 md:px-8 py-4 md:py-6 ${
                isSearchMode ? "max-w-4xl mx-auto" : ""
              }`}
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

      {referencePopup.isOpen && referencePopup.reference && (
        <AnimatedPopup
          isOpen={referencePopup.isOpen}
          onClose={closeReferencePopup}
          title={referencePopup.reference.reference_text}
          maxWidth="max-w-2xl"
          copyText={
            referencePopup.reference.hyperlink_text ||
            referencePopup.reference.target_content?.content_text ||
            "Definition not available"
          }
        >
          {referencePopup.reference.hyperlink_text ? (
            <div className="text-base text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg">
              {referencePopup.reference.hyperlink_text}
            </div>
          ) : referencePopup.reference.target_content ? (
            <div className="text-base text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg">
              {referencePopup.reference.target_content.content_text}
            </div>
          ) : (
            <div className="text-base text-gray-500 italic bg-gray-50 p-4 rounded-lg">
              Definition not available
            </div>
          )}
        </AnimatedPopup>
      )}
    </div>
  );
};

export default React.memo(BuildingCodeViewer);

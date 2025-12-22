// src/components/LibraryHome.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  Loader2,
  FileText,
  Globe,
  Type,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { libraryService } from "../services/libraryService";

interface Jurisdiction {
  id: number;
  name: string;
  code: string;
}

interface DocumentType {
  id: number;
  name: string;
  description: string;
}

interface Language {
  id: number;
  code: string;
  name: string;
}

interface GroupedSearchResult {
  documentId: string;
  documentTitle: string;
  jurisdictionName: string;
  documentTypeName: string;
  year: number;
  items: SearchResult[];
}

interface SearchResult {
  id: number;
  parent_id: number | null;
  content_type: string;
  page_number: number;
  reference_code: string;
  title: string;
  content_text: string;
  sequence_order: number;
  pdf_document_id: string;
  font_family: string;
  font_size: number;
  bbox: number[];
  y_coordinate: number;
  document_title: string;
  jurisdiction_name: string;
  document_type_name: string;
  year: number;
}

interface SearchResponse {
  results: SearchResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
interface PdfDocument {
  id: string;
  title: string;
  year: number;
  version?: string;
  effective_date: string;
  jurisdiction_name: string;
  jurisdiction_code: string;
  document_type_name: string;
  language_name: string;
  file_name: string;
  processing_status: string;
}

const LibraryHome: React.FC = () => {
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [pdfDocuments, setPdfDocuments] = useState<PdfDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<PdfDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchPagination, setSearchPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);

  const [selectedJurisdiction, setSelectedJurisdiction] =
    useState<string>("all");
  const [selectedDocumentTypes, setSelectedDocumentTypes] = useState<
    Set<string>
  >(new Set(["Codes"]));
  const [selectedLanguages, setSelectedLanguages] = useState<Set<string>>(
    new Set(["English"])
  );
  const [searchTerm, setSearchTerm] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    jurisdiction: true,
    types: true,
    language: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const filterDocuments = useCallback(() => {
    let filtered = pdfDocuments;

    // Filter by jurisdiction
    if (selectedJurisdiction !== "all") {
      filtered = filtered.filter(
        (doc) =>
          doc.jurisdiction_code.toLowerCase() ===
          selectedJurisdiction.toLowerCase()
      );
    }

    // Filter by document type
    if (selectedDocumentTypes.size > 0) {
      filtered = filtered.filter((doc) =>
        selectedDocumentTypes.has(doc.document_type_name)
      );
    }

    // Filter by language
    if (selectedLanguages.size > 0) {
      filtered = filtered.filter((doc) =>
        selectedLanguages.has(doc.language_name)
      );
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (doc) =>
          doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doc.jurisdiction_name
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          doc.document_type_name
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
    }

    setFilteredDocuments(filtered);
  }, [
    selectedJurisdiction,
    selectedDocumentTypes,
    selectedLanguages,
    searchTerm,
    pdfDocuments,
  ]);

  useEffect(() => {
    filterDocuments();
  }, [filterDocuments]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [
        jurisdictionsRes,
        documentTypesRes,
        languagesRes,
        pdfDocumentsRes,
      ] = await Promise.all([
        libraryService.getJurisdictions(),
        libraryService.getDocumentTypes(),
        libraryService.getLanguages(),
        libraryService.getPdfDocuments(),
      ]);

      setJurisdictions(jurisdictionsRes);
      setDocumentTypes(documentTypesRes);
      setLanguages(languagesRes);
      setPdfDocuments(pdfDocumentsRes);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDocumentType = (typeName: string) => {
    const newSelected = new Set(selectedDocumentTypes);
    if (newSelected.has(typeName)) {
      newSelected.delete(typeName);
    } else {
      newSelected.add(typeName);
    }
    setSelectedDocumentTypes(newSelected);
  };

  const toggleLanguage = (languageName: string) => {
    const newSelected = new Set(selectedLanguages);
    if (newSelected.has(languageName)) {
      newSelected.delete(languageName);
    } else {
      newSelected.add(languageName);
    }
    setSelectedLanguages(newSelected);
  };
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getDocumentTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      Codes: "bg-blue-100 text-blue-800",
      Acts: "bg-green-100 text-green-800",
      Standards: "bg-purple-100 text-purple-800",
      Intents: "bg-orange-100 text-orange-800",
      Guides: "bg-indigo-100 text-indigo-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const groupSearchResultsByArticle = (
    results: SearchResult[]
  ): GroupedSearchResult[] => {
    const grouped: { [key: string]: GroupedSearchResult } = {};

    results.forEach((result) => {
      // Group by document first
      const docKey = result.pdf_document_id;

      if (!grouped[docKey]) {
        grouped[docKey] = {
          documentId: result.pdf_document_id,
          documentTitle: result.document_title,
          jurisdictionName: result.jurisdiction_name,
          documentTypeName: result.document_type_name,
          year: result.year,
          items: [],
        };
      }

      grouped[docKey].items.push(result);
    });

    // Sort items within each group to prioritize articles and their children
    Object.values(grouped).forEach((group) => {
      group.items.sort((a, b) => {
        // Sort by sequence order to maintain hierarchy
        return a.sequence_order - b.sequence_order;
      });
    });

    return Object.values(grouped);
  };

  // Helper function to get article and its children
  const getArticleWithChildren = (items: SearchResult[]) => {
    const articles: { [key: string]: SearchResult[] } = {};

    items.forEach((item) => {
      if (item.content_type === "article") {
        articles[item.id] = [item];
      }
    });

    // Add children to their parent articles
    items.forEach((item) => {
      if (item.content_type !== "article" && item.parent_id) {
        if (articles[item.parent_id]) {
          articles[item.parent_id].push(item);
        } else {
          // If parent not found in current results, create a new group for this item
          const parentKey = `orphan-${item.parent_id}`;
          if (!articles[parentKey]) {
            articles[parentKey] = [];
          }
          articles[parentKey].push(item);
        }
      }
    });

    return Object.values(articles);
  };

  const handleSearch = async (page: number = 1) => {
    if (!searchQuery.trim()) {
      setShowSearchResults(false);
      return;
    }

    try {
      setIsSearching(true);
      const response: SearchResponse = await libraryService.searchContent(
        searchQuery,
        undefined, // Search across all documents
        page,
        10
      );

      setSearchResults(response.results);
      setSearchPagination(response.pagination);
      setShowSearchResults(true);
    } catch (error) {
      console.error("Search error:", error);
      // You might want to show an error message to the user
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search input key press
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Handle search button click
  const handleSearchButtonClick = () => {
    handleSearch();
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    handleSearch(newPage);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery("");
    setShowSearchResults(false);
    setSearchResults([]);
  };

  // Navigate to document
  const navigateToDocument = (documentId: string, contentId?: number) => {
    if (contentId) {
      window.location.href = `/document/${documentId}?highlight=${contentId}`;
    } else {
      window.location.href = `/document/${documentId}`;
    }
  };
  const truncateText = (text: string | undefined, max: number = 60): string => {
    if (!text) return "";
    return text.length > max ? text.slice(0, max) + "..." : text;
  };

  // Highlight search terms in text
  const highlightText = (text: string, highlight: string) => {
    if (!highlight || !text) return text;

    const parts = text.split(new RegExp(`(${highlight})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className=" py-3  mx-auto">
          <div className="relative">
            <input
              type="text"
              placeholder="Search across all documents..."
              className="w-full pl-4 pr-20 py-3 border border-gray-300 rounded-lg text-black bg-white" // Increased right padding to pr-20
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleSearchKeyPress}
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="text-gray-400 hover:text-black transition-colors cursor-pointer"
                  aria-label="Clear search"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
              <button
                onClick={handleSearchButtonClick}
                disabled={isSearching}
                className="text-gray-400 hover:text-black transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSearching ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <div className="lg:w-1/4">
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <Filter className="h-5 w-5 text-black" />
                  <h2 className="text-lg font-semibold text-black">FILTERS</h2>
                </div>
              </div>

              {/* Jurisdiction Filter */}
              <div className="border-b border-gray-200">
                <button
                  className="flex items-center justify-between w-full p-6 text-left"
                  onClick={() => toggleSection("jurisdiction")}
                >
                  <div className="flex items-center space-x-2">
                    <Globe className="h-4 w-4 text-black" />
                    <span className="font-medium text-black">Jurisdiction</span>
                  </div>
                  {expandedSections.jurisdiction ? (
                    <ChevronUp className="h-4 w-4 text-black" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-black" />
                  )}
                </button>
                {expandedSections.jurisdiction && (
                  <div className="pb-4 px-6">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedJurisdiction("all")}
                        className={`px-3 py-2 rounded-full text-sm font-medium transition-all border cursor-pointer ${
                          selectedJurisdiction === "all"
                            ? "bg-black text-white border-black"
                            : "bg-white text-black border-gray-300 hover:border-black"
                        }`}
                      >
                        All
                      </button>

                      {jurisdictions
                        .filter((j) => j.name !== "All")
                        .map((jurisdiction) => (
                          <button
                            key={jurisdiction.id}
                            onClick={() =>
                              setSelectedJurisdiction(jurisdiction.code)
                            }
                            className={`px-3 py-2 rounded-full text-sm font-medium transition-all border cursor-pointer ${
                              selectedJurisdiction === jurisdiction.code
                                ? "bg-black text-white border-black"
                                : "bg-white text-black border-gray-300 hover:border-black"
                            }`}
                          >
                            {jurisdiction.name}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Document Types Filter */}
              <div className="border-b border-gray-200">
                <button
                  className="flex items-center justify-between w-full p-6 text-left"
                  onClick={() => toggleSection("types")}
                >
                  <div className="flex items-center space-x-2">
                    <Type className="h-4 w-4 text-black" />
                    <span className="font-medium text-black">Types</span>
                  </div>
                  {expandedSections.types ? (
                    <ChevronUp className="h-4 w-4 text-black" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-black" />
                  )}
                </button>
                {expandedSections.types && (
                  <div className="pb-4 px-6">
                    <div className="flex flex-wrap gap-2">
                      {documentTypes.map((type) => (
                        <button
                          key={type.id}
                          onClick={() => toggleDocumentType(type.name)}
                          className={`px-3 py-2 rounded-full text-sm font-medium transition-all border cursor-pointer ${
                            selectedDocumentTypes.has(type.name)
                              ? "bg-black text-white border-black"
                              : "bg-white text-black border-gray-300 hover:border-black"
                          }`}
                        >
                          {type.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Language Filter */}
              <div className="border-b border-gray-200">
                <button
                  className="flex items-center justify-between w-full p-6 text-left"
                  onClick={() => toggleSection("language")}
                >
                  <div className="flex items-center space-x-2">
                    <BookOpen className="h-4 w-4 text-black" />
                    <span className="font-medium text-black">Language</span>
                  </div>
                  {expandedSections.language ? (
                    <ChevronUp className="h-4 w-4 text-black" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-black" />
                  )}
                </button>
                {expandedSections.language && (
                  <div className="pb-4 px-6">
                    <div className="flex flex-wrap gap-2">
                      {languages.map((language) => (
                        <button
                          key={language.id}
                          onClick={() => toggleLanguage(language.name)}
                          className={`px-3 py-2 rounded-full text-sm font-medium transition-all border cursor-pointer ${
                            selectedLanguages.has(language.name)
                              ? "bg-black text-white border-black"
                              : "bg-white text-black border-gray-300 hover:border-black"
                          }`}
                        >
                          {language.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Results Count */}
              <div className="p-6">
                <p className="text-sm text-black">
                  Showing {filteredDocuments.length} of {pdfDocuments.length}{" "}
                  documents
                </p>
              </div>
            </div>
          </div>
          {/* Documents List */}

          <div className="lg:w-3/4">
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-black">
                  {showSearchResults ? "Search Results" : "Documents"}
                </h2>
                {showSearchResults && (
                  <p className="text-sm text-gray-600 mt-1">
                    Found {searchPagination.total} results for &quot;
                    {searchQuery}
                    &quot;
                    <button
                      onClick={handleClearSearch}
                      className="ml-2 text-blue-600 hover:text-blue-800 text-sm"
                    >
                      (Clear Search)
                    </button>
                  </p>
                )}
              </div>

              <div className="p-6">
                {showSearchResults ? (
                  // Show search results when searching
                  <>
                    {isSearching ? (
                      <div className="text-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-black" />
                        <p className="text-gray-600">Searching documents...</p>
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="text-center py-12">
                        <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-black mb-2">
                          No search results found
                        </h3>
                        <p className="text-gray-600">
                          No documents found for &quot;{searchQuery}&quot;. Try
                          different keywords or adjust your filters.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-6">
                          {groupSearchResultsByArticle(searchResults).map(
                            (group) => (
                              <div
                                key={group.documentId}
                                className=" rounded-lg  transition-colors"
                              >
                                {/* Article Groups */}
                                <div className="divide-y divide-gray-100">
                                  {getArticleWithChildren(group.items).map(
                                    (articleGroup, index) => {
                                      const article = articleGroup.find(
                                        (item) =>
                                          item.content_type === "article"
                                      );
                                      const children = articleGroup.filter(
                                        (item) =>
                                          item.content_type !== "article"
                                      );

                                      // If no article found, use the first item as header
                                      const headerItem =
                                        article || articleGroup[0];

                                      return (
                                        <div
                                          key={headerItem?.id || index}
                                          className="p-6 hover:bg-gray-50 transition-colors cursor-pointer group"
                                          onClick={() =>
                                            navigateToDocument(
                                              headerItem.pdf_document_id,
                                              headerItem.id
                                            )
                                          }
                                        >
                                          {/* Article Header */}
                                          <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1 ">
                                              <div className="flex items-start space-x-2 mb-1 text-blue-500 text-lg font-semibold">
                                                {headerItem.reference_code && (
                                                  <span className="leading-tight">
                                                    {headerItem.reference_code}
                                                  </span>
                                                )}

                                                {headerItem.content_text?.trim() && (
                                                  <span className="underline leading-snug">
                                                    {highlightText(
                                                      truncateText(
                                                        headerItem.content_text.trim(),
                                                        60
                                                      ),
                                                      searchQuery
                                                    )}
                                                  </span>
                                                )}
                                              </div>

                                              {/* Article Metadata */}
                                              <div className="flex items-center space-x-4 text-sm">
                                                <span className="bg-gray-100 text-black px-3 py-1 rounded-lg">
                                                  {group.year}
                                                </span>

                                                <span className="bg-gray-100 text-black px-3 py-1 rounded-lg">
                                                  English
                                                </span>

                                                <span className="bg-gray-100 text-black px-3 py-1 rounded-lg">
                                                  {headerItem.document_title}
                                                </span>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Children Content (sentences, clauses, etc.) */}
                                          {children.length > 0 && (
                                            <div className="mt-4 space-y-3 pl-4 border-l-2 border-gray-200">
                                              {children.map((child) => (
                                                <div
                                                  key={child.id}
                                                  className="text-gray-700 leading-relaxed"
                                                >
                                                  {child.reference_code && (
                                                    <span className="font-mono text-xs text-gray-500 mr-2">
                                                      {child.reference_code}
                                                    </span>
                                                  )}
                                                  {highlightText(
                                                    child.content_text?.substring(
                                                      0,
                                                      60
                                                    ),
                                                    searchQuery
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              </div>
                            )
                          )}
                        </div>

                        {/* Pagination for search results */}
                        {searchPagination.totalPages > 1 && (
                          <div className="flex justify-center items-center space-x-2 mt-6">
                            <button
                              onClick={() =>
                                handlePageChange(searchPagination.page - 1)
                              }
                              disabled={searchPagination.page === 1}
                              className="px-4 py-2 border text-white bg-black rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:border-black transition-colors"
                            >
                              Previous
                            </button>

                            <span className="text-sm text-gray-600">
                              Page {searchPagination.page} of{" "}
                              {searchPagination.totalPages}
                            </span>

                            <button
                              onClick={() =>
                                handlePageChange(searchPagination.page + 1)
                              }
                              disabled={
                                searchPagination.page ===
                                searchPagination.totalPages
                              }
                              className="px-4 py-2 border text-white bg-black rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:border-black transition-colors"
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  // Show filtered documents when not searching (keep existing code)
                  <>
                    {filteredDocuments.length === 0 ? (
                      <div className="text-center py-12">
                        <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-black mb-2">
                          No documents found
                        </h3>
                        <p className="text-gray-600">
                          Try adjusting your filters or search terms to find
                          what you&apos;re looking for.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredDocuments.map((document) => (
                          <div
                            key={document.id}
                            className="border border-gray-200 rounded-lg p-6 hover:border-black transition-colors cursor-pointer group"
                            onClick={() => {
                              window.location.href = `/document/${document.id}`;
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <span
                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getDocumentTypeColor(
                                      document.document_type_name
                                    )}`}
                                  >
                                    {document.document_type_name}
                                  </span>
                                  <span className="text-sm text-black font-medium">
                                    {document.jurisdiction_name}
                                  </span>
                                  <span className="text-sm text-gray-600">
                                    {document.year}
                                  </span>
                                </div>

                                <h3 className="text-lg font-semibold text-black mb-2 group-hover:text-blue-600 transition-colors">
                                  {document.title}
                                </h3>

                                <div className="flex items-center space-x-6 text-sm text-gray-600">
                                  <div className="flex items-center space-x-2">
                                    <BookOpen className="h-4 w-4" />
                                    <span>{document.language_name}</span>
                                  </div>
                                  {document.effective_date && (
                                    <div className="flex items-center space-x-2">
                                      <span>
                                        Effective:{" "}
                                        {formatDate(document.effective_date)}
                                      </span>
                                    </div>
                                  )}
                                  {document.version && (
                                    <span>Version: {document.version}</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center space-x-4">
                                <span
                                  className={`text-xs px-2 py-1 rounded ${
                                    document.processing_status === "completed"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}
                                >
                                  {document.processing_status}
                                </span>
                                <div className="w-2 h-2 bg-gray-300 rounded-full group-hover:bg-black transition-colors"></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LibraryHome;

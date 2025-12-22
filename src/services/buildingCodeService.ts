// src/services/buildingCodeService.ts
import {
  BuildingCodeItem,
  HierarchyNode,
  Reference,
} from "@/types/buildingCode";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Define proper interfaces for API responses
interface DocumentContentResponse {
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
  references?: ContentReference[];
}

interface ContentReference {
  id: number;
  reference_text: string;
  reference_type: string;
  target_content_id: number;
  target_reference_code: string;
  hyperlink_target: string;
  hyperlink_text: string;
  page_number: number;
  font_family: string;
  bbox: number[];
  reference_position: number;
  target_content?: {
    id: number;
    parent_id: number | null;
    content_type: string;
    page_number: number;
    reference_code: string | null;
    title: string | null;
    content_text: string | null;
    sequence_order: number;
    pdf_document_id: string;
    font_family: string | null;
    font_size: number | null;
    bbox: number[] | null;
    y_coordinate: number | null;
    is_definition: boolean;
    definition_term: string | null;
  } | null;
}
// Updated ContentItem interface to match the API response
interface ContentItem {
  id: number;
  parent_id: number | null;
  content_type: string;
  page_number: number;
  reference_code: string | null;
  title: string | null;
  content_text: string | null;
  sequence_order: number;
  pdf_document_id: string;
  font_family: string | null;
  font_size: number | null;
  bbox: number[] | null;
  y_coordinate: number | null;
  is_definition?: boolean;
  definition_term?: string | null;
  created_at?: string;
  updated_at?: string;
  references?: Reference[];
  children?: HierarchyNode[];
  metadata?: {
    isLargeContent?: boolean;
  };
}

interface SearchResult {
  id: number;
  parentId: number | null;
  contentType: string;
  pageNumber: number;
  referenceCode: string;
  title: string;
  contentText: string;
  sequenceOrder: number;
  pdfDocumentId: string;
  fontFamily: string;
  fontSize: number;
  bbox: number[];
  yCoordinate: number;
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

interface ContentReferencesResponse {
  references: ContentReference[];
}

interface DocumentNavigationResponse {
  documentId: string;
  navigation: HierarchyNode[];
}

// Simple request cache
const requestCache = new Map<string, Promise<unknown>>();

export const buildingCodeService = {
  async getHierarchy(): Promise<BuildingCodeItem[]> {
    const response = await fetch(`${API_BASE_URL}/building-code/hierarchy`);
    if (!response.ok) {
      throw new Error("Failed to fetch hierarchy");
    }
    return response.json();
  },

  async getDocumentContent(
    documentId: string,
    options?: {
      parentId?: number | null;
      contentType?: string;
      page?: number;
      limit?: number;
      signal?: AbortSignal;
    }
  ): Promise<DocumentContentResponse[]> {
    const params = new URLSearchParams();
    if (options?.parentId !== undefined)
      params.append("parentId", options.parentId?.toString() || "null");
    if (options?.contentType) params.append("contentType", options.contentType);
    if (options?.page) params.append("page", options.page.toString());
    if (options?.limit) params.append("limit", options.limit.toString());

    const cacheKey = `content-${documentId}-${params.toString()}`;

    if (requestCache.has(cacheKey)) {
      return requestCache.get(cacheKey) as Promise<DocumentContentResponse[]>;
    }

    const promise = fetch(
      `${API_BASE_URL}/pdf-documents/${documentId}/content?${params}`,
      { signal: options?.signal }
    ).then(async (response) => {
      requestCache.delete(cacheKey);
      if (!response.ok) throw new Error("Failed to fetch document content");
      return response.json();
    }) as Promise<DocumentContentResponse[]>;

    requestCache.set(cacheKey, promise);
    return promise;
  },

  async getContentItem(
    documentId: string,
    contentId: number,
    signal?: AbortSignal
  ): Promise<ContentItem> {
    const cacheKey = `content-item-${documentId}-${contentId}`;

    if (requestCache.has(cacheKey)) {
      return requestCache.get(cacheKey) as Promise<ContentItem>;
    }

    const promise = fetch(
      `${API_BASE_URL}/pdf-documents/${documentId}/content/${contentId}`,
      { signal }
    ).then(async (response) => {
      requestCache.delete(cacheKey);
      if (!response.ok) throw new Error("Failed to fetch content item");
      const data = await response.json();

      // Ensure the response has all required fields
      return {
        ...data,
        is_definition: data.is_definition || false,
        definition_term: data.definition_term || null,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
        references: data.references || [],
        children: data.children || [],
        metadata: data.metadata || {},
      };
    }) as Promise<ContentItem>;

    requestCache.set(cacheKey, promise);
    return promise;
  },

  async getDocumentNavigation(
    documentId: string,
    signal?: AbortSignal
  ): Promise<DocumentNavigationResponse> {
    const cacheKey = `navigation-${documentId}`;

    const promise = fetch(
      `${API_BASE_URL}/pdf-documents/${documentId}/navigation`,
      { signal }
    ).then(async (response) => {
      if (!response.ok) throw new Error("Failed to fetch document navigation");
      return response.json();
    }) as Promise<DocumentNavigationResponse>;

    return promise;
  },

  async searchContent(
    query: string,
    options?: {
      documentId?: string;
      page?: number;
      limit?: number;
      signal?: AbortSignal;
    }
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query });

    if (options?.documentId) params.append("documentId", options.documentId);
    if (options?.page) params.append("page", options.page.toString());
    if (options?.limit) params.append("limit", options.limit.toString());

    const response = await fetch(`${API_BASE_URL}/search?${params}`, {
      signal: options?.signal,
    });

    if (!response.ok) throw new Error("Failed to search content");
    return response.json();
  },

  async getContentReferences(
    documentId: string,
    contentId: number,
    signal?: AbortSignal
  ): Promise<ContentReferencesResponse> {
    // Since references are now included in content responses,
    // we can get them from the content item
    const contentItem = await this.getContentItem(
      documentId,
      contentId,
      signal
    );
    return { references: contentItem.references || [] };
  },

  async getContentByType(type: string): Promise<BuildingCodeItem[]> {
    const response = await fetch(
      `${API_BASE_URL}/building-code/content/${type}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch content by type");
    }
    return response.json();
  },
};

// Helper function to build hierarchy from flat data
export const buildHierarchy = (
  flatData: BuildingCodeItem[]
): HierarchyNode[] => {
  const map = new Map<number, HierarchyNode>();
  const roots: HierarchyNode[] = [];

  // Initialize all items
  flatData.forEach((item) => {
    map.set(item.id, { ...item, children: [] });
  });

  // Build tree structure
  flatData.forEach((item) => {
    const node = map.get(item.id)!;
    if (item.parent_id && map.has(item.parent_id)) {
      const parent = map.get(item.parent_id)!;
      if (!parent.children) parent.children = [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort children by sequence_order
  const sortChildren = (nodes: HierarchyNode[]): HierarchyNode[] => {
    return nodes
      .sort((a, b) => a.sequence_order - b.sequence_order)
      .map((node) => ({
        ...node,
        children: node.children ? sortChildren(node.children) : undefined,
      }));
  };

  return sortChildren(roots);
};

import {
  BuildingCodeItem,
  HierarchyNode,
  DocumentContentResponse,
} from "@/types/buildingCode";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
const requestCache = new Map<string, Promise<any>>();
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
  ): Promise<any> {
    const params = new URLSearchParams();
    if (options?.parentId !== undefined)
      params.append("parentId", options.parentId?.toString() || "null");
    if (options?.contentType) params.append("contentType", options.contentType);
    if (options?.page) params.append("page", options.page.toString());
    if (options?.limit) params.append("limit", options.limit.toString());

    const cacheKey = `content-${documentId}-${params.toString()}`;

    if (requestCache.has(cacheKey)) {
      return requestCache.get(cacheKey);
    }

    const promise = fetch(
      `${API_BASE_URL}/pdf-documents/${documentId}/content?${params}`,
      { signal: options?.signal }
    ).then(async (response) => {
      requestCache.delete(cacheKey);
      if (!response.ok) throw new Error("Failed to fetch document content");
      return response.json();
    });

    requestCache.set(cacheKey, promise);
    return promise;
  },

  async getContentItem(
    documentId: string,
    contentId: number,
    signal?: AbortSignal
  ): Promise<any> {
    const response = await fetch(
      `${API_BASE_URL}/pdf-documents/${documentId}/content/${contentId}`,
      { signal }
    );
    if (!response.ok) throw new Error("Failed to fetch content item");
    return response.json();
  },

  async getDocumentNavigation(
    documentId: string,
    signal?: AbortSignal
  ): Promise<{ documentId: string; navigation: HierarchyNode[] }> {
    const cacheKey = `navigation-${documentId}`;

    const promise = fetch(
      `${API_BASE_URL}/pdf-documents/${documentId}/navigation`,
      { signal }
    ).then(async (response) => {
      if (!response.ok) throw new Error("Failed to fetch document navigation");
      return response.json();
    });

    return promise;
  },

  async searchContent(
    documentId: string,
    query: string,
    options?: {
      contentType?: string;
      page?: number;
      limit?: number;
      signal?: AbortSignal;
    }
  ): Promise<any> {
    const params = new URLSearchParams({ q: query });
    if (options?.contentType) params.append("contentType", options.contentType);
    if (options?.page) params.append("page", options.page.toString());
    if (options?.limit) params.append("limit", options.limit.toString());

    const response = await fetch(
      `${API_BASE_URL}/pdf-documents/${documentId}/search?${params}`,
      { signal: options?.signal }
    );
    if (!response.ok) throw new Error("Failed to search content");
    return response.json();
  },

  async getContentReferences(
    documentId: string,
    contentId: number,
    signal?: AbortSignal
  ): Promise<any> {
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

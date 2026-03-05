// src/services/datalabService.ts
import {
  DatalabContentResponse,
  DocumentNavigation,
  SearchResponse,
  DocumentInfo,
} from "@/types/datalab";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Simple request cache
const requestCache = new Map<string, Promise<unknown>>();

export const datalabService = {
  /**
   * Get document information (metadata, processing status, etc.)
   */
  async getDocumentInfo(
    documentId: string,
    signal?: AbortSignal
  ): Promise<DocumentInfo> {
    const cacheKey = `datalab-info-${documentId}`;

    if (requestCache.has(cacheKey)) {
      return requestCache.get(cacheKey) as Promise<DocumentInfo>;
    }

    const promise = fetch(`${API_BASE_URL}/datalab/documents/${documentId}`, {
      signal,
    }).then(async (response) => {
      requestCache.delete(cacheKey);
      if (!response.ok) throw new Error("Failed to fetch document info");
      return response.json();
    }) as Promise<DocumentInfo>;

    requestCache.set(cacheKey, promise);
    return promise;
  },

  /**
   * Get paginated document content blocks
   */
  async getDocumentContent(
    documentId: string,
    options?: {
      page?: number;
      pageSize?: number;
      signal?: AbortSignal;
    }
  ): Promise<DatalabContentResponse> {
    const params = new URLSearchParams();
    if (options?.page) params.append("page", options.page.toString());
    if (options?.pageSize)
      params.append("page_size", options.pageSize.toString());

    const cacheKey = `datalab-content-${documentId}-${params.toString()}`;

    if (requestCache.has(cacheKey)) {
      return requestCache.get(cacheKey) as Promise<DatalabContentResponse>;
    }

    const promise = fetch(
      `${API_BASE_URL}/datalab/documents/${documentId}/content?${params}`,
      { signal: options?.signal }
    ).then(async (response) => {
      requestCache.delete(cacheKey);
      if (!response.ok) throw new Error("Failed to fetch document content");
      return response.json();
    }) as Promise<DatalabContentResponse>;

    requestCache.set(cacheKey, promise);
    return promise;
  },

  /**
   * Get navigation tree for document
   */
  async getDocumentNavigation(
    documentId: string,
    signal?: AbortSignal
  ): Promise<DocumentNavigation> {
    const cacheKey = `datalab-navigation-${documentId}`;

    if (requestCache.has(cacheKey)) {
      return requestCache.get(cacheKey) as Promise<DocumentNavigation>;
    }

    const promise = fetch(
      `${API_BASE_URL}/datalab/documents/${documentId}/navigation`,
      { signal }
    ).then(async (response) => {
      requestCache.delete(cacheKey);
      if (!response.ok)
        throw new Error("Failed to fetch document navigation");
      return response.json();
    }) as Promise<DocumentNavigation>;

    requestCache.set(cacheKey, promise);
    return promise;
  },

  /**
   * Search within document
   */
  async searchDocument(
    documentId: string,
    query: string,
    options?: {
      page?: number;
      pageSize?: number;
      signal?: AbortSignal;
    }
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query });
    if (options?.page) params.append("page", options.page.toString());
    if (options?.pageSize)
      params.append("page_size", options.pageSize.toString());

    const response = await fetch(
      `${API_BASE_URL}/datalab/documents/${documentId}/search?${params}`,
      { signal: options?.signal }
    );

    if (!response.ok) throw new Error("Failed to search document");
    return response.json();
  },

  /**
   * Load all content blocks (handles pagination automatically)
   */
  async getAllContent(
    documentId: string,
    onProgress?: (loaded: number, total: number) => void,
    signal?: AbortSignal
  ): Promise<DatalabContentResponse["items"]> {
    const allBlocks: DatalabContentResponse["items"] = [];
    let currentPage = 1;
    let totalPages = 1;

    while (currentPage <= totalPages) {
      const response = await this.getDocumentContent(documentId, {
        page: currentPage,
        pageSize: 100, // Load 100 items at a time
        signal,
      });

      allBlocks.push(...response.items);
      totalPages = response.total_pages;

      if (onProgress) {
        onProgress(allBlocks.length, response.total);
      }

      currentPage++;
    }

    return allBlocks;
  },

  /**
   * Get a specific block by its ID (for definition popups)
   */
  async getBlockById(
    documentId: string,
    blockId: string,
    signal?: AbortSignal
  ): Promise<any> {
    console.log("[DEFINITION DEBUG] getBlockById called with:", { documentId, blockId });

    // Don't URL-encode since we're using :path parameter in FastAPI
    const url = `${API_BASE_URL}/datalab/documents/${documentId}/blocks/${blockId}`;
    console.log("[DEFINITION DEBUG] Fetching URL:", url);

    const response = await fetch(url, { signal });

    console.log("[DEFINITION DEBUG] Response status:", response.status);

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error("Failed to fetch block");
    }
    return response.json();
  },

  /**
   * Clear cached requests
   */
  clearCache() {
    requestCache.clear();
  },
};

// Helper functions

/**
 * Extract plain text from HTML content
 */
export function extractTextFromHtml(html: string): string {
  if (typeof window === "undefined") return html;

  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

/**
 * Get section title from hierarchy
 */
export function getSectionTitle(
  sectionHierarchy: Record<string, string> | null
): string {
  if (!sectionHierarchy) return "";

  // Look for title field first
  if (sectionHierarchy.title) return sectionHierarchy.title;

  // Try to find the most specific heading (h6 to h1)
  for (let i = 6; i >= 1; i--) {
    const key = `h${i}_title`;
    if (sectionHierarchy[key]) return sectionHierarchy[key];
  }

  // Fallback to any heading value
  for (let i = 6; i >= 1; i--) {
    const key = `h${i}`;
    if (sectionHierarchy[key]) return sectionHierarchy[key];
  }

  return "";
}

/**
 * Get reference code from hierarchy
 */
export function getReferenceCode(
  sectionHierarchy: Record<string, string> | null
): string | null {
  if (!sectionHierarchy) return null;

  // Try to find reference code in heading levels (h6 to h1)
  for (let i = 6; i >= 1; i--) {
    const key = `h${i}`;
    if (sectionHierarchy[key]) {
      // Check if it looks like a reference code (contains numbers and periods)
      const value = sectionHierarchy[key];
      if (/^\d+(\.\d+)*/.test(value)) {
        return value;
      }
    }
  }

  return null;
}

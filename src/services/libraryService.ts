// src/services/libraryService.ts
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

// Define interfaces for API response types
interface ApiSearchResult {
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

interface ConvertedSearchResult {
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
  results: ApiSearchResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ConvertedSearchResponse {
  results: ConvertedSearchResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

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

class ApiService {
  private async fetchWithErrorHandling<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }

  // Convert camelCase to snake_case for search results
  private convertSearchResults(
    results: ApiSearchResult[]
  ): ConvertedSearchResult[] {
    return results.map((result) => ({
      id: result.id,
      parent_id: result.parentId,
      content_type: result.contentType,
      page_number: result.pageNumber,
      reference_code: result.referenceCode,
      title: result.title,
      content_text: result.contentText,
      sequence_order: result.sequenceOrder,
      pdf_document_id: result.pdfDocumentId,
      font_family: result.fontFamily,
      font_size: result.fontSize,
      bbox: result.bbox,
      y_coordinate: result.yCoordinate,
      document_title: result.document_title,
      jurisdiction_name: result.jurisdiction_name,
      document_type_name: result.document_type_name,
      year: result.year,
    }));
  }

  async getJurisdictions(): Promise<Jurisdiction[]> {
    return this.fetchWithErrorHandling<Jurisdiction[]>(
      `${API_BASE_URL}/jurisdictions`
    );
  }

  async getDocumentTypes(): Promise<DocumentType[]> {
    return this.fetchWithErrorHandling<DocumentType[]>(
      `${API_BASE_URL}/document-types`
    );
  }

  async getLanguages(): Promise<Language[]> {
    return this.fetchWithErrorHandling<Language[]>(`${API_BASE_URL}/languages`);
  }

  async getPdfDocuments(): Promise<PdfDocument[]> {
    return this.fetchWithErrorHandling<PdfDocument[]>(
      `${API_BASE_URL}/pdf-documents`
    );
  }

  async getPdfDocumentById(id: string): Promise<PdfDocument> {
    return this.fetchWithErrorHandling<PdfDocument>(
      `${API_BASE_URL}/pdf-documents/${id}`
    );
  }

  async getPdfDocumentContent(id: string): Promise<unknown> {
    return this.fetchWithErrorHandling<unknown>(
      `${API_BASE_URL}/pdf-documents/${id}/content`
    );
  }

  async searchContent(
    query: string,
    documentId?: string,
    page: number = 1,
    limit: number = 10
  ): Promise<ConvertedSearchResponse> {
    const params = new URLSearchParams({
      q: query,
      page: page.toString(),
      limit: limit.toString(),
    });

    if (documentId) {
      params.append("documentId", documentId);
    }

    const response = await this.fetchWithErrorHandling<SearchResponse>(
      `${API_BASE_URL}/search?${params}`
    );

    // Convert the results to snake_case for frontend compatibility
    return {
      ...response,
      results: this.convertSearchResults(response.results),
    };
  }
}

export const libraryService = new ApiService();

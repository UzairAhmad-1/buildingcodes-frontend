// src/types/datalab.ts
// Types for Datalab API responses

export interface DatalabContentBlock {
  id: number;
  block_type: string;
  sequence_order: number;
  html_content: string | null;
  markdown_content: string | null;
  section_hierarchy: Record<string, string> | null;
  images: Record<string, any> | null;
  bbox: number[] | null;
  polygon: Record<string, any> | null;
  block_id: string | null; // Datalab block ID for definition links
}

export interface DatalabContentResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: DatalabContentBlock[];
}

export interface NavigationNode {
  id: number;
  title: string;
  reference_code: string | null;
  sequence_order: number;
  level: number;
  children: NavigationNode[];
}

export interface DocumentNavigation {
  document_id: string;
  title: string;
  total_pages: number;
  navigation_tree: NavigationNode[];
}

export interface SearchResult {
  content_id: number;
  block_type: string;
  html_snippet: string;
  section_hierarchy: Record<string, string> | null;
  relevance_score: number;
}

export interface SearchResponse {
  query: string;
  total_results: number;
  page: number;
  page_size: number;
  results: SearchResult[];
}

export interface DocumentInfo {
  id: string;
  fileName: string;
  originalFileName: string;
  fileSize: number | null;
  title: string;
  year: number | null;
  version: string | null;
  effectiveDate: string | null;
  processingStatus: string;
  processedAt: string | null;
  createdAt: string;
  datalabRequestId: string | null;
  datalabCostCents: number | null;
  datalabEstimatedCostCents: number | null;
  parseQualityScore: number | null;
  pageCount: number | null;
  processingError: string | null;
  jurisdictionId: number | null;
  jurisdictionName: string | null;
  documentTypeId: number | null;
  documentTypeName: string | null;
  languageId: number | null;
  languageName: string | null;
}

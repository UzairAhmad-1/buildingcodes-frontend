export type ContentType =
  | "division"
  | "part"
  | "section"
  | "subsection"
  | "article"
  | "sentence"
  | "clause"
  | "subclause"
  | "see_also"
  | "definition";
export interface Reference {
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
  target_content?: {
    id: number;
    parent_id: number | null;
    content_type: ContentType;
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

export interface BuildingCodeItem {
  id: number;
  parent_id: number | null;
  content_type: ContentType;
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
  created_at: string;
  updated_at: string;
  references: Reference[];
  level?: number;
  path?: number[];
}

export interface HierarchyNode extends BuildingCodeItem {
  children?: HierarchyNode[];
}

export interface DocumentContentResponse {
  documentId: string;
  content: HierarchyNode[];
}

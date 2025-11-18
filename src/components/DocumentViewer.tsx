// components/DocumentViewer.tsx
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import BuildingCodeViewer from "@/components/BuildingCodeViewer";
import NonScrollableLayout from "@/components/NonScrollableLayout";
import { libraryService } from "@/services/libraryService";

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
  language_code: string;
  file_name: string;
  processing_status: string;
}

interface DocumentViewerProps {
  documentId?: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentId: propDocumentId,
}) => {
  const router = useRouter();
  const { id: queryDocumentId } = router.query;

  // Use prop documentId first, then fall back to router query
  const documentId = propDocumentId || (queryDocumentId as string);

  const [documentInfo, setDocumentInfo] = useState<PdfDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (documentId) {
      fetchDocumentInfo();
    }
  }, [documentId]);

  const fetchDocumentInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch document info using libraryService
      const docData = await libraryService.getPdfDocumentById(documentId);
      setDocumentInfo(docData);
    } catch (err) {
      setError(
        "Failed to load document data. Please ensure the backend server is running."
      );
      console.error("Error fetching document info:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Loading Document
          </h2>
          <p className="text-gray-600">Loading document information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Connection Error
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={fetchDocumentInfo}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw size={16} />
              Try Again
            </button>
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Back to Library
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <NonScrollableLayout>
      <BuildingCodeViewer
        documentId={documentId}
        documentInfo={documentInfo || undefined}
      />
    </NonScrollableLayout>
  );
};

export default DocumentViewer;

// src/pages/document/[id].tsx
import React from "react";
import { GetServerSideProps } from "next";
import DocumentViewer from "@/components/DocumentViewer";
import DatalabDocumentViewer from "@/components/DatalabDocumentViewer";

interface DocumentPageProps {
  documentId: string;
}

const DocumentPage: React.FC<DocumentPageProps> = ({ documentId }) => {
  // Toggle between old and new viewer
  const useDatalab = true; // Set to false to use old viewer

  if (useDatalab) {
    return <DatalabDocumentViewer documentId={documentId} />;
  }

  return <DocumentViewer documentId={documentId} />;
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params!;

  return {
    props: {
      documentId: id,
    },
  };
};

export default DocumentPage;

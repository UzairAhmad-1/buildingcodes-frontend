// src/pages/document/[id].tsx
import React from "react";
import { GetServerSideProps } from "next";
import DocumentViewer from "@/components/DocumentViewer";

interface DocumentPageProps {
  documentId: string;
}

const DocumentPage: React.FC<DocumentPageProps> = ({ documentId }) => {
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

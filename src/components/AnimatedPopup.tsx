import React, { useEffect, useState } from "react";
import { X, Copy } from "lucide-react";

interface ClauseItem {
  type: string;
  title: string;
  text: string;
  page: number;
  reference_code: string | null;
  references: Array<{
    text: string;
    page: number;
    target_content_id: number;
    link_text: string | null;
  }>;
}

interface HyperlinkText {
  link_text: string;
  has_clauses: boolean;
  full_definition?: {
    term: string;
    text: string;
    page: number;
    reference_code: string | null;
    hasDefinitionTerm: boolean;
  };
  clauses?: ClauseItem[];
  clause_count?: number;
}

interface AnimatedPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  maxWidth?: string;
  copyText?: string;
  hyperlinkText?: HyperlinkText;
}

const AnimatedPopup: React.FC<AnimatedPopupProps> = ({
  isOpen,
  onClose,
  title,
  children,
  copyText,
  hyperlinkText,
  maxWidth = "max-w-2xl",
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleCopy = () => {
    const textToCopy = copyText || hyperlinkText?.link_text || "";
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
    }
  };

  // Helper function to render references in text
  const renderTextWithReferences = (
    text: string,
    references: ClauseItem["references"]
  ) => {
    if (!references || references.length === 0) return <span>{text}</span>;

    const result: React.ReactNode[] = [];
    let lastIndex = 0;

    references.forEach((ref, idx) => {
      const refText = ref.text;
      const refIndex = text.indexOf(refText, lastIndex);

      if (refIndex !== -1) {
        // Add text before reference
        if (refIndex > lastIndex) {
          result.push(
            <span key={`text-${idx}`}>
              {text.substring(lastIndex, refIndex)}
            </span>
          );
        }

        // Add reference with tooltip
        result.push(
          <span
            key={`ref-${idx}`}
            className="text-blue-600 cursor-help underline decoration-dotted"
            title={ref.link_text || "Definition"}
          >
            {refText}
          </span>
        );

        lastIndex = refIndex + refText.length;
      }
    });

    // Add remaining text
    if (lastIndex < text.length) {
      result.push(<span key="final">{text.substring(lastIndex)}</span>);
    }

    return <>{result}</>;
  };

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/20 transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Popup */}
      <div
        className={`relative bg-white rounded-lg shadow-xl ${maxWidth} w-full mx-4 max-h-[80vh] flex flex-col transition-all duration-300 transform ${
          isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              title="Copy definition"
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              <Copy size={18} />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto">
          {hyperlinkText ? (
            <div className="space-y-3">
              {/* Main definition text */}
              {hyperlinkText.full_definition ? (
                <div>
                  <div className="text-gray-700 mt-1">
                    {hyperlinkText.full_definition.text}
                  </div>
                </div>
              ) : (
                <div className="text-gray-700">{hyperlinkText.link_text}</div>
              )}

              {/* Clauses - simple list */}
              {hyperlinkText.clauses && hyperlinkText.clauses.length > 0 && (
                <div className="mt-3">
                  {hyperlinkText.clauses.map((clause, index) => (
                    <div key={index} className="ml-2 mt-1">
                      <div className="flex">
                        <span className="font-medium min-w-[1.5rem]">
                          {clause.title.replace(/[()]/g, "")}.
                        </span>
                        <div className="text-gray-700">
                          {renderTextWithReferences(
                            clause.text,
                            clause.references
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
};

export default AnimatedPopup;

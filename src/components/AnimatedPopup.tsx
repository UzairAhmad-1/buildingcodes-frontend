import React, { useEffect, useState } from "react";
import { X, Copy } from "lucide-react";

interface AnimatedPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  copyText?: string; // NEW PROP
}

const AnimatedPopup: React.FC<AnimatedPopupProps> = ({
  isOpen,
  onClose,
  title,
  children,
  copyText,
  maxWidth = "max-w-3xl",
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
      const t = setTimeout(() => setShouldRender(false), 250);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  const handleCopy = () => {
    if (copyText) navigator.clipboard.writeText(copyText);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Popup */}
      <div
        className={`
          relative bg-white rounded-xl shadow-xl 
          ${maxWidth} w-full mx-4 transition-all duration-300 transform 
          ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          title="Close"
          onClick={onClose}
          className="absolute cursor-pointer top-4 right-4 text-gray-500 hover:text-gray-700 transition p-1 rounded-full hover:bg-gray-100"
        >
          <X size={20} />
        </button>

        <div className="p-6">
          {title && (
            <div className="flex items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900 mr-2">
                {title}
              </h3>

              <button
                onClick={handleCopy}
                title="Copy definition"
                className="text-gray-600 hover:text-gray-900 p-1.5 rounded-md hover:bg-gray-100 transition"
              >
                <Copy size={18} />
              </button>
            </div>
          )}

          {/* Children rendered exactly as provided */}
          {children}
        </div>
      </div>
    </div>
  );
};

export default AnimatedPopup;

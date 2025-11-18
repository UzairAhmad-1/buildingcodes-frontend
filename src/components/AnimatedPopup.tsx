// src/components/ui/AnimatedPopup.tsx
import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

interface AnimatedPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

const AnimatedPopup: React.FC<AnimatedPopupProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-2xl",
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Small delay to ensure DOM is ready before starting animation
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Don't render anything if popup shouldn't be visible
  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with fade animation */}
      <div
        className={`absolute inset-0 bg-gray-500/30 backdrop-blur-[1px] transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Popup container with scale and fade animation */}
      <div
        className={`relative bg-white border border-gray-200 rounded-xl shadow-2xl ${maxWidth} w-full mx-4 transition-all duration-300 transform ${
          isVisible
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-4"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          title="Close"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100 z-10"
        >
          <X size={20} />
        </button>

        {/* Content */}
        <div className="p-6">
          {title && (
            <h3 className="font-semibold text-gray-900 mb-4 text-xl pr-8">
              {title}
            </h3>
          )}
          <div className={title ? "pr-2" : "pr-2"}>{children}</div>
        </div>
      </div>
    </div>
  );
};

export default AnimatedPopup;

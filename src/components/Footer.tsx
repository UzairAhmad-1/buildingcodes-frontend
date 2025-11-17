// src/components/Footer.tsx
import React from "react";

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-200 py-3.5 sticky bottom-0 z-40">
      <div className="max-w-[1800px] mx-auto px-8">
        <div className="flex items-center justify-center space-x-4 text-xs text-black uppercase">
          <span>©2025 CODECHECK</span>

          <a href="#" className="hover:underline">
            PRIVACY POLICY
          </a>

          <a href="#" className="hover:underline">
            TERMS OF SERVICE
          </a>

          <a href="#" className="hover:underline">
            HELP
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

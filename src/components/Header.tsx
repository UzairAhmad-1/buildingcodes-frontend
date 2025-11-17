// src/components/Header.tsx
import React from "react";
import { User } from "lucide-react";
import { useRouter } from "next/router";

const Header: React.FC = () => {
  const router = useRouter();

  return (
    <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-8 py-1.5 flex items-center justify-between">
        {/* Left Section - Logo & Nav */}
        <div className="flex items-center space-x-12">
          {/* Logo + Title */}
          <div
            onClick={() => router.push("/")}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <span className="text-2xl font-bold transition-colors duration-200">
              <span className="text-black ">code</span>
              <span className="text-[#3fe0cf] ">chek</span>
              <span className="text-black">.ai</span>
            </span>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-2">
            <button className="px-4 py-2 text-sm font-medium text-black bg-gray-200 rounded border border-gray-300 hover:bg-gray-250 cursor-pointer">
              LIBRARY
            </button>
          </nav>
        </div>

        {/* Right Section - Profile Icon */}
        <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors duration-200 cursor-pointer">
          <User className="h-5 w-5 text-black" />
        </div>
      </div>
    </header>
  );
};

export default Header;

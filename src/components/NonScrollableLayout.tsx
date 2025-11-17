// components/NonScrollableLayout.tsx
import React, { useEffect } from "react";
import Header from "./Header";
import Footer from "./Footer";

interface NonScrollableLayoutProps {
  children: React.ReactNode;
}

const NonScrollableLayout: React.FC<NonScrollableLayoutProps> = ({
  children,
}) => {
  useEffect(() => {
    // Disable scrolling
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    // Re-enable on unmount
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      <div className="flex-1 overflow-hidden">{children}</div>
      <Footer />
    </div>
  );
};

export default NonScrollableLayout;

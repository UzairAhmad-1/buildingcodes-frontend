// components/VirtualizedContent.tsx
import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { HierarchyNode } from "@/types/buildingCode";

interface VirtualizedContentProps {
  items: HierarchyNode[];
  renderItem: (item: HierarchyNode) => React.ReactNode;
  estimateSize?: number;
  overscan?: number;
}

const VirtualizedContent: React.FC<VirtualizedContentProps> = ({
  items,
  renderItem,
  estimateSize = 100,
  overscan = 5,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: overscan,
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index];
          return (
            <div
              key={item.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(item)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VirtualizedContent;

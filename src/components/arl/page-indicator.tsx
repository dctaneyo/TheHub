"use client";

import { motion, LayoutGroup } from "framer-motion";
import { cn } from "@/lib/utils";

interface PageIndicatorProps {
  pages: Array<{ id: string; label: string }>;
  currentPageId: string;
  onPageChange?: (pageId: string) => void;
  className?: string;
}

const dotTransition = { type: "spring" as const, stiffness: 400, damping: 28, mass: 0.8 };

export function PageIndicator({ pages, currentPageId, onPageChange, className }: PageIndicatorProps) {
  return (
    <div className={cn("w-full flex items-center justify-center gap-1.5 py-2.5", className)}>
      <LayoutGroup>
        {pages.map((page) => {
          const isActive = page.id === currentPageId;
          
          return (
            <motion.button
              key={page.id}
              onClick={() => onPageChange?.(page.id)}
              layout
              transition={dotTransition}
              className={cn(
                "relative h-2 rounded-full overflow-hidden",
                isActive
                  ? "bg-[var(--hub-red)]"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50 w-2"
              )}
              style={isActive ? { paddingLeft: 10, paddingRight: 10 } : undefined}
              whileTap={{ scale: 0.92 }}
            >
              {isActive && (
                <span
                  className="text-[9px] leading-[8px] font-semibold text-white whitespace-nowrap select-none"
                >
                  {page.label}
                </span>
              )}
            </motion.button>
          );
        })}
      </LayoutGroup>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PageIndicatorProps {
  pages: Array<{ id: string; label: string }>;
  currentPageId: string;
  onPageChange?: (pageId: string) => void;
  className?: string;
}

export function PageIndicator({ pages, currentPageId, onPageChange, className }: PageIndicatorProps) {
  const currentIndex = pages.findIndex(p => p.id === currentPageId);
  
  return (
    <div className={cn("flex items-center justify-center gap-1.5 py-2", className)}>
      {pages.map((page, index) => {
        const isActive = page.id === currentPageId;
        const isCurrentPage = index === currentIndex;
        
        return (
          <motion.button
            key={page.id}
            onClick={() => onPageChange?.(page.id)}
            className={cn(
              "relative flex items-center transition-all duration-300",
              isCurrentPage ? "w-auto px-3 py-1.5" : "w-2 h-2"
            )}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              className={cn(
                "w-full h-full rounded-full transition-all duration-300",
                isActive 
                  ? "bg-[var(--hub-red)] shadow-lg" 
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              layoutId="activePage"
            />
            
            {/* Page name pill for current page */}
            {isCurrentPage && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="absolute left-full ml-2 text-xs font-medium text-foreground whitespace-nowrap bg-[var(--hub-red)] text-white px-2 py-0.5 rounded-full"
                layoutId="pageLabel"
              >
                {page.label}
              </motion.span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

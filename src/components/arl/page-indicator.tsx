"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface PageIndicatorProps {
  pages: Array<{ id: string; label: string }>;
  currentPageId: string;
  onPageChange?: (pageId: string) => void;
  className?: string;
}

export function PageIndicator({ pages, currentPageId, onPageChange, className }: PageIndicatorProps) {
  return (
    <div className={cn("w-full flex items-center justify-center gap-2 py-2.5", className)}>
      <AnimatePresence mode="popLayout">
        {pages.map((page) => {
          const isActive = page.id === currentPageId;
          
          return (
            <motion.button
              key={page.id}
              onClick={() => onPageChange?.(page.id)}
              layout
              initial={false}
              animate={{
                width: isActive ? "auto" : 8,
                height: 8,
              }}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 30,
              }}
              className={cn(
                "rounded-full flex items-center justify-center overflow-hidden",
                isActive 
                  ? "bg-[var(--hub-red)] px-2.5 py-0" 
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              style={{ minHeight: 8 }}
              whileTap={{ scale: 0.95 }}
            >
              {isActive && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-[10px] leading-none font-semibold text-white whitespace-nowrap"
                  style={{ lineHeight: '8px' }}
                >
                  {page.label}
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

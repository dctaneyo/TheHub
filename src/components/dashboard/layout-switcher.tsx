"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useLayout, LAYOUT_OPTIONS, type DashboardLayout } from "@/lib/layout-context";

const layoutPreviews: Record<DashboardLayout, string> = {
  classic: "┃ ▐ ████ ▌ ┃",
  focus: "┃ ▌ ■ ▪▪ ┃",
};

export function LayoutSwitcher() {
  const { layout, setLayout } = useLayout();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
          open
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
        title="Switch layout"
      >
        <LayoutGrid className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-10 z-[200] w-64 rounded-2xl border border-border bg-card shadow-xl overflow-hidden"
          >
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Dashboard Layout
              </p>
            </div>
            <div className="p-1.5 space-y-0.5">
              {LAYOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => { setLayout(opt.id); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    layout === opt.id
                      ? "bg-[var(--hub-red)]/10 text-[var(--hub-red)]"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-10 shrink-0 items-center justify-center rounded-lg font-mono text-[7px] leading-none border",
                    layout === opt.id
                      ? "border-[var(--hub-red)]/30 bg-[var(--hub-red)]/5"
                      : "border-border bg-muted/50"
                  )}>
                    <span className="opacity-60">{layoutPreviews[opt.id]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium",
                      layout === opt.id && "font-bold"
                    )}>
                      {opt.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      {opt.description}
                    </p>
                  </div>
                  {layout === opt.id && (
                    <div className="h-2 w-2 rounded-full bg-[var(--hub-red)]" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

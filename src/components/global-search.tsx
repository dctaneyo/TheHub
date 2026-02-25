"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, FileText, MessageCircle, ClipboardList, Store, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

interface SearchResult {
  type: "task" | "message" | "form" | "location";
  id: string;
  title: string;
  subtitle: string;
  metadata?: any;
}

const typeIcons: Record<string, any> = {
  task: ClipboardList,
  message: MessageCircle,
  form: FileText,
  location: Store,
};

const typeColors: Record<string, string> = {
  task: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  message: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  form: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  location: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

const typeLabels: Record<string, string> = {
  task: "Task",
  message: "Message",
  form: "Form",
  location: "Location",
};

type FilterType = "all" | "tasks" | "messages" | "forms" | "locations";

export function GlobalSearch({ onNavigate }: { onNavigate?: (type: string, id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  // Keyboard shortcut to open search (Cmd/Ctrl + K)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  const search = useCallback(async (q: string, f: FilterType) => {
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=${f}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setSelectedIndex(0);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => search(query, filter), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, filter, search]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  const handleSelect = (result: SearchResult) => {
    onNavigate?.(result.type, result.id);
    setOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filters: { id: FilterType; label: string }[] = [
    { id: "all", label: "All" },
    { id: "tasks", label: "Tasks" },
    { id: "messages", label: "Messages" },
    { id: "forms", label: "Forms" },
    { id: "locations", label: "Locations" },
  ];

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground hover:bg-accent transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline">⌘K</kbd>
      </button>

      {/* Search modal */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm"
            />
            <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-[15vh]">
              <motion.div
                ref={containerRef}
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.15 }}
                className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl"
              >
                {/* Input */}
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search tasks, messages, forms, locations..."
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  />
                  {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-accent">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Filters */}
                <div className="flex gap-1 border-b border-border px-4 py-2">
                  {filters.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                        filter === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Results */}
                <div className="max-h-[50vh] overflow-y-auto p-2">
                  {query.length < 2 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      Type at least 2 characters to search
                    </div>
                  ) : results.length === 0 && !loading ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      No results found for &ldquo;{query}&rdquo;
                    </div>
                  ) : (
                    results.map((result, i) => {
                      const Icon = typeIcons[result.type] || FileText;
                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleSelect(result)}
                          onMouseEnter={() => setSelectedIndex(i)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                            selectedIndex === i ? "bg-accent" : "hover:bg-accent/50"
                          )}
                        >
                          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", typeColors[result.type])}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{result.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{result.subtitle}</p>
                          </div>
                          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {typeLabels[result.type]}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
                  <span>↑↓ to navigate • Enter to select • Esc to close</span>
                  <span>{results.length} result{results.length !== 1 ? "s" : ""}</span>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Download, FolderOpen, X, Mail, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Form {
  id: string;
  title: string;
  description: string | null;
  category: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
}

const CATEGORIES = ["general", "hr", "operations", "safety", "training", "finance"];

function categoryLabel(cat: string): string {
  if (cat === "hr") return "HR";
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    hr: "bg-purple-100 text-purple-700",
    operations: "bg-blue-100 text-blue-700",
    safety: "bg-red-100 text-red-700",
    training: "bg-green-100 text-green-700",
    finance: "bg-amber-100 text-amber-700",
    general: "bg-slate-100 text-slate-600",
  };
  return map[cat] || map.general;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FormsViewerProps {
  onClose: () => void;
}

export function FormsViewer({ onClose }: FormsViewerProps) {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const fetchForms = useCallback(async () => {
    try {
      const res = await fetch("/api/forms");
      if (res.ok) {
        const data = await res.json();
        setForms(data.forms || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchForms(); }, [fetchForms]);

  const handleEmailSelf = async (form: Form) => {
    setSendingId(form.id);
    setEmailError(null);
    try {
      const res = await fetch("/api/forms/email-self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId: form.id }),
      });
      if (res.ok) {
        setSentId(form.id);
        setTimeout(() => setSentId(null), 3000);
      } else {
        const d = await res.json();
        setEmailError(d.error || "Failed to send");
        setTimeout(() => setEmailError(null), 3000);
      }
    } catch {
      setEmailError("Failed to send");
      setTimeout(() => setEmailError(null), 3000);
    } finally {
      setSendingId(null);
    }
  };

  const filtered = filterCat === "all" ? forms : forms.filter((f) => f.category === filterCat);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--hub-red)]">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Forms Repository</h2>
              <p className="text-[10px] text-slate-400">{forms.length} forms available</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Category filter */}
        <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-slate-100 px-5 py-3">
          {["all", ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={cn(
                "rounded-lg px-3 py-1 text-[11px] font-medium transition-colors",
                filterCat === cat
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              )}
            >
              {cat === "all" ? "All" : categoryLabel(cat)}
            </button>
          ))}
        </div>

        {/* Forms list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex h-40 items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--hub-red)]" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200">
              <div className="text-center">
                <FolderOpen className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-400">No forms in this category</p>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {filtered.map((form, i) => (
              <motion.div
                key={form.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[var(--hub-red)]">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-800">{form.title}</p>
                    <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium", categoryColor(form.category))}>
                      {categoryLabel(form.category)}
                    </span>
                  </div>
                  {form.description && (
                    <p className="mt-0.5 truncate text-xs text-slate-500">{form.description}</p>
                  )}
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {formatBytes(form.fileSize)} · {format(new Date(form.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => handleEmailSelf(form)}
                    disabled={sendingId === form.id}
                    title={sentId === form.id ? "Sent!" : "Email to my restaurant"}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                      sentId === form.id
                        ? "bg-green-100 text-green-600"
                        : "bg-blue-50 text-blue-500 hover:bg-blue-100"
                    )}
                  >
                    {sendingId === form.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                  </button>
                  <a
                    href={`/api/forms/download?id=${form.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hub-red)]/10 text-[var(--hub-red)] hover:bg-[var(--hub-red)]/20 transition-colors"
                    title="Download PDF"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

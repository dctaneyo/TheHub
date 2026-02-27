"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  Trash2,
  Download,
  Plus,
  X,
  Loader2,
  FolderOpen,
  Mail,
  CheckSquare,
  Square,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Form {
  id: string;
  title: string;
  description: string | null;
  category: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: string;
}

interface Recipient {
  id: string;
  name: string;
  email: string | null;
  kind: "location" | "arl";
}

const CATEGORIES = ["general", "hr", "operations", "safety", "training", "finance"];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function categoryLabel(cat: string): string {
  if (cat === "hr") return "HR";
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    hr: "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400",
    operations: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
    safety: "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400",
    training: "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400",
    finance: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
    general: "bg-muted text-muted-foreground",
  };
  return map[cat] || map.general;
}

export function FormsRepository() {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [uploadData, setUploadData] = useState({ title: "", description: "", category: "general" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email state
  const [emailForm, setEmailForm] = useState<Form | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  const fetchForms = useCallback(async () => {
    try {
      const res = await fetch("/api/forms");
      if (res.ok) {
        const data = await res.json();
        setForms(data.forms);
      }
    } catch (err) {
      console.error("Failed to fetch forms:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  const handleUpload = async () => {
    if (!selectedFile || !uploadData.title.trim()) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("title", uploadData.title.trim());
      fd.append("description", uploadData.description);
      fd.append("category", uploadData.category);
      const res = await fetch("/api/forms", { method: "POST", body: fd });
      if (res.ok) {
        setShowUpload(false);
        setUploadData({ title: "", description: "", category: "general" });
        setSelectedFile(null);
        await fetchForms();
      }
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this form?")) return;
    try {
      await fetch("/api/forms", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      setForms((prev) => prev.filter((f) => f.id !== id));
    } catch {}
  };

  const fetchRecipients = useCallback(async () => {
    try {
      const res = await fetch("/api/locations");
      if (res.ok) {
        const data = await res.json();
        const locs: Recipient[] = (data.locations || []).map((l: { id: string; name: string; email: string | null }) => ({
          id: l.id, name: l.name, email: l.email, kind: "location" as const,
        }));
        const arls: Recipient[] = (data.arls || []).map((a: { id: string; name: string; email: string | null }) => ({
          id: a.id, name: a.name, email: a.email, kind: "arl" as const,
        }));
        setRecipients([...locs, ...arls]);
      }
    } catch {}
  }, []);

  const openEmailModal = (form: Form) => {
    setEmailForm(form);
    setSelectedRecipients(new Set());
    setEmailSuccess(null);
    fetchRecipients();
  };

  const toggleRecipient = (id: string) => {
    setSelectedRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSendEmail = async () => {
    if (!emailForm || selectedRecipients.size === 0) return;
    setSending(true);
    try {
      const chosen = recipients.filter((r) => selectedRecipients.has(r.id) && r.email);
      const emails = chosen.map((r) => r.email as string);
      if (emails.length === 0) {
        setEmailSuccess("No valid email addresses for selected recipients.");
        return;
      }
      const res = await fetch("/api/forms/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId: emailForm.id, recipientEmails: emails }),
      });
      if (res.ok) {
        setEmailSuccess(`Sent to ${emails.length} recipient${emails.length > 1 ? "s" : ""}!`);
        setTimeout(() => { setEmailForm(null); setEmailSuccess(null); }, 2000);
      } else {
        const d = await res.json();
        setEmailSuccess(d.error || "Failed to send.");
      }
    } catch {
      setEmailSuccess("Failed to send.");
    } finally {
      setSending(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".pdf")) setSelectedFile(file);
  };

  const filtered = filterCat === "all" ? forms : forms.filter((f) => f.category === filterCat);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--hub-red)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">Forms Repository</h3>
          <p className="text-xs text-muted-foreground">{forms.length} forms · {filtered.length} shown</p>
        </div>
        <Button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--hub-red)] text-xs hover:bg-[#c4001f]"
          size="sm"
        >
          <Plus className="h-3.5 w-3.5" />
          Upload PDF
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        {["all", ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={cn(
              "rounded-lg px-3 py-1 text-[11px] font-medium capitalize transition-colors",
              filterCat === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {cat === "all" ? "All" : categoryLabel(cat)}
          </button>
        ))}
      </div>

      {/* Forms list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border">
            <div className="text-center">
              <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No forms yet</p>
            </div>
          </div>
        )}
        {filtered.map((form, i) => (
          <motion.div
            key={form.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-[var(--hub-red)]">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{form.title}</p>
                <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium", categoryColor(form.category))}>
                  {categoryLabel(form.category)}
                </span>
              </div>
              {form.description && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{form.description}</p>
              )}
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {form.fileName} · {formatBytes(form.fileSize)} · {format(new Date(form.createdAt), "MMM d, yyyy")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => openEmailModal(form)}
                title="Email to restaurant/ARL"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <Mail className="h-4 w-4" />
              </button>
              <a
                href={`/api/forms/download?id=${form.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Download className="h-4 w-4" />
              </a>
              <button
                onClick={() => handleDelete(form.id)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Email modal */}
      <AnimatePresence>
        {emailForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground">Email Form</h3>
                  <p className="text-xs text-muted-foreground truncate max-w-[260px]">{emailForm.title}</p>
                </div>
                <button onClick={() => setEmailForm(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {emailSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                    <Send className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{emailSuccess}</p>
                </div>
              ) : (
                <>
                  <p className="mb-3 text-xs font-medium text-muted-foreground">Select recipients to send this form to:</p>
                  <div className="max-h-72 overflow-y-auto space-y-1 rounded-2xl border border-border p-2">
                    {recipients.length === 0 && (
                      <div className="flex h-16 items-center justify-center">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-[var(--hub-red)]" />
                      </div>
                    )}
                    {recipients.map((r) => {
                      const checked = selectedRecipients.has(r.id);
                      const hasEmail = !!r.email;
                      return (
                        <button
                          key={r.id}
                          onClick={() => hasEmail && toggleRecipient(r.id)}
                          disabled={!hasEmail}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                            checked ? "border-[var(--hub-red)]/30 bg-red-50" : "border-border bg-card hover:bg-muted",
                            !hasEmail && "opacity-40 cursor-not-allowed"
                          )}
                        >
                          {checked ? (
                            <CheckSquare className="h-4 w-4 shrink-0 text-[var(--hub-red)]" />
                          ) : (
                            <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            r.kind === "location" ? "bg-muted text-muted-foreground" : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                          )}>
                            {r.kind === "location" ? "🏪" : "👤"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="flex-1 truncate text-xs font-medium text-foreground">{r.name}</p>
                            <p className="text-[10px] text-muted-foreground">{r.email || "No email"}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <Button
                    onClick={handleSendEmail}
                    disabled={selectedRecipients.size === 0 || sending}
                    className="mt-3 w-full rounded-xl bg-[var(--hub-red)] hover:bg-[#c4001f]"
                  >
                    {sending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                    ) : (
                      <><Send className="mr-2 h-4 w-4" /> Send to {selectedRecipients.size} recipient{selectedRecipients.size !== 1 ? 's' : ''}</>
                    )}
                  </Button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

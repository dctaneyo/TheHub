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
    hr: "bg-purple-100 text-purple-700",
    operations: "bg-blue-100 text-blue-700",
    safety: "bg-red-100 text-red-700",
    training: "bg-green-100 text-green-700",
    finance: "bg-amber-100 text-amber-700",
    general: "bg-slate-100 text-slate-600",
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
          <h3 className="text-base font-bold text-slate-800">Forms Repository</h3>
          <p className="text-xs text-slate-400">{forms.length} forms uploaded</p>
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
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            )}
          >
            {cat === "all" ? "All" : categoryLabel(cat)}
          </button>
        ))}
      </div>

      {/* Forms list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200">
            <div className="text-center">
              <FolderOpen className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-400">No forms yet</p>
            </div>
          </div>
        )}
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
                {form.fileName} · {formatBytes(form.fileSize)} · {format(new Date(form.createdAt), "MMM d, yyyy")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => openEmailModal(form)}
                title="Email to restaurant/ARL"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-500"
              >
                <Mail className="h-4 w-4" />
              </button>
              <a
                href={`/api/forms/download?id=${form.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <Download className="h-4 w-4" />
              </a>
              <button
                onClick={() => handleDelete(form.id)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
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
                  <h3 className="text-base font-bold text-slate-800">Email Form</h3>
                  <p className="text-xs text-slate-400 truncate max-w-[260px]">{emailForm.title}</p>
                </div>
                <button onClick={() => setEmailForm(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {emailSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <Send className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">{emailSuccess}</p>
                </div>
              ) : (
                <>
                  <p className="mb-3 text-xs font-medium text-slate-500">Select recipients to send this form to:</p>
                  <div className="max-h-72 overflow-y-auto space-y-1 rounded-2xl border border-slate-100 p-2">
                    {recipients.length === 0 && (
                      <div className="flex h-16 items-center justify-center">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--hub-red)]" />
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
                            checked ? "bg-blue-50" : "hover:bg-slate-50",
                            !hasEmail && "opacity-40 cursor-not-allowed"
                          )}
                        >
                          {checked ? (
                            <CheckSquare className="h-4 w-4 shrink-0 text-blue-500" />
                          ) : (
                            <Square className="h-4 w-4 shrink-0 text-slate-300" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-700">{r.name}</p>
                            <p className="truncate text-[10px] text-slate-400">
                              {r.email || "No email on file"} · {r.kind === "location" ? "Restaurant" : "ARL"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-400">{selectedRecipients.size} selected</p>
                    <Button
                      onClick={handleSendEmail}
                      disabled={selectedRecipients.size === 0 || sending}
                      className="rounded-xl bg-[var(--hub-red)] text-xs hover:bg-[#c4001f]"
                      size="sm"
                    >
                      {sending ? (
                        <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Sending...</>
                      ) : (
                        <><Send className="mr-1.5 h-3.5 w-3.5" /> Send Email</>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload modal */}
      <AnimatePresence>
        {showUpload && (
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
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800">Upload PDF Form</h3>
                <button onClick={() => setShowUpload(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-8 transition-colors",
                    dragOver ? "border-[var(--hub-red)] bg-red-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                    selectedFile && "border-green-400 bg-green-50"
                  )}
                >
                  {selectedFile ? (
                    <>
                      <FileText className="h-8 w-8 text-green-500" />
                      <p className="mt-2 text-sm font-medium text-green-700">{selectedFile.name}</p>
                      <p className="text-xs text-green-500">{formatBytes(selectedFile.size)}</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-slate-300" />
                      <p className="mt-2 text-sm text-slate-500">Drop PDF here or click to browse</p>
                      <p className="text-xs text-slate-400">PDF files only</p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Title *</label>
                  <Input
                    value={uploadData.title}
                    onChange={(e) => setUploadData((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Employee Handbook 2025"
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
                  <Input
                    value={uploadData.description}
                    onChange={(e) => setUploadData((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Optional description"
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Category</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setUploadData((p) => ({ ...p, category: cat }))}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                          uploadData.category === cat
                            ? "bg-slate-800 text-white"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || !uploadData.title.trim() || uploading}
                  className="w-full rounded-xl bg-[var(--hub-red)] hover:bg-[#c4001f]"
                >
                  {uploading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
                  ) : (
                    <><Upload className="mr-2 h-4 w-4" /> Upload Form</>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

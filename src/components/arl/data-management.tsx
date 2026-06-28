"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Trash2, Database, AlertTriangle, CheckCircle2, Download, Calendar,
  HardDrive, Unlink, Shield, ListChecks, Copy, Upload,
  BarChart3, RefreshCw, X, Archive, ScrollText, ChevronDown, ChevronUp,
} from "@/lib/icons";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { NotificationTester } from "@/components/arl/notification-tester";
import { DataManagementHealth, type SystemReport, type IntegrityResult, type DuplicateResult } from "@/components/arl/data-management-health";
import { DataManagementAuditLog } from "@/components/arl/data-management-audit-log";

type ConfirmAction = {
  id: string;
  title: string;
  confirmText: string;
  action: () => Promise<void>;
};

export function DataManagement() {
  const [processing, setProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState<ConfirmAction | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Destructive/irreversible operations are collapsed by default — opening
  // this is a deliberate "I want to see the dangerous stuff" step, not
  // something every visit to this page should expose at the same visibility
  // as routine maintenance (Section 12).
  const [showDestructive, setShowDestructive] = useState(false);

  // Health monitor state
  const [report, setReport] = useState<SystemReport | null>(null);
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateResult | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const clearAlerts = () => { setSuccess(null); setError(null); };

  const fetchReport = useCallback(async () => {
    setLoadingReport(true);
    try {
      const [rptRes, intRes, dupRes] = await Promise.all([
        fetch("/api/data-management/system-report"),
        fetch("/api/data-management/integrity-check"),
        fetch("/api/data-management/duplicate-check"),
      ]);
      if (rptRes.ok) setReport(await rptRes.json());
      if (intRes.ok) setIntegrity(await intRes.json());
      if (dupRes.ok) setDuplicates(await dupRes.json());
    } catch {} finally { setLoadingReport(false); }
  }, []);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // ── Helper to run an action with loading/success/error handling ──
  const runAction = async (fn: () => Promise<string>) => {
    setProcessing(true);
    clearAlerts();
    try {
      const msg = await fn();
      setSuccess(msg);
      setShowConfirm(null);
      fetchReport();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  // ── Actions ──
  const purgeMessages = () => runAction(async () => {
    const res = await fetch("/api/data-management/purge-messages", { method: "POST" });
    if (!res.ok) throw new Error((await res.json()).error);
    const d = await res.json();
    return `Purged ${d.deletedMessages || 0} messages, ${d.deletedReads || 0} reads, ${d.deletedReactions || 0} reactions`;
  });

  const purgeConversations = () => runAction(async () => {
    const res = await fetch("/api/data-management/purge-conversations", { method: "POST" });
    if (!res.ok) throw new Error((await res.json()).error);
    const d = await res.json();
    return `Purged ${d.deletedConversations || 0} conversations, ${d.deletedMessages || 0} messages, ${d.deletedReads || 0} reads, ${d.deletedReactions || 0} reactions, ${d.deletedMembers || 0} members`;
  });

  const purgeOldTasks = () => runAction(async () => {
    const res = await fetch("/api/data-management/purge-old-tasks", { method: "POST" });
    if (!res.ok) throw new Error((await res.json()).error);
    const d = await res.json();
    return `Purged ${d.deletedCompletions || 0} old task completions (>90 days)`;
  });

  const vacuumDb = () => runAction(async () => {
    const res = await fetch("/api/data-management/vacuum", { method: "POST" });
    if (!res.ok) throw new Error((await res.json()).error);
    const d = await res.json();
    return `Database optimized: ${d.sizeBeforeFormatted} → ${d.sizeAfterFormatted} (saved ${d.savedFormatted})`;
  });

  const orphanedCleanup = () => runAction(async () => {
    const res = await fetch("/api/data-management/orphaned-cleanup", { method: "POST" });
    if (!res.ok) throw new Error((await res.json()).error);
    const d = await res.json();
    return `Cleaned ${d.total} orphaned records (${d.orphanedMessages} messages, ${d.orphanedReads} reads, ${d.orphanedReactions} reactions, ${d.orphanedCompletions} completions)`;
  });

  const clearSessions = (mode: string, label: string) => () => runAction(async () => {
    const res = await fetch("/api/data-management/clear-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    const d = await res.json();
    return `${label}: cleared ${d.deleted} sessions`;
  });

  const bulkTasks = (action: string, label: string) => () => runAction(async () => {
    const res = await fetch("/api/data-management/bulk-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    const d = await res.json();
    return `${label}: removed ${d.deleted} completions`;
  });

  const removeDuplicates = () => runAction(async () => {
    const res = await fetch("/api/data-management/duplicate-check", { method: "POST" });
    if (!res.ok) throw new Error((await res.json()).error);
    const d = await res.json();
    return `Removed ${d.total} duplicates (${d.removedCompletions} completions, ${d.removedSessions} sessions)`;
  });

  const exportData = async () => {
    setProcessing(true);
    clearAlerts();
    try {
      const res = await fetch("/api/data-management/export");
      if (!res.ok) throw new Error((await res.json()).error);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hub-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSuccess("Data exported successfully");
    } catch (err: any) {
      setError(err?.message || "Export failed");
    } finally {
      setProcessing(false);
    }
  };

  const importData = async (file: File) => {
    setProcessing(true);
    clearAlerts();
    try {
      const text = await file.text();
      JSON.parse(text); // validate JSON
      setSuccess(`File "${file.name}" validated (${(file.size / 1024).toFixed(1)} KB). Import functionality coming soon.`);
    } catch {
      setError("Invalid JSON file");
    } finally {
      setProcessing(false);
    }
  };

  const dropUnusedTables = () => runAction(async () => {
    const res = await fetch("/api/data-management/drop-tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tables: ["onboarding_custom_forms", "onboarding_sessions", "onboarding_submissions"] }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    const d = await res.json();
    return `Dropped ${d.dropped.length} unused table(s): ${d.dropped.join(", ") || "none"}${d.skipped.length > 0 ? ` (skipped: ${d.skipped.join(", ")})` : ""}`;
  });

  const purgeBroadcastData = () => runAction(async () => {
    const res = await fetch("/api/data-management/purge-broadcast-data", { method: "POST" });
    if (!res.ok) throw new Error((await res.json()).error);
    const d = await res.json();
    return `Purged broadcast data: ${d.deletedBroadcasts} broadcasts, ${d.deletedMessages} messages, ${d.deletedQuestions} questions, ${d.deletedReactions} reactions, ${d.deletedViewers} viewers`;
  });

  const purgeNotifications = () => runAction(async () => {
    const res = await fetch("/api/data-management/purge-notifications", { method: "POST" });
    if (!res.ok) throw new Error((await res.json()).error);
    const d = await res.json();
    return `Purged ${d.deletedNotifications} notifications, ${d.deletedEmergency} emergency messages`;
  });

  const archiveOldData = (dataType: string, daysOld: number, label: string) => () => runAction(async () => {
    const res = await fetch("/api/data-management/archive-old-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataType, daysOld }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    const d = await res.json();
    return `${label}: archived ${d.archived} records older than ${daysOld} days`;
  });

  const viewAuditLog = async () => {
    setLoadingAudit(true);
    setShowAuditLog(true);
    clearAlerts();
    try {
      const res = await fetch("/api/data-management/audit-log?limit=200");
      if (!res.ok) throw new Error((await res.json()).error);
      const d = await res.json();
      setAuditLogs(d.logs || []);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch audit log");
      setShowAuditLog(false);
    } finally {
      setLoadingAudit(false);
    }
  };

  const viewAnalytics = async () => {
    setProcessing(true);
    clearAlerts();
    try {
      const res = await fetch("/api/data-management/usage-analytics");
      if (!res.ok) throw new Error((await res.json()).error);
      const d = await res.json();
      setSuccess(`Analytics: ${d.topLocations?.length || 0} locations tracked. ${d.completionTrends?.length || 0} days of trend data.`);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch analytics");
    } finally {
      setProcessing(false);
    }
  };

  const confirm = (id: string, title: string, confirmText: string, action: () => Promise<void>) => {
    setShowConfirm({ id, title, confirmText, action });
  };

  // ── Section definitions, split by actual severity rather than feature
  // area — every card here is either routine/reversible (safe tier, visible
  // by default) or a permanent deletion / account-wide disruption
  // (destructive tier, collapsed by default; see showDestructive). A card's
  // color used to be picked per-card from an 11-hue palette with no shared
  // meaning (Section 11); now color comes entirely from which tier a card is
  // in (Section 7/8's ActionCard below), not from a per-card choice. ──
  const safeSections = [
    {
      title: "Maintenance",
      subtitle: "Keep the database healthy and performant.",
      cards: [
        { id: "vacuum", icon: HardDrive, title: "Optimize Database", desc: "Vacuum and rebuild indexes for better performance.", btn: "Optimize", onClick: () => confirm("vacuum", "Optimize Database", "This will vacuum the database and rebuild indexes. Safe operation.", vacuumDb) },
        { id: "orphaned", icon: Unlink, title: "Orphaned Data Cleanup", desc: "Remove records with broken references.", btn: "Clean Orphans", onClick: () => confirm("orphaned", "Orphaned Data Cleanup", "This will remove messages without conversations, reads without messages, etc.", orphanedCleanup) },
        { id: "dupes", icon: Copy, title: "Remove Duplicates", desc: "Find and remove duplicate records.", btn: "Remove Dupes", onClick: () => confirm("dupes", "Remove Duplicates", "This will remove duplicate task completions and sessions.", removeDuplicates) },
      ],
    },
    {
      title: "Sessions",
      subtitle: "Remove stale or offline sessions — recreated automatically on next login.",
      cards: [
        { id: "stale-sess", icon: Shield, title: "Clear Stale Sessions", desc: "Remove offline sessions older than 7 days.", btn: "Clear Stale", onClick: () => confirm("stale-sess", "Clear Stale Sessions", "This will remove all offline sessions older than 7 days.", clearSessions("stale", "Stale sessions")) },
        { id: "offline-sess", icon: Shield, title: "Clear All Offline", desc: "Remove all currently offline sessions.", btn: "Clear Offline", onClick: () => confirm("offline-sess", "Clear Offline Sessions", "This will remove all sessions that are currently offline.", clearSessions("all-offline", "Offline sessions")) },
      ],
    },
    {
      title: "Archive",
      subtitle: "Move old data to archive instead of deleting — restorable later.",
      cards: [
        { id: "archive-msgs", icon: Archive, title: "Archive Old Messages", desc: "Move messages older than 180 days to archive.", btn: "Archive", onClick: () => confirm("archive-msgs", "Archive Old Messages", "This will move messages older than 180 days to the archive table. They can be restored later if needed.", archiveOldData("messages", 180, "Messages archived")) },
        { id: "archive-tasks", icon: Archive, title: "Archive Old Tasks", desc: "Move task completions older than 180 days to archive.", btn: "Archive", onClick: () => confirm("archive-tasks", "Archive Old Tasks", "This will move task completions older than 180 days to the archive table.", archiveOldData("task-completions", 180, "Task completions archived")) },
      ],
    },
    {
      title: "Reports",
      subtitle: "View usage statistics and audit logs.",
      cards: [
        { id: "audit-log", icon: ScrollText, title: "View Audit Log", desc: "See recent admin actions and changes.", btn: "View Log", onClick: viewAuditLog },
        { id: "analytics", icon: BarChart3, title: "Usage Analytics", desc: "View detailed usage statistics and trends.", btn: "View Analytics", onClick: viewAnalytics },
      ],
    },
    {
      title: "Backup & Export",
      subtitle: "Export and import system data.",
      cards: [
        { id: "export", icon: Download, title: "Export All Data", desc: "Download a full backup as JSON.", btn: "Export", onClick: exportData },
        { id: "import", icon: Upload, title: "Import Data", desc: "Upload a JSON backup file.", btn: "Select File", onClick: () => document.getElementById("import-file")?.click() },
      ],
    },
  ];

  const destructiveSections = [
    {
      title: "Conversations & Broadcasts",
      subtitle: "Permanently delete entire categories of data. Cannot be undone.",
      cards: [
        { id: "purge-msg", icon: Trash2, title: "Purge All Messages", desc: "Delete all messages, read receipts, and reactions.", btn: "Purge Messages", onClick: () => confirm("purge-msg", "Purge All Messages", "This will permanently delete ALL messages, read receipts, and reactions from every conversation.", purgeMessages) },
        { id: "purge-convos", icon: Trash2, title: "Purge All Conversations", desc: "Delete all conversations, messages, and related data.", btn: "Purge Conversations", onClick: () => confirm("purge-convos", "Purge All Conversations", "This will permanently delete ALL conversations, messages, read receipts, reactions, and conversation members. This is more destructive than purging messages alone.", purgeConversations) },
        { id: "purge-broadcast", icon: Trash2, title: "Purge Broadcast Data", desc: "Delete all broadcast records, messages, Q&A, reactions, and viewers.", btn: "Purge Broadcasts", onClick: () => confirm("purge-broadcast", "Purge All Broadcast Data", "This will permanently delete ALL broadcast records including messages, questions, reactions, and viewer data.", purgeBroadcastData) },
        { id: "purge-notif", icon: Trash2, title: "Purge Notifications", desc: "Delete all notifications and emergency messages.", btn: "Purge Notifications", onClick: () => confirm("purge-notif", "Purge All Notifications", "This will permanently delete ALL notifications and emergency broadcast messages.", purgeNotifications) },
      ],
    },
    {
      title: "Task Completion Data",
      subtitle: "Permanently remove task completion records. Cannot be undone.",
      cards: [
        { id: "purge-old", icon: Calendar, title: "Purge Old Tasks", desc: "Delete task completions older than 90 days.", btn: "Purge Old Data", onClick: () => confirm("purge-old", "Purge Old Task Data", "This will delete task completions older than 90 days. Recent data is preserved.", purgeOldTasks) },
        { id: "clear-today", icon: ListChecks, title: "Clear Today's Completions", desc: "Reset all task completions for today.", btn: "Clear Today", onClick: () => confirm("clear-today", "Clear Today's Completions", "This will remove all task completions recorded today.", bulkTasks("clear-completions-today", "Today's completions")) },
        { id: "clear-week", icon: ListChecks, title: "Clear This Week", desc: "Reset task completions from the last 7 days.", btn: "Clear Week", onClick: () => confirm("clear-week", "Clear This Week's Completions", "This will remove all task completions from the last 7 days.", bulkTasks("clear-completions-week", "This week's completions")) },
        { id: "clear-all-comp", icon: ListChecks, title: "Clear All Completions", desc: "Remove every task completion record.", btn: "Clear All", onClick: () => confirm("clear-all-comp", "Clear All Completions", "This will remove EVERY task completion record from the database.", bulkTasks("clear-all-completions", "All completions")) },
      ],
    },
    {
      title: "System",
      subtitle: "Irreversible structural changes and account-wide disruption.",
      cards: [
        { id: "drop-tables", icon: Database, title: "Drop Unused Tables", desc: "Remove legacy onboarding tables no longer used.", btn: "Drop Tables", onClick: () => confirm("drop-tables", "Drop Unused Tables", "This will permanently drop the onboarding_custom_forms, onboarding_sessions, and onboarding_submissions tables. These tables are not used by any feature.", dropUnusedTables) },
        { id: "force-all", icon: Shield, title: "Force Sign Out All", desc: "Sign out everyone except yourself.", btn: "Force Sign Out", onClick: () => confirm("force-all", "Force Sign Out All Users", "This will forcefully sign out ALL users except your current session.", clearSessions("force-all", "Force sign out")) },
      ],
    },
  ];

  // Single shared card renderer — color/border/button treatment comes
  // entirely from `severity`, not a per-card choice, so removing color
  // mentally still leaves border weight as a second hierarchy signal
  // (Section 7) and dark mode gets one deliberately-paired pair of
  // treatments instead of re-deriving it per hue (Section 8).
  function ActionCard({ card, severity }: { card: { id: string; icon: typeof Trash2; title: string; desc: string; btn: string; onClick: () => void }; severity: "safe" | "destructive" }) {
    const isDestructive = severity === "destructive";
    return (
      <div className={cn(
        "flex flex-col rounded-2xl border bg-card p-5",
        isDestructive ? "border-red-200 dark:border-red-900" : "border-border"
      )}>
        <div className={cn(
          "mb-3 flex h-10 w-10 items-center justify-center rounded-xl",
          isDestructive ? "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400" : "bg-muted text-muted-foreground"
        )}>
          <card.icon className="h-5 w-5" />
        </div>
        <h4 className="text-sm font-semibold text-foreground">{card.title}</h4>
        <p className="mt-1 flex-1 text-xs text-muted-foreground">{card.desc}</p>
        <button
          onClick={card.onClick}
          disabled={processing}
          className={cn(
            "mt-3 w-full rounded-xl px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50",
            isDestructive
              ? "bg-[var(--hub-red)] text-white hover:bg-red-700 active:bg-red-800"
              : "border border-border bg-card text-foreground hover:bg-muted active:bg-muted/80"
          )}
        >
          {card.btn}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Data Management</h2>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Monitor, maintain, and manage all system data.</p>
        </div>
        <button onClick={fetchReport} disabled={loadingReport} className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50">
          <RefreshCw className={cn("h-4 w-4", loadingReport && "animate-spin")} /> Refresh
        </button>
      </div>

      {/* Notification Tester */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <NotificationTester />
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-start gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="flex-1 text-sm font-semibold text-emerald-900 dark:text-emerald-300">{success}</p>
            <button onClick={() => setSuccess(null)} className="text-emerald-600 hover:text-emerald-700 active:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"><X className="h-4 w-4" /></button>
          </motion.div>
        )}
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <p className="flex-1 text-sm font-semibold text-red-900 dark:text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-700 active:text-red-800 dark:text-red-400 dark:hover:text-red-300"><X className="h-4 w-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Audit Log Viewer ── */}
      <AnimatePresence>
        {showAuditLog && (
          <DataManagementAuditLog
            logs={auditLogs}
            loading={loadingAudit}
            onClose={() => { setShowAuditLog(false); setAuditLogs([]); }}
          />
        )}
      </AnimatePresence>

      {/* ── Health Dashboard ── */}
      <DataManagementHealth report={report} integrity={integrity} duplicates={duplicates} />

      {/* ── Safe / routine sections — visible by default ── */}
      <div className="space-y-6">
        {safeSections.map((section) => (
          <div key={section.title}>
            <div className="mb-3">
              <h3 className="text-lg font-semibold text-foreground">{section.title}</h3>
              <p className="text-xs text-muted-foreground">{section.subtitle}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.cards.map((card) => (
                <ActionCard key={card.id} card={card} severity="safe" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Destructive & irreversible — collapsed by default (Section 12).
          The wider top margin + dashed border is deliberate: this needs to
          read as a different kind of thing, not just another section in the
          same uniform rhythm as Maintenance/Archive/Reports above. ── */}
      <div className="mt-10 border-t-2 border-dashed border-red-200 dark:border-red-900 pt-8">
        <button
          type="button"
          onClick={() => setShowDestructive((v) => !v)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 px-4 py-4 text-sm font-semibold text-red-700 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 active:bg-red-100 dark:active:bg-red-950/40"
        >
          <AlertTriangle className="h-4 w-4" />
          {showDestructive ? "Hide" : "Show"} Destructive &amp; Irreversible Operations
          {showDestructive ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showDestructive && (
          <div className="mt-6 space-y-6">
            {destructiveSections.map((section) => (
              <div key={section.title}>
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-foreground">{section.title}</h3>
                  <p className="text-xs text-muted-foreground">{section.subtitle}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {section.cards.map((card) => (
                    <ActionCard key={card.id} card={card} severity="destructive" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden file input for import */}
      <input id="import-file" type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ""; }} />

      {/* ── Confirmation Dialog ── */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !processing && setShowConfirm(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">{showConfirm.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{showConfirm.confirmText} This action cannot be undone.</p>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setShowConfirm(null)} disabled={processing} className="flex-1 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50">Cancel</button>
                <button onClick={() => showConfirm.action()} disabled={processing} className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-red-300">
                  {processing ? "Processing..." : "Yes, Continue"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

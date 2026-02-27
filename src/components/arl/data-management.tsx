"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Trash2, Database, AlertTriangle, CheckCircle2, Trophy, Download, Calendar,
  HardDrive, Activity, Unlink, Shield, ListChecks, Search, Copy, Upload,
  BarChart3, RefreshCw, X, Archive, ScrollText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface AuditLogEntry {
  id: string;
  user_id: string;
  user_type: string;
  user_name: string;
  action: string;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

interface SystemReport {
  database: { size: number; sizeFormatted: string; tables: { name: string; records: number }[] };
  counts: Record<string, number>;
  system: { nodeVersion: string; uptimeFormatted: string; memoryFormatted: string };
}

interface IntegrityResult {
  healthy: boolean;
  integrityOk: boolean;
  issues: { table: string; issue: string; count: number }[];
}

interface DuplicateResult {
  hasDuplicates: boolean;
  duplicates: { type: string; description: string; count: number }[];
}

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

  // Health monitor state
  const [report, setReport] = useState<SystemReport | null>(null);
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateResult | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditFilter, setAuditFilter] = useState("");

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

  const resetLeaderboard = () => runAction(async () => {
    const res = await fetch("/api/data-management/reset-leaderboard", { method: "POST" });
    if (!res.ok) throw new Error((await res.json()).error);
    const d = await res.json();
    return `Reset leaderboard — cleared ${d.deletedCompletions || 0} completions`;
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

  // ── Section definitions ──
  const sections = [
    {
      title: "Destructive Actions",
      subtitle: "Permanently delete data. Use with extreme caution.",
      cards: [
        { id: "purge-msg", icon: Trash2, color: "red", title: "Purge All Messages", desc: "Delete all messages, read receipts, and reactions.", btn: "Purge Messages", onClick: () => confirm("purge-msg", "Purge All Messages", "This will permanently delete ALL messages, read receipts, and reactions from every conversation.", purgeMessages) },
        { id: "purge-convos", icon: Trash2, color: "red", title: "Purge All Conversations", desc: "Delete all conversations, messages, and related data.", btn: "Purge Conversations", onClick: () => confirm("purge-convos", "Purge All Conversations", "This will permanently delete ALL conversations, messages, read receipts, reactions, and conversation members. This is more destructive than purging messages alone.", purgeConversations) },
        { id: "reset-lb", icon: Trophy, color: "red", title: "Reset Leaderboard", desc: "Clear all points and task completion history.", btn: "Reset Points", onClick: () => confirm("reset-lb", "Reset Leaderboard", "This will reset ALL points and task completion history for every location. Use to start a new competition period.", resetLeaderboard) },
        { id: "purge-broadcast", icon: Trash2, color: "red", title: "Purge Broadcast Data", desc: "Delete all broadcast records, messages, Q&A, reactions, and viewers.", btn: "Purge Broadcasts", onClick: () => confirm("purge-broadcast", "Purge All Broadcast Data", "This will permanently delete ALL broadcast records including messages, questions, reactions, and viewer data.", purgeBroadcastData) },
        { id: "purge-notif", icon: Trash2, color: "red", title: "Purge Notifications", desc: "Delete all notifications and emergency messages.", btn: "Purge Notifications", onClick: () => confirm("purge-notif", "Purge All Notifications", "This will permanently delete ALL notifications and emergency broadcast messages.", purgeNotifications) },
      ],
    },
    {
      title: "Cleanup & Maintenance",
      subtitle: "Keep the database healthy and performant.",
      cards: [
        { id: "vacuum", icon: HardDrive, color: "green", title: "Optimize Database", desc: "Vacuum and rebuild indexes for better performance.", btn: "Optimize", onClick: () => confirm("vacuum", "Optimize Database", "This will vacuum the database and rebuild indexes. Safe operation.", vacuumDb) },
        { id: "purge-old", icon: Calendar, color: "orange", title: "Purge Old Tasks", desc: "Delete task completions older than 90 days.", btn: "Purge Old Data", onClick: () => confirm("purge-old", "Purge Old Task Data", "This will delete task completions older than 90 days. Recent data is preserved.", purgeOldTasks) },
        { id: "orphaned", icon: Unlink, color: "amber", title: "Orphaned Data Cleanup", desc: "Remove records with broken references.", btn: "Clean Orphans", onClick: () => confirm("orphaned", "Orphaned Data Cleanup", "This will remove messages without conversations, reads without messages, etc.", orphanedCleanup) },
        { id: "dupes", icon: Copy, color: "yellow", title: "Remove Duplicates", desc: "Find and remove duplicate records.", btn: "Remove Dupes", onClick: () => confirm("dupes", "Remove Duplicates", "This will remove duplicate task completions and sessions.", removeDuplicates) },
        { id: "drop-tables", icon: Database, color: "red", title: "Drop Unused Tables", desc: "Remove legacy onboarding tables no longer used.", btn: "Drop Tables", onClick: () => confirm("drop-tables", "Drop Unused Tables", "This will permanently drop the onboarding_custom_forms, onboarding_sessions, and onboarding_submissions tables. These tables are not used by any feature.", dropUnusedTables) },
      ],
    },
    {
      title: "Session Management",
      subtitle: "Manage active and stale user sessions.",
      cards: [
        { id: "stale-sess", icon: Shield, color: "blue", title: "Clear Stale Sessions", desc: "Remove offline sessions older than 7 days.", btn: "Clear Stale", onClick: () => confirm("stale-sess", "Clear Stale Sessions", "This will remove all offline sessions older than 7 days.", clearSessions("stale", "Stale sessions")) },
        { id: "offline-sess", icon: Shield, color: "indigo", title: "Clear All Offline", desc: "Remove all currently offline sessions.", btn: "Clear Offline", onClick: () => confirm("offline-sess", "Clear Offline Sessions", "This will remove all sessions that are currently offline.", clearSessions("all-offline", "Offline sessions")) },
        { id: "force-all", icon: Shield, color: "red", title: "Force Logout All", desc: "Logout everyone except yourself.", btn: "Force Logout", onClick: () => confirm("force-all", "Force Logout All Users", "This will forcefully log out ALL users except your current session.", clearSessions("force-all", "Force logout")) },
      ],
    },
    {
      title: "Task Operations",
      subtitle: "Bulk operations on task completion data.",
      cards: [
        { id: "clear-today", icon: ListChecks, color: "sky", title: "Clear Today's Completions", desc: "Reset all task completions for today.", btn: "Clear Today", onClick: () => confirm("clear-today", "Clear Today's Completions", "This will remove all task completions recorded today.", bulkTasks("clear-completions-today", "Today's completions")) },
        { id: "clear-week", icon: ListChecks, color: "blue", title: "Clear This Week", desc: "Reset task completions from the last 7 days.", btn: "Clear Week", onClick: () => confirm("clear-week", "Clear This Week's Completions", "This will remove all task completions from the last 7 days.", bulkTasks("clear-completions-week", "This week's completions")) },
        { id: "clear-all-comp", icon: ListChecks, color: "red", title: "Clear All Completions", desc: "Remove every task completion record.", btn: "Clear All", onClick: () => confirm("clear-all-comp", "Clear All Completions", "This will remove EVERY task completion record from the database.", bulkTasks("clear-all-completions", "All completions")) },
      ],
    },
    {
      title: "Archive & Retention",
      subtitle: "Move old data to archive instead of deleting.",
      cards: [
        { id: "archive-msgs", icon: Archive, color: "purple", title: "Archive Old Messages", desc: "Move messages older than 180 days to archive.", btn: "Archive", onClick: () => confirm("archive-msgs", "Archive Old Messages", "This will move messages older than 180 days to the archive table. They can be restored later if needed.", archiveOldData("messages", 180, "Messages archived")) },
        { id: "archive-tasks", icon: Archive, color: "indigo", title: "Archive Old Tasks", desc: "Move task completions older than 180 days to archive.", btn: "Archive", onClick: () => confirm("archive-tasks", "Archive Old Tasks", "This will move task completions older than 180 days to the archive table.", archiveOldData("task-completions", 180, "Task completions archived")) },
      ],
    },
    {
      title: "Analytics & Audit",
      subtitle: "View usage statistics and audit logs.",
      cards: [
        { id: "audit-log", icon: ScrollText, color: "slate", title: "View Audit Log", desc: "See recent admin actions and changes.", btn: "View Log", onClick: viewAuditLog },
        { id: "analytics", icon: BarChart3, color: "cyan", title: "Usage Analytics", desc: "View detailed usage statistics and trends.", btn: "View Analytics", onClick: viewAnalytics },
      ],
    },
    {
      title: "Backup & Export",
      subtitle: "Export and import system data.",
      cards: [
        { id: "export", icon: Download, color: "blue", title: "Export All Data", desc: "Download a full backup as JSON.", btn: "Export", onClick: exportData },
        { id: "import", icon: Upload, color: "green", title: "Import Data", desc: "Upload a JSON backup file.", btn: "Select File", onClick: () => document.getElementById("import-file")?.click() },
      ],
    },
  ];

  const colorMap: Record<string, { bg: string; text: string; btn: string }> = {
    red:    { bg: "bg-red-50",    text: "text-red-600",    btn: "bg-red-600 hover:bg-red-700 disabled:bg-red-300" },
    orange: { bg: "bg-orange-50", text: "text-orange-600", btn: "bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300" },
    amber:  { bg: "bg-amber-50",  text: "text-amber-600",  btn: "bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300" },
    yellow: { bg: "bg-yellow-50", text: "text-yellow-600", btn: "bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-300" },
    green:  { bg: "bg-emerald-50",text: "text-emerald-600",btn: "bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300" },
    blue:   { bg: "bg-blue-50",   text: "text-blue-600",   btn: "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300" },
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600", btn: "bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300" },
    purple: { bg: "bg-purple-50", text: "text-purple-600", btn: "bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300" },
    sky:    { bg: "bg-sky-50",    text: "text-sky-600",    btn: "bg-sky-600 hover:bg-sky-700 disabled:bg-sky-300" },
    slate:  { bg: "bg-muted",  text: "text-muted-foreground",  btn: "bg-slate-600 hover:bg-slate-700 disabled:bg-slate-300" },
    cyan:   { bg: "bg-cyan-50",   text: "text-cyan-600",   btn: "bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-300" },
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Data Management</h2>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Monitor, maintain, and manage all system data.</p>
        </div>
        <button onClick={fetchReport} disabled={loadingReport} className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50">
          <RefreshCw className={cn("h-4 w-4", loadingReport && "animate-spin")} /> Refresh
        </button>
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="flex-1 text-sm font-medium text-emerald-900">{success}</p>
            <button onClick={() => setSuccess(null)} className="text-emerald-600 hover:text-emerald-700"><X className="h-4 w-4" /></button>
          </motion.div>
        )}
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
            <p className="flex-1 text-sm font-medium text-red-900">{error}</p>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-700"><X className="h-4 w-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Audit Log Viewer ── */}
      <AnimatePresence>
        {showAuditLog && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <ScrollText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Audit Log</h3>
                    <p className="text-xs text-muted-foreground">{auditLogs.length} recent actions</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={auditFilter}
                    onChange={(e) => setAuditFilter(e.target.value)}
                    placeholder="Filter..."
                    className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring w-32 sm:w-56"
                  />
                  <button
                    onClick={() => { setShowAuditLog(false); setAuditLogs([]); setAuditFilter(""); }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {loadingAudit ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                  <span className="text-sm text-muted-foreground">Loading audit log...</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No audit log entries found.</p>
              ) : (
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {auditLogs
                    .filter((log) => {
                      if (!auditFilter) return true;
                      const q = auditFilter.toLowerCase();
                      return log.action.toLowerCase().includes(q) ||
                        log.user_name.toLowerCase().includes(q) ||
                        (log.details || "").toLowerCase().includes(q);
                    })
                    .map((log) => (
                      <div key={log.id} className="flex items-start gap-3 rounded-xl bg-muted/50 px-3 py-2.5 text-xs">
                        <div className={cn(
                          "mt-0.5 shrink-0 h-5 w-5 flex items-center justify-center rounded-md text-[10px] font-bold",
                          log.user_type === "arl" ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                        )}>
                          {log.user_type === "arl" ? "A" : "L"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground">{log.user_name}</span>
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">{log.action}</span>
                            {log.details && <span className="text-muted-foreground truncate">{log.details}</span>}
                          </div>
                          <div className="mt-0.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span>{new Date(log.created_at).toLocaleString()}</span>
                            {log.ip_address && log.ip_address !== "unknown" && <span>IP: {log.ip_address}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Health Dashboard ── */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"><Activity className="h-5 w-5" /></div>
          <div>
            <h3 className="text-lg font-bold text-foreground">System Health</h3>
            <p className="text-xs text-muted-foreground">Real-time database and system status</p>
          </div>
        </div>

        {report ? (
          <div className="space-y-5">
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Database Size", value: report.database.sizeFormatted, color: "text-blue-600" },
                { label: "Uptime", value: report.system.uptimeFormatted, color: "text-emerald-600" },
                { label: "Memory", value: report.system.memoryFormatted, color: "text-purple-600" },
                { label: "Node.js", value: report.system.nodeVersion, color: "text-muted-foreground" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-muted/50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                  <p className={cn("mt-1 text-lg font-bold", s.color)}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Record counts */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Record Counts</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {Object.entries(report.counts).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <span className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                    <span className="text-sm font-bold text-foreground">{val.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Integrity & Duplicates */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className={cn("rounded-xl p-4 border", integrity?.healthy ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50")}>
                <div className="flex items-center gap-2 mb-1">
                  {integrity?.healthy ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-red-600" />}
                  <p className={cn("text-sm font-bold", integrity?.healthy ? "text-emerald-800" : "text-red-800")}>
                    Integrity: {integrity?.healthy ? "Healthy" : `${integrity?.issues.length} issue(s)`}
                  </p>
                </div>
                {integrity?.issues.map((iss, i) => (
                  <p key={i} className="text-xs text-red-600 ml-6">{iss.issue}: {iss.count} records</p>
                ))}
              </div>
              <div className={cn("rounded-xl p-4 border", !duplicates?.hasDuplicates ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")}>
                <div className="flex items-center gap-2 mb-1">
                  {!duplicates?.hasDuplicates ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-amber-600" />}
                  <p className={cn("text-sm font-bold", !duplicates?.hasDuplicates ? "text-emerald-800" : "text-amber-800")}>
                    Duplicates: {!duplicates?.hasDuplicates ? "None found" : `${duplicates.duplicates.length} type(s)`}
                  </p>
                </div>
                {duplicates?.duplicates.map((d, i) => (
                  <p key={i} className="text-xs text-amber-600 ml-6">{d.description}: {d.count}</p>
                ))}
              </div>
            </div>

            {/* Table breakdown */}
            <details className="group">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                Table Breakdown ▸
              </summary>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {report.database.tables.map((t) => (
                  <div key={t.name} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5">
                    <span className="text-[11px] text-muted-foreground truncate mr-2">{t.name}</span>
                    <span className="text-xs font-bold text-foreground">{t.records.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
            <span className="text-sm text-muted-foreground">Loading system report...</span>
          </div>
        )}
      </div>

      {/* ── Action Sections ── */}
      {sections.map((section) => (
        <div key={section.title}>
          <div className="mb-3">
            <h3 className="text-lg font-bold text-foreground">{section.title}</h3>
            <p className="text-xs text-muted-foreground">{section.subtitle}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {section.cards.map((card) => {
              const colors = colorMap[card.color] || colorMap.blue;
              return (
                <div key={card.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col">
                  <div className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-xl", colors.bg, colors.text)}>
                    <card.icon className="h-5 w-5" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">{card.title}</h4>
                  <p className="mt-1 text-xs text-muted-foreground flex-1">{card.desc}</p>
                  <button
                    onClick={card.onClick}
                    disabled={processing}
                    className={cn("mt-3 w-full rounded-xl px-3 py-2 text-xs font-semibold text-white transition-colors", colors.btn)}
                  >
                    {card.btn}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Hidden file input for import */}
      <input id="import-file" type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ""; }} />

      {/* ── Confirmation Dialog ── */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !processing && setShowConfirm(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-foreground">{showConfirm.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{showConfirm.confirmText} This action cannot be undone.</p>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setShowConfirm(null)} disabled={processing} className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50">Cancel</button>
                <button onClick={() => showConfirm.action()} disabled={processing} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-red-300">
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

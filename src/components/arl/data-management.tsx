"use client";

import { useState } from "react";
import { Trash2, Database, AlertTriangle, CheckCircle2, Trophy, Bell, Download, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function DataManagement() {
  const [purging, setPurging] = useState(false);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePurgeMessages = async () => {
    setPurging(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/data-management/purge-messages", {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setSuccess(`Successfully purged ${data.deletedMessages || 0} messages and ${data.deletedReads || 0} read receipts`);
        setShowConfirm(null);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to purge messages");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setPurging(false);
    }
  };

  const handlePurgeOldTasks = async () => {
    setPurging(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/data-management/purge-old-tasks", {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setSuccess(`Successfully purged ${data.deletedCompletions || 0} old task completions (older than 90 days)`);
        setShowConfirm(null);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to purge old tasks");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setPurging(false);
    }
  };

  const handleResetLeaderboard = async () => {
    setPurging(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/data-management/reset-leaderboard", {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setSuccess(`Successfully reset leaderboard. Cleared ${data.deletedCompletions || 0} task completions.`);
        setShowConfirm(null);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to reset leaderboard");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setPurging(false);
    }
  };

  const handleExportData = async () => {
    setPurging(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/data-management/export");
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hub-data-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setSuccess("Data exported successfully");
        setShowConfirm(null);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to export data");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setPurging(false);
    }
  };

  const actions = [
    {
      id: "purge-messages",
      title: "Purge All Messages",
      description: "Delete all messages, read receipts, and reactions from all conversations.",
      icon: Trash2,
      color: "red",
      action: handlePurgeMessages,
      confirmText: "Are you sure you want to purge all messages? This will permanently delete all messages, read receipts, and reactions from the system.",
    },
    {
      id: "purge-old-tasks",
      title: "Purge Old Task Data",
      description: "Delete task completions older than 90 days to keep the database clean.",
      icon: Calendar,
      color: "orange",
      action: handlePurgeOldTasks,
      confirmText: "This will delete all task completions older than 90 days. Recent data will be preserved.",
    },
    {
      id: "reset-leaderboard",
      title: "Reset Leaderboard",
      description: "Clear all task completion history and reset points for all locations.",
      icon: Trophy,
      color: "purple",
      action: handleResetLeaderboard,
      confirmText: "This will reset all points and task completion history for all locations. Use this to start a new competition period.",
    },
    {
      id: "export-data",
      title: "Export All Data",
      description: "Download a complete backup of all system data as JSON.",
      icon: Download,
      color: "blue",
      action: handleExportData,
      confirmText: "This will export all data including tasks, messages, users, and completions as a JSON file.",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Data Management</h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage and purge data across the system. Use with caution.
        </p>
      </div>

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-900">{success}</p>
          </div>
          <button
            onClick={() => setSuccess(null)}
            className="text-emerald-600 hover:text-emerald-700"
          >
            ×
          </button>
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-700"
          >
            ×
          </button>
        </motion.div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <div
            key={action.id}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className={cn(
              "mb-4 flex h-12 w-12 items-center justify-center rounded-xl",
              action.color === "red" && "bg-red-50 text-red-600",
              action.color === "orange" && "bg-orange-50 text-orange-600",
              action.color === "purple" && "bg-purple-50 text-purple-600",
              action.color === "blue" && "bg-blue-50 text-blue-600"
            )}>
              <action.icon className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">{action.title}</h3>
            <p className="mt-2 text-sm text-slate-500">{action.description}</p>
            <button
              onClick={() => setShowConfirm(action.id)}
              disabled={purging}
              className={cn(
                "mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                action.color === "red" && "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
                action.color === "orange" && "bg-orange-600 text-white hover:bg-orange-700 disabled:bg-orange-300",
                action.color === "purple" && "bg-purple-600 text-white hover:bg-purple-700 disabled:bg-purple-300",
                action.color === "blue" && "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300"
              )}
            >
              {purging && showConfirm === action.id ? "Processing..." : "Execute"}
            </button>
          </div>
        ))}
      </div>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => !purging && setShowConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Confirm Action</h3>
              <p className="mt-2 text-sm text-slate-600">
                {actions.find((a) => a.id === showConfirm)?.confirmText} This action cannot be undone.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowConfirm(null)}
                  disabled={purging}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const action = actions.find((a) => a.id === showConfirm);
                    if (action) action.action();
                  }}
                  disabled={purging}
                  className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-red-300"
                >
                  {purging ? "Processing..." : "Yes, Continue"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

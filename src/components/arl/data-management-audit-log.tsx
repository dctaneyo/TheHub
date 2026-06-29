"use client";

import { useState } from "react";
import { ScrollText, RefreshCw, Search } from "@/lib/icons";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { ModalCloseButton } from "@/components/ui/modal-close-button";

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

interface Props {
  logs: AuditLogEntry[];
  loading: boolean;
  onClose: () => void;
}

export function DataManagementAuditLog({ logs, loading, onClose }: Props) {
  const [filter, setFilter] = useState("");

  const filteredLogs = logs.filter((log) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.user_name.toLowerCase().includes(q) ||
      (log.details || "").toLowerCase().includes(q)
    );
  });

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <ScrollText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Audit Log</h3>
              <p className="text-xs text-muted-foreground">{logs.length} recent actions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter..."
              className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring w-32 sm:w-56"
            />
            <ModalCloseButton onClick={onClose} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
            <span className="text-sm text-muted-foreground">Loading audit log...</span>
          </div>
        ) : logs.length === 0 ? (
          <EmptyState title="No audit log entries found" className="py-8" />
        ) : (
          <>
            {/* Table — desktop (md:+). A literal audit log is a textbook
                Section 11 case: same-shaped records (actor / action / details /
                timestamp / IP) that a user scans to find a specific event.
                Columns let the eye jump to "action" or "when" directly without
                reading each blob from the left margin. */}
            <div className="hidden md:block rounded-xl border border-border overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-3 py-2.5 text-left font-semibold">Actor</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Action</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Details</th>
                      <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">When</th>
                      <th className="px-3 py-2.5 text-left font-semibold">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                          No entries match your filter.
                        </td>
                      </tr>
                    ) : filteredLogs.map((log) => (
                      <tr key={log.id} className="border-b border-border last:border-b-0 active:bg-muted/30 transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "shrink-0 h-5 w-5 flex items-center justify-center rounded-md font-semibold",
                              log.user_type === "arl"
                                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            )}>
                              {log.user_type === "arl" ? "A" : "L"}
                            </span>
                            <span className="font-semibold text-foreground">{log.user_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="rounded bg-muted px-2 py-1 font-mono text-muted-foreground whitespace-nowrap">
                            {log.action}
                          </span>
                        </td>
                        <td className="max-w-56 px-3 py-2.5">
                          <span className="block truncate text-muted-foreground">
                            {log.details || <span className="text-muted-foreground/50">—</span>}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {log.ip_address && log.ip_address !== "unknown" ? log.ip_address : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cards — mobile fallback, same data stacked */}
            <div className="md:hidden space-y-1 max-h-96 overflow-y-auto">
              {filteredLogs.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No entries match your filter.</p>
              ) : filteredLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 rounded-xl bg-muted/50 px-3 py-2 text-xs">
                  <div className={cn(
                    "mt-1 shrink-0 h-5 w-5 flex items-center justify-center rounded-md font-semibold",
                    log.user_type === "arl"
                      ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  )}>
                    {log.user_type === "arl" ? "A" : "L"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{log.user_name}</span>
                      <span className="rounded bg-muted px-2 py-1 font-mono text-muted-foreground">{log.action}</span>
                      {log.details && <span className="text-muted-foreground truncate">{log.details}</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-muted-foreground">
                      <span>{new Date(log.created_at).toLocaleString()}</span>
                      {log.ip_address && log.ip_address !== "unknown" && <span>IP: {log.ip_address}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

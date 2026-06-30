"use client";

import { useState } from "react";
import { ScrollText, RefreshCw } from "@/lib/icons";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { Card } from "@/components/ui/card";

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
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="overflow-hidden"
    >
      <Card className="gap-0 rounded-2xl p-6">
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
        ) : filteredLogs.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">No entries match your filter.</p>
        ) : (
          /* Timeline — "what happened when" is a timeline before it's a
             sorted table (Section 11): a flat list/table technically works,
             but ordering by time is the actual shape of this data, so the
             layout should show that directly rather than asking the eye to
             infer order from a column. Same shape at every width — unlike a
             wide table, a timeline doesn't need a separate mobile fallback. */
          <div className="max-h-96 overflow-y-auto">
            {filteredLogs.map((log, i) => (
              <div key={log.id} className="relative flex gap-3">
                <div className="relative flex w-5 shrink-0 flex-col items-center">
                  <span
                    className={cn(
                      "z-10 mt-1.5 h-2.5 w-2.5 rounded-full",
                      log.user_type === "arl"
                        ? "bg-purple-500 dark:bg-purple-400"
                        : "bg-emerald-500 dark:bg-emerald-400"
                    )}
                  />
                  {i < filteredLogs.length - 1 && (
                    <span className="absolute top-4 bottom-0 w-px bg-border" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{log.user_name}</span>
                    <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                      {log.action}
                    </span>
                  </div>
                  {log.details && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{log.details}</p>
                  )}
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{new Date(log.created_at).toLocaleString()}</span>
                    {log.ip_address && log.ip_address !== "unknown" && <span>IP: {log.ip_address}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

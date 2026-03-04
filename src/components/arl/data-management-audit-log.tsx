"use client";

import { useState } from "react";
import { ScrollText, RefreshCw, X, Search } from "@/lib/icons";
import { motion } from "framer-motion";
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

interface Props {
  logs: AuditLogEntry[];
  loading: boolean;
  onClose: () => void;
}

export function DataManagementAuditLog({ logs, loading, onClose }: Props) {
  const [filter, setFilter] = useState("");

  return (
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
              <p className="text-xs text-muted-foreground">{logs.length} recent actions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter..."
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring w-32 sm:w-56"
            />
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
            <span className="text-sm text-muted-foreground">Loading audit log...</span>
          </div>
        ) : logs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No audit log entries found.</p>
        ) : (
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {logs
              .filter((log) => {
                if (!filter) return true;
                const q = filter.toLowerCase();
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
  );
}

"use client";

import { Activity, CheckCircle2, AlertTriangle, Copy, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SystemReport {
  database: { size: number; sizeFormatted: string; tables: { name: string; records: number }[] };
  counts: Record<string, number>;
  system: { nodeVersion: string; uptimeFormatted: string; memoryFormatted: string };
}

export interface IntegrityResult {
  healthy: boolean;
  integrityOk: boolean;
  issues: { table: string; issue: string; count: number }[];
}

export interface DuplicateResult {
  hasDuplicates: boolean;
  duplicates: { type: string; description: string; count: number }[];
}

interface Props {
  report: SystemReport | null;
  integrity: IntegrityResult | null;
  duplicates: DuplicateResult | null;
}

export function DataManagementHealth({ report, integrity, duplicates }: Props) {
  if (!report) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"><Activity className="h-5 w-5" /></div>
          <div>
            <h3 className="text-lg font-bold text-foreground">System Health</h3>
            <p className="text-xs text-muted-foreground">Real-time database and system status</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Loading system report...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"><Activity className="h-5 w-5" /></div>
        <div>
          <h3 className="text-lg font-bold text-foreground">System Health</h3>
          <p className="text-xs text-muted-foreground">Real-time database and system status</p>
        </div>
      </div>

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
    </div>
  );
}

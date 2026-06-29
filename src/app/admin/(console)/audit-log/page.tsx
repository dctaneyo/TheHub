"use client";

import { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";

interface Entry {
  id: string;
  tenant_id: string | null;
  user_id: string;
  user_type: string;
  operation: string;
  entity_type: string;
  affected_count: number;
  status: string;
  created_at: string;
}

// Cross-tenant, filterable — filters persistent rather than a collapsed
// disclosure, since "filter down to one suspicious event" is the actual
// task here, not browsing.
export default function AuditLogPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [operation, setOperation] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (tenantId) params.set("tenantId", tenantId);
    if (operation) params.set("operation", operation);
    fetch(`/api/admin/audit-log?${params.toString()}`).then((r) => r.json()).then((d) => setEntries(d.entries || []));
  }, [tenantId, operation]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold text-foreground">Audit Log</h1>

      <div className="mb-4 flex gap-2">
        <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="Filter by tenant ID" className="max-w-xs" />
        <Input value={operation} onChange={(e) => setOperation(e.target.value)} placeholder="Filter by operation" className="max-w-xs" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Tenant</th>
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Operation</th>
              <th className="px-4 py-2">Entity</th>
              <th className="px-4 py-2">Affected</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{e.tenant_id || "—"}</td>
                <td className="px-4 py-2.5 text-xs">{e.user_type}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{e.operation}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{e.entity_type}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{e.affected_count}</td>
                <td className="px-4 py-2.5 text-xs">
                  <span className={e.status === "success" ? "text-emerald-600" : "text-destructive"}>{e.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

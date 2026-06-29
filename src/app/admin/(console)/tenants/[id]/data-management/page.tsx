"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useConfirmWithPinDialog, ConfirmWithPinDialog } from "@/components/admin/confirm-with-pin-dialog";
import { Button } from "@/components/ui/button";

interface ActionDef {
  key: string;
  label: string;
  description: string;
  path: string;
  body?: Record<string, unknown>;
}

const ACTIONS: ActionDef[] = [
  { key: "purge-messages", label: "Purge messages", description: "Deletes all messages, reads, and reactions for this tenant.", path: "purge-messages" },
  { key: "purge-conversations", label: "Purge conversations", description: "Deletes all non-global conversations for this tenant.", path: "purge-conversations" },
  { key: "purge-broadcast-data", label: "Purge broadcast data", description: "Deletes all broadcasts, viewers, reactions, and Q&A for this tenant.", path: "purge-broadcast-data" },
  { key: "purge-notifications", label: "Purge notifications", description: "Deletes all notifications and emergency messages for this tenant.", path: "purge-notifications" },
  { key: "purge-old-tasks", label: "Purge old task completions", description: "Deletes task completions older than 90 days.", path: "purge-old-tasks" },
  { key: "force-all-sessions", label: "Force-logout all sessions", description: "Ends every session in this tenant.", path: "clear-sessions", body: { mode: "force-all" } },
];

// Reached via a deliberate action from the tenant's Danger Zone, never a
// tab — the extra navigation step here is intentional friction, not an
// oversight. Every POST below requires PIN re-confirmation regardless of
// how recently the admin authenticated.
export default function TenantDataManagementPage() {
  const params = useParams<{ id: string }>();
  const { dialog, confirm } = useConfirmWithPinDialog();
  const [duplicates, setDuplicates] = useState<{ type: string; description: string; count: number }[] | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const runAction = useCallback((action: ActionDef) => {
    confirm({
      title: action.label,
      description: `${action.description} This cannot be undone.`,
      confirmLabel: "Run",
      onConfirm: async (pin) => {
        const res = await fetch(`/api/admin/tenants/${params.id}/data-management/${action.path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-hub-request": "1" },
          body: JSON.stringify({ pin, ...action.body }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Incorrect PIN");
        setResult(`${action.label}: ${JSON.stringify(data)}`);
      },
    });
  }, [confirm, params.id]);

  const checkDuplicates = useCallback(() => {
    fetch(`/api/admin/tenants/${params.id}/data-management/duplicate-check`).then((r) => r.json()).then((d) => setDuplicates(d.duplicates || []));
  }, [params.id]);

  const removeDuplicates = useCallback(() => {
    confirm({
      title: "Remove duplicates",
      description: "Removes duplicate task completions and sessions, keeping the earliest/newest. This cannot be undone.",
      confirmLabel: "Remove",
      onConfirm: async (pin) => {
        const res = await fetch(`/api/admin/tenants/${params.id}/data-management/duplicate-check`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-hub-request": "1" },
          body: JSON.stringify({ pin }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Incorrect PIN");
        setResult(`Removed duplicates: ${JSON.stringify(data)}`);
        setDuplicates(null);
      },
    });
  }, [confirm, params.id]);

  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Data Management</h1>
      <p className="mb-6 text-sm text-muted-foreground">Destructive, tenant-scoped operations. Every action below requires your PIN.</p>

      {result && (
        <pre className="mb-4 max-h-32 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs">{result}</pre>
      )}

      <div className="space-y-2">
        {ACTIONS.map((action) => (
          <div key={action.key} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div>
              <p className="text-sm font-medium text-foreground">{action.label}</p>
              <p className="text-xs text-muted-foreground">{action.description}</p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => runAction(action)}>Run</Button>
          </div>
        ))}

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Duplicate check</p>
              <p className="text-xs text-muted-foreground">Detect duplicate conversations, task completions, and sessions.</p>
            </div>
            <Button variant="outline" size="sm" onClick={checkDuplicates}>Check</Button>
          </div>
          {duplicates && (
            <div className="mt-3 space-y-1 border-t border-border pt-3">
              {duplicates.length === 0 ? (
                <p className="text-xs text-muted-foreground">No duplicates found.</p>
              ) : (
                <>
                  {duplicates.map((d) => (
                    <p key={d.type} className="text-xs text-muted-foreground">{d.description}: {d.count}</p>
                  ))}
                  <Button variant="destructive" size="sm" onClick={removeDuplicates} className="mt-2">Remove duplicates</Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmWithPinDialog {...dialog} />
    </div>
  );
}

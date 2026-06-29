"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LogIn, KeyRound, AlertTriangle, ChevronRight } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { ConfirmWithPinDialog, useConfirmWithPinDialog } from "@/components/admin/confirm-with-pin-dialog";

interface Arl {
  id: string;
  name: string;
  userId: string;
  role: string;
  isActive: boolean;
}

interface AuditEntry {
  id: string;
  operation: string;
  entity_type: string;
  created_at: string;
  status: string;
}

interface Overview {
  tenant: { id: string; name: string; slug: string; plan: string; isActive: boolean };
  stats: { locationCount: number; arlCount: number };
  arls: Arl[];
  brands: { id: string; name: string }[];
  recentAudit: AuditEntry[];
}

// Tenant Overview — one investigate-a-tenant task, not a tabbed grab-bag.
// Impersonate/reset-PIN are per-row ARL actions (target one person); the
// Danger Zone below is for tenant-wide, no-specific-target actions only.
export default function TenantOverviewPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Overview | null>(null);
  const { dialog, confirm } = useConfirmWithPinDialog();
  const [resetPinTarget, setResetPinTarget] = useState<string | null>(null);
  const [draftNewPin, setDraftNewPin] = useState("");

  const load = useCallback(() => {
    fetch(`/api/admin/tenants/${params.id}`).then((r) => r.json()).then(setData);
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  const handleImpersonate = useCallback((arlId: string) => {
    fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hub-request": "1" },
      body: JSON.stringify({ arlId }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.handoffUrl) window.location.href = d.handoffUrl; });
  }, []);

  const handleForceLogout = useCallback(() => {
    confirm({
      title: "Force-logout this tenant",
      description: "Ends every active session in this tenant immediately. This cannot be undone.",
      confirmLabel: "End all sessions",
      onConfirm: async (pin) => {
        const res = await fetch(`/api/admin/tenants/${params.id}/force-logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-hub-request": "1" },
          body: JSON.stringify({ pin }),
        });
        if (!res.ok) throw new Error("Incorrect PIN");
        load();
      },
    });
  }, [confirm, params.id, load]);

  // Two small steps, not one: collect the new 4-digit PIN inline first
  // (a plain text field, no special protection needed — it's not a secret
  // yet), then open the admin-PIN confirm dialog to actually authorize the
  // change. Doing both in the dialog at once doesn't work — the dialog's
  // full-screen backdrop would sit on top of any other input on the page.
  const confirmResetPin = useCallback(() => {
    const arlId = resetPinTarget;
    if (!arlId || draftNewPin.length !== 4) return;
    confirm({
      title: "Reset this ARL's PIN",
      description: `They'll need the new PIN (${draftNewPin}) to log in next time.`,
      confirmLabel: "Reset PIN",
      onConfirm: async (pin) => {
        const res = await fetch(`/api/admin/tenants/${params.id}/arls/${arlId}/reset-pin`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-hub-request": "1" },
          body: JSON.stringify({ pin, newPin: draftNewPin }),
        });
        if (!res.ok) throw new Error("Incorrect PIN");
        setDraftNewPin("");
        setResetPinTarget(null);
      },
    });
  }, [confirm, params.id, resetPinTarget, draftNewPin]);

  if (!data) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{data.tenant.name}</h1>
          <p className="font-mono text-xs text-muted-foreground">{data.tenant.slug}</p>
        </div>
        <div className="flex gap-1.5">
          {data.brands.map((b) => (
            <span key={b.id} className="rounded-full bg-muted px-2 py-0.5 text-xs">{b.name}</span>
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Locations</p>
          <p className="font-mono text-2xl font-bold">{data.stats.locationCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">ARLs</p>
          <p className="font-mono text-2xl font-bold">{data.stats.arlCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Plan</p>
          <p className="text-2xl font-bold capitalize">{data.tenant.plan}</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-foreground">ARLs</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {data.arls.map((arl) => (
                <tr key={arl.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{arl.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{arl.userId}</td>
                  <td className="px-4 py-2.5 capitalize text-xs text-muted-foreground">{arl.role}</td>
                  <td className="px-4 py-2.5 text-right">
                    {resetPinTarget === arl.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <input
                          className="w-20 rounded border border-border bg-background px-2 py-1 text-xs font-mono"
                          value={draftNewPin}
                          onChange={(e) => setDraftNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          placeholder="New PIN"
                          autoFocus
                        />
                        <button onClick={confirmResetPin} disabled={draftNewPin.length !== 4} className="text-xs font-semibold text-foreground disabled:opacity-40">
                          Continue
                        </button>
                        <button onClick={() => { setResetPinTarget(null); setDraftNewPin(""); }} className="text-xs text-muted-foreground">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => handleImpersonate(arl.id)} className="mr-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          <LogIn className="h-3.5 w-3.5" /> Impersonate
                        </button>
                        <button onClick={() => setResetPinTarget(arl.id)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          <KeyRound className="h-3.5 w-3.5" /> Reset PIN
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Recent activity</h2>
        <div className="space-y-1">
          {data.recentAudit.length === 0 && <p className="text-sm text-muted-foreground">No recent activity.</p>}
          {data.recentAudit.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs">
              <span className="font-mono">{entry.operation}</span>
              <span className="text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone — visually separated, never equal-weight with the
          read-only content above. Tenant-wide, no-specific-target actions
          only; per-ARL actions live as row actions above instead. */}
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" /> Danger Zone
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Force-logout this tenant</p>
            <p className="text-xs text-muted-foreground">Ends every active session immediately.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleForceLogout}>End all sessions</Button>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-destructive/20 pt-3">
          <div>
            <p className="text-sm font-medium text-foreground">Destructive data operations</p>
            <p className="text-xs text-muted-foreground">Purge messages, conversations, broadcasts, and more.</p>
          </div>
          <Link href={`/admin/tenants/${params.id}/data-management`}>
            <Button variant="outline" size="sm">Open Data Management <ChevronRight className="h-3.5 w-3.5" /></Button>
          </Link>
        </div>
      </div>

      <ConfirmWithPinDialog {...dialog} />
    </div>
  );
}

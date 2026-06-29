"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { LogIn, KeyRound, AlertTriangle, ChevronRight, Pencil, Plus, X } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  appTitle: string | null;
  primaryColor: string | null;
  maxLocations: number | null;
  maxUsers: number | null;
  customDomain: string | null;
}

interface Overview {
  tenant: TenantDetail;
  stats: { locationCount: number; arlCount: number };
  arls: Arl[];
  brands: { id: string; name: string; primaryColor: string | null }[];
  recentAudit: AuditEntry[];
}

interface AllBrand {
  id: string;
  name: string;
  primaryColor: string | null;
}

// Tenant Overview — one investigate-a-tenant task, not a tabbed grab-bag.
// Impersonate/reset-PIN are per-row ARL actions (target one person); the
// Danger Zone below is for tenant-wide, no-specific-target actions only.
export default function TenantOverviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [allBrands, setAllBrands] = useState<AllBrand[]>([]);
  const { dialog, confirm } = useConfirmWithPinDialog();
  const [resetPinTarget, setResetPinTarget] = useState<string | null>(null);
  const [draftNewPin, setDraftNewPin] = useState("");

  // Edit tenant state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Omit<TenantDetail, "id" | "slug">>({
    name: "", plan: "standard", isActive: true,
    appTitle: null, primaryColor: null, maxLocations: null, maxUsers: null, customDomain: null,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Brand management state
  const [addingBrand, setAddingBrand] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [applyTasks, setApplyTasks] = useState(true);
  const [brandSaving, setBrandSaving] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/admin/tenants/${params.id}`).then((r) => r.json()).then((d: Overview) => {
      setData(d);
      if (d.tenant) {
        setEditForm({
          name: d.tenant.name,
          plan: d.tenant.plan,
          isActive: d.tenant.isActive,
          appTitle: d.tenant.appTitle,
          primaryColor: d.tenant.primaryColor,
          maxLocations: d.tenant.maxLocations,
          maxUsers: d.tenant.maxUsers,
          customDomain: d.tenant.customDomain,
        });
      }
    });
  }, [params.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/admin/brands").then((r) => r.json()).then((d: { brands: AllBrand[] }) => setAllBrands(d.brands || []));
  }, []);

  const handleImpersonate = useCallback((arlId: string) => {
    fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hub-request": "1" },
      body: JSON.stringify({ arlId }),
    })
      .then((r) => r.json())
      .then((d: { handoffUrl?: string }) => { if (d.handoffUrl) window.location.href = d.handoffUrl; });
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

  const handleDeleteTenant = useCallback(() => {
    confirm({
      title: "Delete this tenant",
      description: `Permanently deactivates "${data?.tenant.name}". Existing data is preserved but the tenant can no longer log in. This cannot be undone.`,
      confirmLabel: "Delete tenant",
      onConfirm: async (pin) => {
        const res = await fetch("/api/admin/tenants", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", "x-hub-request": "1" },
          body: JSON.stringify({ id: params.id, pin }),
        });
        if (!res.ok) throw new Error("Incorrect PIN");
        router.push("/admin/tenants");
      },
    });
  }, [confirm, params.id, data, router]);

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

  const handleSaveEdit = useCallback(async () => {
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-hub-request": "1" },
        body: JSON.stringify({ id: params.id, ...editForm }),
      });
      if (!res.ok) {
        const d = await res.json();
        setEditError(d.error?.message || "Failed to save");
        return;
      }
      setEditing(false);
      load();
    } catch {
      setEditError("Network error");
    } finally {
      setEditSaving(false);
    }
  }, [params.id, editForm, load]);

  const handleAddBrand = useCallback(async () => {
    if (!selectedBrandId) return;
    setBrandSaving(true);
    try {
      await fetch(`/api/admin/tenants/${params.id}/apply-brand`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hub-request": "1" },
        body: JSON.stringify({ brandId: selectedBrandId, applyTasks }),
      });
      setAddingBrand(false);
      setSelectedBrandId("");
      load();
    } finally {
      setBrandSaving(false);
    }
  }, [params.id, selectedBrandId, applyTasks, load]);

  const handleRemoveBrand = useCallback((brandId: string) => {
    fetch(`/api/admin/tenants/${params.id}/apply-brand`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-hub-request": "1" },
      body: JSON.stringify({ brandId }),
    }).then(() => load());
  }, [params.id, load]);

  if (!data) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const assignedBrandIds = new Set(data.brands.map((b) => b.id));
  const availableBrands = allBrands.filter((b) => !assignedBrandIds.has(b.id));

  return (
    <div className="p-6 max-w-3xl">
      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{data.tenant.name}</h1>
          <p className="font-mono text-xs text-muted-foreground">{data.tenant.slug}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
          <Pencil className="h-3.5 w-3.5" /> {editing ? "Cancel" : "Edit"}
        </Button>
      </div>

      {/* ── Inline edit form ── */}
      {editing && (
        <div className="mb-6 rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Edit tenant</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">App title</label>
              <Input placeholder="Same as name" value={editForm.appTitle ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, appTitle: e.target.value || null }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Plan</label>
              <select
                value={editForm.plan}
                onChange={(e) => setEditForm((f) => ({ ...f, plan: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {["starter", "standard", "pro", "enterprise"].map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Brand color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={editForm.primaryColor ?? "#000000"}
                  onChange={(e) => setEditForm((f) => ({ ...f, primaryColor: e.target.value }))}
                  className="h-9 w-12 cursor-pointer rounded border border-input bg-background p-1"
                />
                <Input
                  placeholder="#000000"
                  value={editForm.primaryColor ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, primaryColor: e.target.value || null }))}
                  className="flex-1 font-mono text-xs"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Max locations</label>
              <Input
                type="number"
                placeholder="Unlimited"
                value={editForm.maxLocations ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, maxLocations: e.target.value ? Number(e.target.value) : null }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Max users</label>
              <Input
                type="number"
                placeholder="Unlimited"
                value={editForm.maxUsers ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, maxUsers: e.target.value ? Number(e.target.value) : null }))}
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Custom domain</label>
              <Input placeholder="e.g. hub.mycompany.com" value={editForm.customDomain ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, customDomain: e.target.value || null }))} />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                id="is-active"
                type="checkbox"
                checked={editForm.isActive}
                onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              <label htmlFor="is-active" className="text-sm text-foreground">Active</label>
            </div>
          </div>
          {editError && <p className="text-xs text-destructive">{editError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => { setEditing(false); setEditError(""); }}>Cancel</Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={editSaving}>{editSaving ? "Saving…" : "Save changes"}</Button>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
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

      {/* ── Brands ── */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Brands</h2>
          {availableBrands.length > 0 && !addingBrand && (
            <button
              onClick={() => setAddingBrand(true)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Add brand
            </button>
          )}
        </div>

        {/* Assigned brand chips with remove button */}
        <div className="flex flex-wrap gap-2">
          {data.brands.length === 0 && !addingBrand && (
            <p className="text-sm text-muted-foreground">No brands assigned.</p>
          )}
          {data.brands.map((b) => (
            <span
              key={b.id}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: (b.primaryColor || "#666") + "22", color: b.primaryColor || undefined }}
            >
              {b.name}
              <button
                onClick={() => handleRemoveBrand(b.id)}
                className="rounded-full opacity-60 hover:opacity-100"
                title="Remove brand"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {/* Add brand inline form */}
          {addingBrand && (
            <div className="mt-1 w-full rounded-lg border border-border bg-card p-3 space-y-2">
              <select
                value={selectedBrandId}
                onChange={(e) => setSelectedBrandId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a brand…</option>
                {availableBrands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={applyTasks}
                  onChange={(e) => setApplyTasks(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Copy brand&apos;s standard tasks into this tenant
              </label>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddBrand} disabled={!selectedBrandId || brandSaving}>
                  {brandSaving ? "Adding…" : "Add brand"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setAddingBrand(false); setSelectedBrandId(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ARL list ── */}
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

      {/* ── Recent activity ── */}
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

      {/* ── Danger Zone ── visually separated, never equal-weight with the
          read-only content above. Tenant-wide, no-specific-target actions
          only; per-ARL actions live as row actions above instead. */}
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" /> Danger Zone
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Force-logout this tenant</p>
            <p className="text-xs text-muted-foreground">Ends every active session immediately.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleForceLogout}>End all sessions</Button>
        </div>

        <div className="flex items-center justify-between border-t border-destructive/20 pt-3">
          <div>
            <p className="text-sm font-medium text-foreground">Destructive data operations</p>
            <p className="text-xs text-muted-foreground">Purge messages, conversations, broadcasts, and more.</p>
          </div>
          <Link href={`/admin/tenants/${params.id}/data-management`}>
            <Button variant="outline" size="sm">Open Data Management <ChevronRight className="h-3.5 w-3.5" /></Button>
          </Link>
        </div>

        <div className="flex items-center justify-between border-t border-destructive/20 pt-3">
          <div>
            <p className="text-sm font-medium text-foreground">Delete tenant</p>
            <p className="text-xs text-muted-foreground">Permanently deactivates this tenant. Existing data is preserved.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleDeleteTenant}>Delete tenant</Button>
        </div>
      </div>

      <ConfirmWithPinDialog {...dialog} />
    </div>
  );
}

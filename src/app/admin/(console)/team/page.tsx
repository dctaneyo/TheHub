"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, KeyRound } from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useConfirmWithPinDialog, ConfirmWithPinDialog } from "@/components/admin/confirm-with-pin-dialog";

interface Admin {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
}

// Manage other platform admins + system maintenance actions
// (vacuum/drop-tables/orphaned-cleanup) — not because this page is
// thematically about admins, but because its low traffic *is* the right
// amount of friction for whole-database operations that affect every
// tenant at once.
export default function TeamPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [form, setForm] = useState({ email: "", name: "", password: "", pin: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { dialog, confirm } = useConfirmWithPinDialog();

  // Credential-change state — tracks which admin row has the inline form open
  const [credTarget, setCredTarget] = useState<string | null>(null);
  const [credForm, setCredForm] = useState({ newPassword: "", newPin: "", confirmPin: "" });
  const [credError, setCredError] = useState("");

  const load = useCallback(() => {
    fetch("/api/admin/team").then((r) => r.json()).then((d) => setAdmins(d.admins || []));
  }, []);

  useEffect(() => { load(); }, [load]);

  const createAdmin = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hub-request": "1" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) {
      setForm({ email: "", name: "", password: "", pin: "" });
      load();
    }
  }, [form, load]);

  const saveCredentials = useCallback(async (id: string) => {
    setCredError("");
    if (!credForm.confirmPin) { setCredError("Enter your current PIN to authorize"); return; }
    const res = await fetch("/api/admin/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-hub-request": "1" },
      body: JSON.stringify({ id, newPassword: credForm.newPassword || undefined, newPin: credForm.newPin || undefined, confirmPin: credForm.confirmPin }),
    });
    if (res.ok) {
      setCredTarget(null);
      setCredForm({ newPassword: "", newPin: "", confirmPin: "" });
    } else {
      const d = await res.json();
      setCredError(d.error?.message || "Failed — check your PIN");
    }
  }, [credForm]);

  const deactivate = useCallback(async (id: string) => {
    await fetch("/api/admin/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-hub-request": "1" },
      body: JSON.stringify({ id }),
    });
    load();
  }, [load]);

  const runSystemAction = useCallback((path: string, label: string) => {
    confirm({
      title: label,
      description: "Whole-database operation, affects every tenant. This cannot be undone.",
      confirmLabel: "Run",
      onConfirm: async (pin) => {
        const res = await fetch(`/api/admin/system/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-hub-request": "1" },
          body: JSON.stringify({ pin, tables: path === "drop-tables" ? ["onboarding_custom_forms", "onboarding_sessions", "onboarding_submissions"] : undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Incorrect PIN");
        setResult(`${label}: ${JSON.stringify(data)}`);
      },
    });
  }, [confirm]);

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold text-foreground">Team</h1>

      <h2 className="mb-2 text-sm font-semibold text-foreground">Platform admins</h2>
      <div className="mb-4 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {admins.map((a) => (
              <>
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{a.name}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{a.email}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className={a.isActive ? "text-emerald-600" : "text-muted-foreground"}>{a.isActive ? "Active" : "Inactive"}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right space-x-3">
                    <button
                      onClick={() => { setCredTarget(credTarget === a.id ? null : a.id); setCredForm({ newPassword: "", newPin: "", confirmPin: "" }); setCredError(""); }}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <KeyRound className="h-3.5 w-3.5" /> Credentials
                    </button>
                    {a.isActive && (
                      <button onClick={() => deactivate(a.id)} className="text-xs text-muted-foreground hover:text-destructive">Deactivate</button>
                    )}
                  </td>
                </tr>
                {credTarget === a.id && (
                  <tr key={`${a.id}-cred`} className="bg-muted/20">
                    <td colSpan={4} className="px-4 py-3">
                      <div className="grid grid-cols-3 gap-2">
                        <Input type="password" placeholder="New password (leave blank to keep)" value={credForm.newPassword} onChange={(e) => setCredForm((f) => ({ ...f, newPassword: e.target.value }))} />
                        <Input placeholder="New PIN (6 digits)" value={credForm.newPin} onChange={(e) => setCredForm((f) => ({ ...f, newPin: e.target.value.replace(/\D/g, "").slice(0, 6) }))} />
                        <Input placeholder="Your current PIN to authorize" value={credForm.confirmPin} onChange={(e) => setCredForm((f) => ({ ...f, confirmPin: e.target.value.replace(/\D/g, "").slice(0, 6) }))} />
                      </div>
                      {credError && <p className="mt-1 text-xs text-destructive">{credError}</p>}
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" onClick={() => saveCredentials(a.id)}>Save</Button>
                        <Button variant="outline" size="sm" onClick={() => { setCredTarget(null); setCredError(""); }}>Cancel</Button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-4">
        <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" />
        <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" />
        <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Password" />
        <Input value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "").slice(0, 6) }))} placeholder="6-digit PIN" />
        <Button onClick={createAdmin} disabled={loading} className="col-span-2"><Plus className="h-4 w-4" /> Add admin</Button>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-foreground">System maintenance</h2>
      <p className="mb-3 text-xs text-muted-foreground">Whole-database operations — never tenant-scoped, never safe to expose to tenant-level ARLs.</p>

      {result && <pre className="mb-3 max-h-32 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs">{result}</pre>}

      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Vacuum &amp; analyze database</p>
            <p className="text-xs text-muted-foreground">Reclaims disk space, rebuilds query statistics.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => runSystemAction("vacuum", "Vacuum database")}>Run</Button>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Drop unused onboarding tables</p>
            <p className="text-xs text-muted-foreground">Removes tables superseded by in-app onboarding.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => runSystemAction("drop-tables", "Drop unused tables")}>Run</Button>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Clean up orphaned rows</p>
            <p className="text-xs text-muted-foreground">Removes rows whose parent record no longer exists.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => runSystemAction("orphaned-cleanup", "Clean up orphaned rows")}>Run</Button>
        </div>
      </div>

      <ConfirmWithPinDialog {...dialog} />
    </div>
  );
}

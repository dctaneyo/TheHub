"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, Edit2, Trash2, UserCheck, UserX,
  Store, Users, Shield, Loader2, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ArlUser {
  id: string;
  name: string;
  email: string | null;
  userId: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface Location {
  id: string;
  name: string;
  storeNumber: string;
  address: string | null;
  email: string | null;
  userId: string;
  isActive: boolean;
  createdAt: string;
}

type Tab = "arls" | "locations";

interface FormState {
  name: string;
  email: string;
  userId: string;
  pin: string;
  role: string;
  storeNumber: string;
  address: string;
}

const EMPTY_FORM: FormState = { name: "", email: "", userId: "", pin: "", role: "arl", storeNumber: "", address: "" };


export function UserManagement() {
  const [tab, setTab] = useState<Tab>("arls");
  const [arls, setArls] = useState<ArlUser[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<ArlUser | Location | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [arlRes, locRes] = await Promise.all([
        fetch("/api/arls"),
        fetch("/api/locations"),
      ]);
      if (arlRes.ok) setArls((await arlRes.json()).arls || []);
      if (locRes.ok) setLocations((await locRes.json()).locations || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const openEdit = (item: ArlUser | Location) => {
    setEditTarget(item);
    if (tab === "arls") {
      const a = item as ArlUser;
      setForm({ ...EMPTY_FORM, name: a.name, email: a.email || "", userId: a.userId, role: a.role });
    } else {
      const l = item as Location;
      setForm({ ...EMPTY_FORM, name: l.name, email: l.email || "", userId: l.userId, storeNumber: l.storeNumber, address: l.address || "" });
    }
    setError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    setError("");
    if (!form.name.trim() || !form.userId || form.userId.length !== 6) {
      setError("Name and 6-digit User ID are required");
      return;
    }
    if (!editTarget && (!form.pin || form.pin.length !== 6)) {
      setError("6-digit PIN is required for new users");
      return;
    }
    if (tab === "locations" && !form.storeNumber.trim()) {
      setError("Store number is required");
      return;
    }

    setSaving(true);
    try {
      let res: Response;
      if (tab === "arls") {
        if (editTarget) {
          res = await fetch("/api/arls", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editTarget.id, name: form.name, email: form.email, pin: form.pin || undefined, role: form.role }),
          });
        } else {
          res = await fetch("/api/arls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: form.name, email: form.email, userId: form.userId, pin: form.pin, role: form.role }),
          });
        }
      } else {
        if (editTarget) {
          res = await fetch("/api/locations", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editTarget.id, name: form.name, email: form.email, pin: form.pin || undefined, address: form.address }),
          });
        } else {
          res = await fetch("/api/locations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: form.name, email: form.email, userId: form.userId, pin: form.pin, storeNumber: form.storeNumber, address: form.address }),
          });
        }
      }
      if (res!.ok) {
        setShowForm(false);
        await fetchData();
      } else {
        const data = await res!.json();
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Network error");
    }
    setSaving(false);
  };

  const handleToggleActive = async (item: ArlUser | Location) => {
    try {
      const endpoint = tab === "arls" ? "/api/arls" : "/api/locations";
      await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
      });
      await fetchData();
    } catch {}
  };

  const handleDelete = async (item: ArlUser | Location) => {
    if (!confirm(`Deactivate ${item.name}?`)) return;
    await handleToggleActive(item);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--hub-red)]" />
      </div>
    );
  }

  const items = tab === "arls" ? arls : locations;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800">User Management</h3>
          <p className="text-xs text-slate-400">{arls.length} ARLs · {locations.length} locations</p>
        </div>
        <Button onClick={openCreate} size="sm" className="flex items-center gap-1.5 rounded-xl bg-[var(--hub-red)] text-xs hover:bg-[#c4001f]">
          <Plus className="h-3.5 w-3.5" />
          Add {tab === "arls" ? "ARL" : "Location"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {(["arls", "locations"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium capitalize transition-colors",
              tab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {t === "arls" ? <Shield className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
            {t === "arls" ? "ARLs" : "Locations"}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {items.length === 0 && (
          <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-slate-200">
            <p className="text-sm text-slate-400">No {tab} yet</p>
          </div>
        )}
        {items.map((item, i) => {
          const isArl = tab === "arls";
          const a = item as ArlUser;
          const l = item as Location;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={cn(
                "flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm",
                !item.isActive && "opacity-50"
              )}
            >
              <div className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                isArl ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
              )}>
                {isArl ? <Shield className="h-4 w-4" /> : <Store className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                  {isArl && (
                    <span className="rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-600">
                      ARL
                    </span>
                  )}
                  {!item.isActive && (
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">Inactive</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">
                  ID: {item.userId}
                  {!isArl && ` · Store #${l.storeNumber}`}
                  {item.email && ` · ${item.email}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => openEdit(item)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleToggleActive(item)}
                  className={cn("flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                    item.isActive ? "text-slate-400 hover:bg-red-50 hover:text-red-500" : "text-slate-400 hover:bg-green-50 hover:text-green-500"
                  )}
                >
                  {item.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Create/Edit modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800">
                  {editTarget ? "Edit" : "New"} {tab === "arls" ? "ARL" : "Location"}
                </h3>
                <button onClick={() => setShowForm(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Name *</label>
                  <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Full name" className="rounded-xl" />
                </div>

                {!editTarget && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">User ID * (6 digits)</label>
                    <Input
                      value={form.userId}
                      onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                      placeholder="000000"
                      className="rounded-xl font-mono"
                      maxLength={6}
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    PIN {editTarget ? "(leave blank to keep current)" : "* (6 digits)"}
                  </label>
                  <div className="relative">
                    <Input
                      type={showPin ? "text" : "password"}
                      value={form.pin}
                      onChange={(e) => setForm((p) => ({ ...p, pin: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                      placeholder="000000"
                      className="rounded-xl font-mono pr-10"
                      maxLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
                  <Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@example.com" className="rounded-xl" type="email" />
                </div>


                {tab === "locations" && !editTarget && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Store Number *</label>
                    <Input value={form.storeNumber} onChange={(e) => setForm((p) => ({ ...p, storeNumber: e.target.value }))} placeholder="e.g. 1004" className="rounded-xl" />
                  </div>
                )}

                {tab === "locations" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Address</label>
                    <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="Street address" className="rounded-xl" />
                  </div>
                )}

                {error && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
                )}

                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full rounded-xl bg-[var(--hub-red)] hover:bg-[#c4001f]"
                >
                  {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : (editTarget ? "Save Changes" : "Create")}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

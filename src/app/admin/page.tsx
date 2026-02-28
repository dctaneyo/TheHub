"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Plus, Pencil, Trash2, Eye, Users, Store,
  Shield, X, Check, Loader2, LogIn, ChevronRight,
  Palette, Globe, Zap, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string | null;
  appTitle: string | null;
  plan: string;
  features: string[];
  maxLocations: number;
  maxUsers: number;
  isActive: boolean;
  customDomain: string | null;
  createdAt: string;
  locationCount?: number;
  userCount?: number;
}

const ALL_FEATURES = [
  "messaging", "tasks", "forms", "gamification",
  "meetings", "analytics", "broadcasts",
];

const PLANS = ["starter", "pro", "enterprise"];

export default function AdminPortal() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formSlug, setFormSlug] = useState("");
  const [formName, setFormName] = useState("");
  const [formAppTitle, setFormAppTitle] = useState("");
  const [formPrimaryColor, setFormPrimaryColor] = useState("#dc2626");
  const [formPlan, setFormPlan] = useState("starter");
  const [formFeatures, setFormFeatures] = useState<string[]>(ALL_FEATURES);
  const [formMaxLocations, setFormMaxLocations] = useState(50);
  const [formMaxUsers, setFormMaxUsers] = useState(20);
  const [formCustomDomain, setFormCustomDomain] = useState("");

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tenants");
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants);
      }
    } catch (err) {
      console.error("Failed to fetch tenants:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const openCreate = () => {
    setEditingTenant(null);
    setFormSlug("");
    setFormName("");
    setFormAppTitle("");
    setFormPrimaryColor("#dc2626");
    setFormPlan("starter");
    setFormFeatures([...ALL_FEATURES]);
    setFormMaxLocations(50);
    setFormMaxUsers(20);
    setFormCustomDomain("");
    setShowForm(true);
  };

  const openEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setFormSlug(tenant.slug);
    setFormName(tenant.name);
    setFormAppTitle(tenant.appTitle || "");
    setFormPrimaryColor(tenant.primaryColor);
    setFormPlan(tenant.plan);
    setFormFeatures(tenant.features);
    setFormMaxLocations(tenant.maxLocations);
    setFormMaxUsers(tenant.maxUsers);
    setFormCustomDomain(tenant.customDomain || "");
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        id: editingTenant?.id,
        slug: formSlug.toLowerCase().replace(/[^a-z0-9-]/g, ""),
        name: formName,
        appTitle: formAppTitle || null,
        primaryColor: formPrimaryColor,
        plan: formPlan,
        features: formFeatures,
        maxLocations: formMaxLocations,
        maxUsers: formMaxUsers,
        customDomain: formCustomDomain || null,
      };
      const res = await fetch("/api/admin/tenants", {
        method: editingTenant ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowForm(false);
        fetchTenants();
      }
    } catch (err) {
      console.error("Save tenant error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tenant? This cannot be undone.")) return;
    try {
      await fetch("/api/admin/tenants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchTenants();
    } catch (err) {
      console.error("Delete tenant error:", err);
    }
  };

  const toggleFeature = (feature: string) => {
    setFormFeatures((prev) =>
      prev.includes(feature)
        ? prev.filter((f) => f !== feature)
        : [...prev, feature]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 shadow-lg">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">The Hub — Super Admin</h1>
              <p className="text-xs text-slate-400">Tenant Management Portal</p>
            </div>
          </div>
          <Button onClick={openCreate} className="bg-red-600 hover:bg-red-700 gap-2">
            <Plus className="h-4 w-4" />
            New Tenant
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="h-5 w-5 text-red-400" />
              <span className="text-sm text-slate-400">Total Tenants</span>
            </div>
            <p className="text-3xl font-bold">{tenants.length}</p>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <div className="flex items-center gap-3 mb-2">
              <Store className="h-5 w-5 text-blue-400" />
              <span className="text-sm text-slate-400">Total Locations</span>
            </div>
            <p className="text-3xl font-bold">{tenants.reduce((s, t) => s + (t.locationCount || 0), 0)}</p>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-5 w-5 text-emerald-400" />
              <span className="text-sm text-slate-400">Total Users</span>
            </div>
            <p className="text-3xl font-bold">{tenants.reduce((s, t) => s + (t.userCount || 0), 0)}</p>
          </div>
        </div>

        {/* Tenants list */}
        <div className="space-y-3">
          {tenants.map((tenant) => (
            <motion.div
              key={tenant.id}
              layout
              className="rounded-2xl bg-white/5 border border-white/10 p-5 hover:bg-white/[0.07] transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shrink-0"
                    style={{ backgroundColor: tenant.primaryColor }}
                  >
                    {tenant.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white truncate">{tenant.name}</h3>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                        tenant.plan === "enterprise" ? "bg-amber-500/20 text-amber-400" :
                        tenant.plan === "pro" ? "bg-blue-500/20 text-blue-400" :
                        "bg-slate-500/20 text-slate-400"
                      )}>{tenant.plan}</span>
                      {!tenant.isActive && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">INACTIVE</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {tenant.slug}.meetthehub.com
                      {tenant.customDomain && ` · ${tenant.customDomain}`}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Store className="h-3 w-3" />{tenant.locationCount || 0} locations</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{tenant.userCount || 0} users</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`https://${tenant.slug}.meetthehub.com`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                    title="Visit tenant"
                  >
                    <Eye className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => openEdit(tenant)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {tenant.slug !== "kazi" && (
                    <button
                      onClick={() => handleDelete(tenant.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Create/Edit Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl bg-slate-800 border border-white/10 p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">
                  {editingTenant ? "Edit Tenant" : "New Tenant"}
                </h3>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400">Slug (subdomain)</label>
                    <Input
                      value={formSlug}
                      onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      placeholder="kfc"
                      className="bg-white/5 border-white/10 text-white"
                      disabled={!!editingTenant}
                    />
                    <p className="text-[10px] text-slate-500 mt-1">{formSlug || "slug"}.meetthehub.com</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400">Franchise Name</label>
                    <Input
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="KFC Franchise"
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400">App Title</label>
                    <Input
                      value={formAppTitle}
                      onChange={(e) => setFormAppTitle(e.target.value)}
                      placeholder="The Hub"
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400">Brand Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formPrimaryColor}
                        onChange={(e) => setFormPrimaryColor(e.target.value)}
                        className="h-9 w-12 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                      <Input
                        value={formPrimaryColor}
                        onChange={(e) => setFormPrimaryColor(e.target.value)}
                        className="bg-white/5 border-white/10 text-white font-mono text-sm flex-1"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">Custom Domain (optional)</label>
                  <Input
                    value={formCustomDomain}
                    onChange={(e) => setFormCustomDomain(e.target.value)}
                    placeholder="hub.kfc.com"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-400">Plan</label>
                  <div className="flex gap-2">
                    {PLANS.map((plan) => (
                      <button
                        key={plan}
                        onClick={() => setFormPlan(plan)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-colors",
                          formPlan === plan
                            ? "bg-red-600 text-white"
                            : "bg-white/5 text-slate-400 hover:bg-white/10"
                        )}
                      >
                        {plan}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-400">Features</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_FEATURES.map((feature) => (
                      <button
                        key={feature}
                        onClick={() => toggleFeature(feature)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors",
                          formFeatures.includes(feature)
                            ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-white/5 text-slate-500 border border-white/10"
                        )}
                      >
                        {formFeatures.includes(feature) && <Check className="inline h-3 w-3 mr-1" />}
                        {feature}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400">Max Locations</label>
                    <Input
                      type="number"
                      value={formMaxLocations}
                      onChange={(e) => setFormMaxLocations(Number(e.target.value))}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400">Max Users (ARLs)</label>
                    <Input
                      type="number"
                      value={formMaxUsers}
                      onChange={(e) => setFormMaxUsers(Number(e.target.value))}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowForm(false)} className="border-white/10 text-slate-300 hover:bg-white/5">
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !formSlug || !formName}
                  className="bg-red-600 hover:bg-red-700 gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {editingTenant ? "Save Changes" : "Create Tenant"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Building2, Palette, Globe, Check, Loader2, Save,
  Users, Store, Zap, Shield, Eye,
} from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTenant } from "@/lib/tenant-context";

interface TenantData {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string | null;
  faviconUrl: string | null;
  appTitle: string | null;
  plan: string;
  features: string[];
  maxLocations: number;
  maxUsers: number;
  isActive: boolean;
  customDomain: string | null;
  createdAt: string;
  updatedAt: string;
}

const PRESET_COLORS = [
  { label: "Red", value: "#dc2626" },
  { label: "Blue", value: "#2563eb" },
  { label: "Green", value: "#059669" },
  { label: "Orange", value: "#d97706" },
  { label: "Purple", value: "#7c3aed" },
  { label: "Pink", value: "#db2777" },
  { label: "Teal", value: "#0d9488" },
  { label: "Indigo", value: "#4f46e5" },
];

export function TenantSettings() {
  const { refetch: refetchTenantContext } = useTenant();
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [appTitle, setAppTitle] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#dc2626");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [customDomain, setCustomDomain] = useState("");

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/tenants/settings");
      if (res.ok) {
        const data = await res.json();
        const t = data.tenant;
        setTenant(t);
        setName(t.name || "");
        setAppTitle(t.appTitle || "");
        setPrimaryColor(t.primaryColor || "#dc2626");
        setLogoUrl(t.logoUrl || "");
        setFaviconUrl(t.faviconUrl || "");
        setCustomDomain(t.customDomain || "");
      }
    } catch (err) {
      console.error("Failed to fetch tenant settings:", err);
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/tenants/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Hub-Request": "1" },
        body: JSON.stringify({
          name,
          appTitle: appTitle || null,
          primaryColor,
          logoUrl: logoUrl || null,
          faviconUrl: faviconUrl || null,
          customDomain: customDomain || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || data.error || "Failed to save");
        return;
      }
      const data = await res.json();
      setTenant(data.tenant);
      setSaved(true);
      // Refresh the global tenant context so branding updates immediately
      refetchTenantContext();
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Connection failed");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    tenant &&
    (name !== tenant.name ||
      (appTitle || "") !== (tenant.appTitle || "") ||
      primaryColor !== tenant.primaryColor ||
      (logoUrl || "") !== (tenant.logoUrl || "") ||
      (faviconUrl || "") !== (tenant.faviconUrl || "") ||
      (customDomain || "") !== (tenant.customDomain || ""));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Unable to load organization settings
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Organization Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Customize your hub's branding and configuration
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={cn(
            "gap-2 min-w-[120px]",
            saved
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-[var(--hub-red)] hover:bg-[var(--hub-red)]/90"
          )}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <>
              <Check className="h-4 w-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Plan info card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card p-5"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
            <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Current Plan</h3>
            <p className="text-xs text-muted-foreground">Your organization's subscription</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Plan</p>
            <p className="text-lg font-bold capitalize text-foreground">{tenant.plan}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Store className="h-3 w-3" /> Max Locations</p>
            <p className="text-lg font-bold text-foreground">{tenant.maxLocations}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Max Users</p>
            <p className="text-lg font-bold text-foreground">{tenant.maxUsers}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tenant.features.map((f: string) => (
            <span
              key={f}
              className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 capitalize"
            >
              {f}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Branding section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-border bg-card p-5"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
            <Palette className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Branding</h3>
            <p className="text-xs text-muted-foreground">Customize how your hub looks</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Organization Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">App Title</label>
              <Input
                value={appTitle}
                onChange={(e) => setAppTitle(e.target.value)}
                placeholder={`${name || "Your"} Hub`}
                className="h-10"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">Shown in browser tab & sidebar</p>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Brand Color</label>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-14 rounded-lg cursor-pointer bg-transparent border-0"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-28 font-mono text-sm h-10"
              />
              <div className="flex gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setPrimaryColor(c.value)}
                    title={c.label}
                    className={cn(
                      "h-8 w-8 rounded-lg border-2 transition-all",
                      primaryColor === c.value ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider font-semibold">Live Preview</p>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-black shadow-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {(name || "H").charAt(0).toUpperCase()}
              </div>
              <span className="font-bold text-foreground">{appTitle || `${name || "Your"} Hub`}</span>
            </div>
            <div className="flex gap-2">
              <div
                className="h-7 rounded-lg px-3 flex items-center text-white text-xs font-semibold"
                style={{ backgroundColor: primaryColor }}
              >
                Primary
              </div>
              <div
                className="h-7 rounded-lg px-3 flex items-center text-xs font-semibold border"
                style={{ borderColor: primaryColor, color: primaryColor }}
              >
                Secondary
              </div>
              <div
                className="h-7 rounded-lg px-3 flex items-center text-xs font-semibold"
                style={{ backgroundColor: primaryColor + "15", color: primaryColor }}
              >
                Accent
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* URLs section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-border bg-card p-5"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Domain & Assets</h3>
            <p className="text-xs text-muted-foreground">URLs and external assets</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Hub URL</label>
            <div className="flex items-center gap-2">
              <Input
                value={`${tenant.slug}.meetthehub.com`}
                disabled
                className="h-10 font-mono text-sm bg-muted/50"
              />
              <a
                href={`https://${tenant.slug}.meetthehub.com`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Eye className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Custom Domain (optional)</label>
            <Input
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="hub.yourcompany.com"
              className="h-10"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">Point a CNAME record to meetthehub.com</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Logo URL (optional)</label>
              <Input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
                className="h-10"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Favicon URL (optional)</label>
              <Input
                value={faviconUrl}
                onChange={(e) => setFaviconUrl(e.target.value)}
                placeholder="https://..."
                className="h-10"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Info footer */}
      <div className="rounded-xl bg-muted/30 p-4 text-xs text-muted-foreground flex items-center gap-2">
        <Shield className="h-4 w-4 shrink-0" />
        <span>
          Only tenant admins can modify organization settings. Plan upgrades and feature changes require a super admin.
        </span>
      </div>
    </div>
  );
}

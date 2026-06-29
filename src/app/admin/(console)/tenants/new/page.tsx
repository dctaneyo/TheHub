"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, ChevronLeft } from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Brand {
  id: string;
  name: string;
}

type Step = "tenant" | "admin" | "brands";

// Provisioning bundles real sequential decisions (tenant info → first ARL
// credentials → optional brand selection) — a short wizard, not one long
// mega-form, which is what made the old admin page feel like a form dump.
export default function NewTenantPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("tenant");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    slug: "", name: "", plan: "starter",
    adminName: "", adminUserId: "", adminPin: "",
  });

  useEffect(() => {
    fetch("/api/admin/brands").then((r) => r.json()).then((d) => setBrands(d.brands || []));
  }, []);

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const toggleBrand = (id: string) => {
    setSelectedBrandIds((prev) => prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]);
  };

  const handleSubmit = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hub-request": "1" },
        body: JSON.stringify({ ...form, brandIds: selectedBrandIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to create tenant");
        return;
      }
      router.push(`/admin/tenants/${data.id}`);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }, [form, selectedBrandIds, router]);

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">New tenant</h1>
      <p className="mb-6 text-sm text-muted-foreground">Step {step === "tenant" ? 1 : step === "admin" ? 2 : 3} of 3</p>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {step === "tenant" && (
        <div className="space-y-3">
          <label className="text-xs font-semibold text-muted-foreground">Tenant name</label>
          <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Acme Restaurants" autoFocus />
          <label className="text-xs font-semibold text-muted-foreground">Organization ID (slug)</label>
          <Input value={form.slug} onChange={(e) => update("slug", e.target.value.toLowerCase())} placeholder="acme" />
          <p className="text-xs text-muted-foreground">Tenants sign in at meetthehub.com/login with this as their Organization ID — there&apos;s no per-tenant subdomain.</p>
          <Button className="w-full" onClick={() => setStep("admin")} disabled={!form.name || !form.slug}>Continue</Button>
        </div>
      )}

      {step === "admin" && (
        <div className="space-y-3">
          <label className="text-xs font-semibold text-muted-foreground">First ARL&apos;s name</label>
          <Input value={form.adminName} onChange={(e) => update("adminName", e.target.value)} placeholder="Jane Doe" autoFocus />
          <label className="text-xs font-semibold text-muted-foreground">User ID (4 digits)</label>
          <Input value={form.adminUserId} onChange={(e) => update("adminUserId", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" />
          <label className="text-xs font-semibold text-muted-foreground">PIN (4 digits)</label>
          <Input type="password" value={form.adminPin} onChange={(e) => update("adminPin", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="5678" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("tenant")}><ChevronLeft className="h-4 w-4" /> Back</Button>
            <Button className="flex-1" onClick={() => setStep("brands")} disabled={!form.adminName || form.adminUserId.length !== 4 || form.adminPin.length !== 4}>Continue</Button>
          </div>
        </div>
      )}

      {step === "brands" && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">Apply a brand&apos;s standard tasks? (optional)</p>
          {brands.length === 0 ? (
            <p className="text-sm text-muted-foreground">No brands created yet — skip this step.</p>
          ) : (
            <div className="space-y-1.5">
              {brands.map((b) => (
                <label key={b.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <input type="checkbox" checked={selectedBrandIds.includes(b.id)} onChange={() => toggleBrand(b.id)} />
                  {b.name}
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("admin")}><ChevronLeft className="h-4 w-4" /> Back</Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create tenant"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

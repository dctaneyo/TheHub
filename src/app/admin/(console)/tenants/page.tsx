"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, CheckCircle2, AlertCircle } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  plan: string;
  isActive: boolean;
  locationCount: number;
  userCount: number;
  brands: { name: string; primaryColor: string | null }[];
}

interface BackupHealth {
  lastByType: Record<string, string | null>;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "<1h ago";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function isStale(iso: string | null): boolean {
  return !iso || Date.now() - new Date(iso).getTime() > 36 * 3_600_000;
}

export default function TenantsListPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [backups, setBackups] = useState<BackupHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/tenants").then((r) => r.json()),
      fetch("/api/admin/system/backups").then((r) => r.json()),
    ]).then(([tenantsData, backupData]) => {
      setTenants(tenantsData.tenants || []);
      setBackups(backupData);
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Tenants</h1>
        <Link href="/admin/tenants/new">
          <Button><Plus className="h-4 w-4" /> New tenant</Button>
        </Link>
      </div>

      {/* Passive backup-health strip — ambient signal, no action attached.
          System maintenance actions live under /admin/team instead. */}
      {backups && (
        <div className="mb-4 flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-2 text-xs text-muted-foreground">
          {(["daily", "weekly", "monthly"] as const).map((type) => {
            const last = backups.lastByType[type];
            const stale = isStale(last);
            return (
              <span key={type} className="flex items-center gap-1.5">
                {stale ? <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                <span className="capitalize">{type}</span>: {timeAgo(last)}
              </span>
            );
          })}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Org ID</th>
                <th className="px-4 py-2">Brands</th>
                <th className="px-4 py-2">Locations</th>
                <th className="px-4 py-2">ARLs</th>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/tenants/${t.id}`} className="font-medium text-foreground hover:underline">
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{t.slug}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      {t.brands.map((b) => (
                        <Badge key={b.name} style={{ backgroundColor: (b.primaryColor || "#666") + "22", color: b.primaryColor || undefined }}>
                          {b.name}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-mono">{t.locationCount}</td>
                  <td className="px-4 py-2.5 font-mono">{t.userCount}</td>
                  <td className="px-4 py-2.5 capitalize">{t.plan}</td>
                  <td className="px-4 py-2.5">
                    <span className={t.isActive ? "text-emerald-600" : "text-muted-foreground"}>
                      {t.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

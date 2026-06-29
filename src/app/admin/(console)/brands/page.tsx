"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus } from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Brand {
  id: string;
  name: string;
  primaryColor: string | null;
  tenantCount: number;
  taskTemplateCount: number;
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/brands").then((r) => r.json()).then((d) => setBrands(d.brands || []));
  }, []);

  useEffect(() => { load(); }, [load]);

  const createBrand = useCallback(async () => {
    if (!newName.trim()) return;
    setLoading(true);
    await fetch("/api/admin/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hub-request": "1" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setNewName("");
    setLoading(false);
    load();
  }, [newName, load]);

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold text-foreground">Brands</h1>

      <div className="mb-4 flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New brand name" className="max-w-xs" />
        <Button onClick={createBrand} disabled={loading || !newName.trim()}><Plus className="h-4 w-4" /> Add brand</Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Tenants</th>
              <th className="px-4 py-2">Standard tasks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {brands.map((b) => (
              <tr key={b.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/brands/${b.id}`} className="font-medium text-foreground hover:underline">{b.name}</Link>
                </td>
                <td className="px-4 py-2.5 font-mono">{b.tenantCount}</td>
                <td className="px-4 py-2.5 font-mono">{b.taskTemplateCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

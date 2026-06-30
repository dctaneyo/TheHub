"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2 } from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Template {
  id: string;
  title: string;
  dueTime: string;
  priority: string;
}

export default function BrandDetailPage() {
  const params = useParams<{ id: string }>();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState({ title: "", dueTime: "09:00" });
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/admin/brands/${params.id}/tasks`).then((r) => r.json()).then((d) => setTemplates(d.templates || []));
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  const addTemplate = useCallback(async () => {
    if (!form.title.trim()) return;
    setLoading(true);
    await fetch(`/api/admin/brands/${params.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hub-request": "1" },
      body: JSON.stringify({ title: form.title.trim(), dueTime: form.dueTime }),
    });
    setForm({ title: "", dueTime: "09:00" });
    setLoading(false);
    load();
  }, [form, params.id, load]);

  const removeTemplate = useCallback(async (templateId: string) => {
    await fetch(`/api/admin/brands/${params.id}/tasks`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-hub-request": "1" },
      body: JSON.stringify({ templateId }),
    });
    load();
  }, [params.id, load]);

  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Standard tasks</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Copied into a tenant&apos;s task list once, when the brand is applied — editing this list later doesn&apos;t retroactively change tenants that already adopted it.
      </p>

      <div className="mb-4 flex gap-2">
        <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Task title" className="max-w-xs" />
        <Input type="time" value={form.dueTime} onChange={(e) => setForm((f) => ({ ...f, dueTime: e.target.value }))} className="w-32" />
        <Button onClick={addTemplate} disabled={loading || !form.title.trim()}><Plus className="h-4 w-4" /> Add task</Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {templates.map((t) => (
              <tr key={t.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{t.title}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{t.dueTime}</td>
                <td className="px-4 py-2.5 text-xs capitalize text-muted-foreground">{t.priority}</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => removeTemplate(t.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

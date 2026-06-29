"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Sparkles, ClipboardList, Users, LogOut } from "@/lib/icons";
import { VIEW_ROUTE_MAP, VIEW_LABELS, getViewFromPathname, type AdminView } from "@/lib/admin-views";
import { cn } from "@/lib/utils";

const ICONS: Record<AdminView, React.ComponentType<{ className?: string }>> = {
  tenants: Building2,
  brands: Sparkles,
  "audit-log": ClipboardList,
  team: Users,
};

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const activeView = getViewFromPathname(pathname);

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE", headers: { "x-hub-request": "1" } });
    router.push("/admin/login");
  };

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center border-b border-border px-4">
        <div>
          <p className="text-sm font-bold text-foreground">The Hub</p>
          <p className="text-xs text-muted-foreground">Admin Console</p>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3">
        {(Object.keys(VIEW_ROUTE_MAP) as AdminView[]).map((view) => {
          const Icon = ICONS[view];
          const isActive = activeView === view;
          return (
            <Link
              key={view}
              href={VIEW_ROUTE_MAP[view]}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors mb-0.5",
                isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {VIEW_LABELS[view]}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-2">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}

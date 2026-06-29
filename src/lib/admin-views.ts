/**
 * Shared Admin Console view types and route-mapping utilities. Parallels
 * arl-views.ts. Flat nav — Tenants, Brands, Audit Log, Team — no nested
 * sections, since the console itself has only four top-level destinations.
 */

export type AdminView = "tenants" | "brands" | "audit-log" | "team";

export const VIEW_ROUTE_MAP: Record<AdminView, string> = {
  tenants: "/admin/tenants",
  brands: "/admin/brands",
  "audit-log": "/admin/audit-log",
  team: "/admin/team",
};

export const VIEW_LABELS: Record<AdminView, string> = {
  tenants: "Tenants",
  brands: "Brands",
  "audit-log": "Audit Log",
  team: "Team",
};

export function getViewFromPathname(pathname: string): AdminView | null {
  if (pathname.startsWith("/admin/tenants")) return "tenants";
  if (pathname.startsWith("/admin/brands")) return "brands";
  if (pathname.startsWith("/admin/audit-log")) return "audit-log";
  if (pathname.startsWith("/admin/team")) return "team";
  return null;
}

"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  LogOut,
  MessageCircle,
  ClipboardList,
  Users,
  Store,
  CalendarDays,
  X,
  Radio,
  Monitor,
  Database,
  Video,
  TrendingUp,
  BarChart3,
  Settings,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { VIEW_PERMISSIONS, PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import { useTenant } from "@/lib/tenant-context";
import type { ArlView } from "@/lib/arl-views";
import { VIEW_ROUTE_MAP } from "@/lib/arl-views";

// Map additional sidebar views to the permissions that govern whether the ARL
// should see them at all. Views not listed here are always visible.
const SIDEBAR_PERM_MAP: Partial<Record<string, PermissionKey[]>> = {
  emergency: [PERMISSIONS.EMERGENCY_ACCESS],
  "data-management": [PERMISSIONS.DATA_MANAGEMENT_ACCESS],
  analytics: [PERMISSIONS.ANALYTICS_ACCESS],
};

// `group` drives the section label rendered above the first visible item of
// each group (see the nav render below) — a flat 12-item list gave every
// item, from "Overview" (touched constantly) to "Organization" (set up once
// and rarely revisited), the same visual weight. Two labeled clusters cost
// nothing structurally (still one list, same items, same routes) but mark
// that tier difference at a glance. Derived from the filtered list at render
// time rather than a hardcoded index, so it stays correct regardless of
// which items a given role's permissions hide.
//
// Order within each group is frequency/importance, not alphabetical or
// historical. One deliberate exception: Emergency Broadcast sits 2nd in
// Operations despite being the least *frequently* used item there — when
// it's actually needed, speed-to-find matters more than click frequency, the
// same reasoning this app already applies to safety-critical alert headings
// (Section 1's font-black exception). Everything else in both groups is
// ordered by realistic daily-driver-to-rarely-touched frequency.
export const navItems = [
  { id: "overview" as const, label: "Overview", icon: BarChart3, group: "Operations" },
  { id: "emergency" as const, label: "Emergency Broadcast", icon: Radio, group: "Operations" },
  { id: "messages" as const, label: "Messages", icon: MessageCircle, group: "Operations" },
  { id: "tasks" as const, label: "Tasks & Reminders", icon: ClipboardList, group: "Operations" },
  { id: "locations" as const, label: "Locations", icon: Store, group: "Operations" },
  { id: "calendar" as const, label: "Calendar", icon: CalendarDays, group: "Operations" },
  { id: "meetings" as const, label: "Meetings", icon: Video, group: "Operations" },
  { id: "users" as const, label: "Users", icon: Users, group: "Administration" },
  { id: "remote" as const, label: "Remote", icon: Monitor, group: "Administration" },
  { id: "analytics" as const, label: "Analytics", icon: TrendingUp, group: "Administration" },
  { id: "data-management" as const, label: "Data Management", icon: Database, group: "Administration" },
  { id: "tenant-settings" as const, label: "Organization", icon: Settings, group: "Administration" },
];

interface ArlSidebarProps {
  user: { name?: string; role?: string; permissions?: string[] } | null;
  activeView: ArlView;
  onViewChange: (view: ArlView) => void;
  isMobileOrTablet: boolean;
  sidebarOpen: boolean;
  onClose: () => void;
  unreadCount: number;
  onlineCount: number;
  onLogout: () => void;
}

export function ArlSidebar({
  user,
  activeView,
  onViewChange,
  isMobileOrTablet,
  sidebarOpen,
  onClose,
  unreadCount,
  onlineCount,
  onLogout,
}: ArlSidebarProps) {
  const { tenant } = useTenant();
  const brandInitial = (tenant?.name || "H").charAt(0).toUpperCase();
  const brandTitle = tenant?.appTitle || tenant?.name || "The Hub";
  return (
    <motion.aside
      className={cn(
        "z-[150] flex flex-col border-r border-border bg-card",
        isMobileOrTablet
          ? "fixed inset-y-0 left-0 w-[280px] shadow-xl"
          : "relative w-[260px] shrink-0"
      )}
      initial={isMobileOrTablet ? { x: -280 } : false}
      animate={
        isMobileOrTablet
          ? { x: sidebarOpen ? 0 : -280 }
          : { x: 0 }
      }
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Sidebar header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--hub-red)]">
            <span className="text-sm font-black text-white">{brandInitial}</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">{brandTitle}</h1>
            <p className="text-xs text-muted-foreground">ARL Console</p>
          </div>
        </div>
        {isMobileOrTablet && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground active:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* User info */}
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-foreground">{user?.name}</p>
        <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems
          .filter((item) => {
            // Admins see everything
            if (user?.role === "admin") return true;
            const requiredPerms = SIDEBAR_PERM_MAP[item.id];
            if (!requiredPerms) return true; // no restriction
            const userPerms = user?.permissions;
            if (!userPerms) return true; // null/undefined = all
            return requiredPerms.some((p) => userPerms.includes(p));
          })
          .map((item, i, visible) => {
            const isActive = activeView === item.id;
            const badge = item.id === "messages" && unreadCount > 0 ? unreadCount : 0;
            const onlineBadge = item.id === "locations" && onlineCount > 0 ? onlineCount : 0;
            const isNewGroup = i === 0 || visible[i - 1].group !== item.group;
            return (
              <div key={item.id}>
                {isNewGroup && (
                  <p className={cn(
                    "px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70",
                    i === 0 ? "pb-1" : "pb-1 pt-3"
                  )}>
                    {item.group}
                  </p>
                )}
                <Link
                  href={VIEW_ROUTE_MAP[item.id] || "/arl"}
                  prefetch={true}
                  onClick={() => {
                    onViewChange(item.id);
                    if (isMobileOrTablet) onClose();
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all",
                    isActive
                      ? "bg-[var(--hub-red)] text-white"
                      : "text-muted-foreground active:bg-muted"
                  )}
                >
                  <item.icon className="h-4.5 w-4.5 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {badge > 0 && (
                    <span className={cn(
                      "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold",
                      isActive ? "bg-white text-[var(--hub-red)]" : "bg-[var(--hub-red)] text-white"
                    )}>
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                  {onlineBadge > 0 && (
                    <span className={cn(
                      "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold",
                      isActive ? "bg-white text-emerald-600" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                    )}>
                      {onlineBadge}
                    </span>
                  )}
                </Link>
              </div>
            );
          })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border p-3 space-y-1">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors active:bg-red-50 active:text-red-600 dark:active:bg-red-950"
        >
          <LogOut className="h-4.5 w-4.5" />
          Sign Out
        </button>
      </div>
    </motion.aside>
  );
}

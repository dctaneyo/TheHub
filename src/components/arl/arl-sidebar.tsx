"use client";

import { motion } from "framer-motion";
import {
  LogOut,
  MessageCircle,
  ClipboardList,
  Users,
  Store,
  CalendarDays,
  X,
  Radio,
  Trophy,
  Monitor,
  Database,
  Video,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ArlView = "overview" | "messages" | "tasks" | "calendar" | "locations" | "forms" | "emergency" | "users" | "leaderboard" | "remote-login" | "data-management" | "broadcast" | "meetings" | "analytics";

export const navItems = [
  { id: "overview" as const, label: "Overview", icon: BarChart3 },
  { id: "messages" as const, label: "Messages", icon: MessageCircle },
  { id: "tasks" as const, label: "Tasks & Reminders", icon: ClipboardList },
  { id: "calendar" as const, label: "Calendar", icon: CalendarDays },
  { id: "leaderboard" as const, label: "Leaderboard", icon: Trophy },
  { id: "locations" as const, label: "Locations", icon: Store },
  { id: "meetings" as const, label: "Meetings", icon: Video },
  { id: "emergency" as const, label: "Emergency Broadcast", icon: Radio },
  { id: "users" as const, label: "Users", icon: Users },
  { id: "remote-login" as const, label: "Remote Login", icon: Monitor },
  { id: "data-management" as const, label: "Data Management", icon: Database },
  { id: "analytics" as const, label: "Analytics", icon: TrendingUp },
];

interface ArlSidebarProps {
  user: { name?: string; role?: string } | null;
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
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--hub-red)] shadow-sm">
            <span className="text-sm font-black text-white">H</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">The Hub</h1>
            <p className="text-[10px] text-muted-foreground">ARL Dashboard</p>
          </div>
        </div>
        {isMobileOrTablet && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
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
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          const badge = item.id === "messages" && unreadCount > 0 ? unreadCount : 0;
          const onlineBadge = item.id === "locations" && onlineCount > 0 ? onlineCount : 0;
          return (
            <button
              key={item.id}
              onClick={() => {
                onViewChange(item.id);
                if (isMobileOrTablet) onClose();
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-[var(--hub-red)] text-white shadow-sm shadow-red-200"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {badge > 0 && (
                <span className={cn(
                  "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                  isActive ? "bg-white text-[var(--hub-red)]" : "bg-[var(--hub-red)] text-white"
                )}>
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
              {onlineBadge > 0 && (
                <span className={cn(
                  "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                  isActive ? "bg-white text-emerald-600" : "bg-emerald-100 text-emerald-700"
                )}>
                  {onlineBadge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border p-3 space-y-1">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
        >
          <LogOut className="h-4.5 w-4.5" />
          Sign Out
        </button>
      </div>
    </motion.aside>
  );
}

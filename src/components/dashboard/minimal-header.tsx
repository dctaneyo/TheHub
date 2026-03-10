"use client";

import { useState } from "react";
import {
  LogOut,
  MessageCircle,
  CalendarDays,
  FileText,
  LayoutGrid,
  X,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { ConnectionStatus } from "@/components/connection-status";
import { NotificationBell } from "@/components/notification-bell";
import { DashboardSettings } from "@/components/dashboard/dashboard-settings";
import { type TaskItem } from "@/components/dashboard/timeline";
import { GamificationHub } from "@/components/dashboard/gamification-hub";
import { useLayout, LAYOUT_OPTIONS } from "@/lib/layout-context";

interface MinimalHeaderProps {
  user: { id?: string; name?: string; storeNumber?: string } | null;
  displayTime: string;
  allTasks: TaskItem[];
  currentTime: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  screensaverEnabled: boolean;
  onToggleScreensaver: () => void;
  onShowScreensaver: () => void;
  chatOpen: boolean;
  onToggleChat: () => void;
  chatUnread: number;
  onOpenForms: () => void;
  onOpenCalendar: () => void;
  onLogout: () => void;
}

export function MinimalHeader({
  user,
  displayTime,
  allTasks,
  currentTime,
  soundEnabled,
  onToggleSound,
  screensaverEnabled,
  onToggleScreensaver,
  onShowScreensaver,
  chatOpen,
  onToggleChat,
  chatUnread,
  onOpenForms,
  onOpenCalendar,
  onLogout,
}: MinimalHeaderProps) {
  const [layoutDropdownOpen, setLayoutDropdownOpen] = useState(false);
  const { layout, setLayout } = useLayout();

  return (
    <header className="sticky top-0 flex h-12 shrink-0 items-center border-b border-border bg-card/80 backdrop-blur-md px-4 z-[100]">
      {/* Left: Logo + Store */}
      <div className="flex items-center gap-2 shrink-0 relative">
        <button
          onClick={() => setLayoutDropdownOpen(!layoutDropdownOpen)}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--hub-red)] shadow-sm hover:brightness-110 transition-colors"
          title="Change layout"
        >
          <span className="text-xs font-black text-white">H</span>
        </button>

        {/* Layout Dropdown */}
        {layoutDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 w-56 rounded-lg border border-border bg-card shadow-lg overflow-hidden z-[200]">
            <div className="p-2 border-b border-border">
              <p className="text-xs font-bold text-foreground">Dashboard Layout</p>
            </div>
            {LAYOUT_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  setLayout(option.id);
                  setLayoutDropdownOpen(false);
                }}
                className={cn(
                  "w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-muted transition-colors",
                  layout === option.id && "bg-muted"
                )}
              >
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{option.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{option.description}</p>
                </div>
                {layout === option.id && (
                  <div className="h-2 w-2 rounded-full bg-[var(--hub-red)]" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Click outside to close */}
        {layoutDropdownOpen && (
          <div
            className="fixed inset-0 z-[199]"
            onClick={() => setLayoutDropdownOpen(false)}
          />
        )}
        <div className="hidden md:block">
          <p className="text-xs font-bold text-foreground leading-none">
            {user?.name}
          </p>
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
            #{user?.storeNumber}
          </p>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <GamificationHub locationId={user?.id} />

        <div className="hidden sm:block">
          <ConnectionStatus />
        </div>

        <button
          onClick={onOpenForms}
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Forms"
        >
          <FileText className="h-4 w-4" />
        </button>

        <button
          onClick={onOpenCalendar}
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Calendar"
        >
          <CalendarDays className="h-4 w-4" />
        </button>

        <button
          onClick={onToggleChat}
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Chat"
        >
          <MessageCircle className="h-4 w-4" />
          {chatUnread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--hub-red)] text-[8px] font-bold text-white">
              {chatUnread}
            </span>
          )}
        </button>

        <NotificationBell
          tasks={allTasks}
          currentTime={currentTime}
          soundEnabled={soundEnabled}
          locationId={user?.id}
        />

        <DashboardSettings
          soundEnabled={soundEnabled}
          onToggleSound={onToggleSound}
          screensaverEnabled={screensaverEnabled}
          onToggleScreensaver={onToggleScreensaver}
          onShowScreensaver={onShowScreensaver}
        />

        <button
          onClick={onLogout}
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

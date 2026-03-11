"use client";

import { useState } from "react";
import {
  LogOut,
  MessageCircle,
  CalendarDays,
  FileText,
  LayoutGrid,
  Volume2,
  VolumeX,
  Monitor,
  MonitorOff,
  Play,
  Sun,
  Moon,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { ConnectionStatus } from "@/components/connection-status";
import { NotificationBell } from "@/components/notification-bell";
import { type TaskItem } from "@/components/dashboard/timeline";
import { GamificationHub } from "@/components/dashboard/gamification-hub";
import { useLayout, LAYOUT_OPTIONS } from "@/lib/layout-context";
import { ThemeToggle } from "@/components/theme-toggle";

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

        {/* Hub Dropdown - All Options */}
        {layoutDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 rounded-2xl border border-border bg-card shadow-xl overflow-hidden z-[200]">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Hub Menu</p>
            </div>

            <div className="p-2 space-y-1">
              {/* Sound toggle */}
              <button
                onClick={onToggleSound}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted transition-colors text-left"
              >
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  soundEnabled ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" : "bg-red-50 text-red-400 dark:bg-red-950 dark:text-red-400"
                )}>
                  {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Notification Sound</p>
                  <p className="text-[11px] text-muted-foreground">{soundEnabled ? "Sounds on" : "Muted"}</p>
                </div>
                <div className={cn(
                  "h-5 w-9 rounded-full transition-colors relative",
                  soundEnabled ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
                )}>
                  <div className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                    soundEnabled ? "translate-x-4" : "translate-x-0.5"
                  )} />
                </div>
              </button>

              {/* Theme toggle */}
              <div className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <Sun className="h-4 w-4 dark:hidden" />
                  <Moon className="h-4 w-4 hidden dark:block" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Theme</p>
                  <p className="text-[11px] text-muted-foreground">Light / Dark / System</p>
                </div>
                <ThemeToggle />
              </div>

              <div className="border-t border-border mx-2 my-1" />

              {/* Layout selector */}
              <div className="px-3 pt-1.5 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Layout</p>
                <div className="flex gap-1.5">
                  {LAYOUT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setLayout(opt.id)}
                      className={cn(
                        "flex-1 rounded-lg px-2.5 py-2 text-center transition-colors border",
                        layout === opt.id
                          ? "border-[var(--hub-red)]/30 bg-[var(--hub-red)]/10 text-[var(--hub-red)]"
                          : "border-border hover:bg-muted text-foreground"
                      )}
                    >
                      <LayoutGrid className={cn("h-3.5 w-3.5 mx-auto mb-0.5", layout === opt.id && "text-[var(--hub-red)]")} />
                      <p className="text-[10px] font-bold">{opt.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border mx-2 my-1 sm:hidden" />

              {/* Forms - visible on mobile only */}
              <button
                onClick={() => { onOpenForms(); setLayoutDropdownOpen(false); }}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted transition-colors text-left sm:hidden"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Forms</p>
                  <p className="text-[11px] text-muted-foreground">View all forms</p>
                </div>
              </button>

              {/* Calendar - visible on mobile only */}
              <button
                onClick={() => { onOpenCalendar(); setLayoutDropdownOpen(false); }}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted transition-colors text-left sm:hidden"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Calendar</p>
                  <p className="text-[11px] text-muted-foreground">View calendar</p>
                </div>
              </button>

              <div className="border-t border-border mx-2 my-1 sm:hidden" />

              {/* Logout */}
              <button
                onClick={() => { onLogout(); setLayoutDropdownOpen(false); }}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-left"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-400">
                  <LogOut className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Logout</p>
                  <p className="text-[11px] text-muted-foreground">Sign out</p>
                </div>
              </button>
            </div>
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
          className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-muted/80"
          title="Forms"
        >
          <FileText className="h-[18px] w-[18px]" />
        </button>

        <button
          onClick={onOpenCalendar}
          className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-muted/80"
          title="Calendar"
        >
          <CalendarDays className="h-[18px] w-[18px]" />
        </button>

        <button
          onClick={onToggleChat}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-muted/80"
          title="Chat"
        >
          <MessageCircle className="h-[18px] w-[18px]" />
          {chatUnread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--hub-red)] text-[10px] font-bold text-white">
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
      </div>
    </header>
  );
}

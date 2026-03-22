"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import {
  LogOut,
  MessageCircle,
  CalendarDays,
  FileText,
  Volume2,
  VolumeX,
  LayoutGrid,
  Sun,
  Moon,
  Monitor,
  MonitorOff,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { ConnectionStatus } from "@/components/connection-status";
import { GamificationHub } from "@/components/dashboard/gamification-hub";
import { NotificationBell } from "@/components/notification-bell";
import { type TaskItem } from "@/components/dashboard/timeline";
import { useLayout, LAYOUT_OPTIONS } from "@/lib/layout-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTenant } from "@/lib/tenant-context";

interface DashboardHeaderProps {
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

export function DashboardHeader({
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
}: DashboardHeaderProps) {
  const { tenant } = useTenant();
  const brandInitial = (tenant?.name || "H").charAt(0).toUpperCase();
  const brandTitle = tenant?.appTitle || tenant?.name || "The Hub";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { layout, setLayout } = useLayout();
  const [mobileMenuPos, setMobileMenuPos] = useState<{ top: number; left: number } | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileMenuOpen]);

  // Compute fixed position when mobile menu opens
  useEffect(() => {
    if (mobileMenuOpen && mobileMenuRef.current) {
      const rect = mobileMenuRef.current.getBoundingClientRect();
      setMobileMenuPos({ top: rect.bottom + 8, left: rect.left });
    }
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 flex h-16 shrink-0 items-center border-b border-border bg-card px-4 md:px-6 z-[100]">
      <div className="flex items-center gap-3 shrink-0">
        <div className="relative" ref={mobileMenuRef}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-full bg-[var(--hub-red)] shadow-sm transition-transform active:scale-95"
          >
            <span className="text-base font-black text-white">{brandInitial}</span>
          </button>
          <div className="hidden md:flex h-9 w-9 items-center justify-center rounded-full bg-[var(--hub-red)] shadow-sm">
            <span className="text-base font-black text-white">{brandInitial}</span>
          </div>

          {/* Hub Menu - All Options */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="fixed z-[200] w-64 rounded-2xl border border-border bg-card shadow-xl overflow-hidden"
                style={mobileMenuPos ? { top: mobileMenuPos.top, left: mobileMenuPos.left } : {}}
              >
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

                  {/* Screensaver toggle */}
                  <button
                    onClick={onToggleScreensaver}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted transition-colors text-left"
                  >
                    <div className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      screensaverEnabled ? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400" : "bg-muted text-muted-foreground"
                    )}>
                      {screensaverEnabled ? <Monitor className="h-4 w-4" /> : <MonitorOff className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Screensaver</p>
                      <p className="text-[11px] text-muted-foreground">{screensaverEnabled ? "Auto after 2 min" : "Disabled"}</p>
                    </div>
                    <div className={cn(
                      "h-5 w-9 rounded-full transition-colors relative",
                      screensaverEnabled ? "bg-blue-500" : "bg-slate-200 dark:bg-slate-700"
                    )}>
                      <div className={cn(
                        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                        screensaverEnabled ? "translate-x-4" : "translate-x-0.5"
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

                  <div className="border-t border-border mx-2 my-1" />

                  {/* Forms */}
                  <button
                    onClick={() => { onOpenForms(); setMobileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted transition-colors text-left"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Forms</p>
                      <p className="text-[11px] text-muted-foreground">View all forms</p>
                    </div>
                  </button>

                  {/* Calendar */}
                  <button
                    onClick={() => { onOpenCalendar(); setMobileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted transition-colors text-left"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Calendar</p>
                      <p className="text-[11px] text-muted-foreground">View calendar</p>
                    </div>
                  </button>

                  <div className="border-t border-border mx-2 my-1" />

                  {/* Logout */}
                  <button
                    onClick={() => { onLogout(); setMobileMenuOpen(false); }}
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="hidden md:block">
          <h1 className="text-base font-bold text-foreground">{brandTitle}</h1>
          <p className="text-[11px] text-muted-foreground">
            {user?.name} &middot; Store #{user?.storeNumber}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3 ml-auto shrink-0">
        <GamificationHub locationId={user?.id} />

        <div className="hidden sm:block">
          <ConnectionStatus />
        </div>

        <div className="hidden md:block mx-1 text-right">
          <p className="text-2xl font-black tabular-nums tracking-tight text-foreground">
            {displayTime}
          </p>
          <p className="text-[11px] font-medium text-muted-foreground">
            {format(new Date(), "EEE, MMM d yyyy")}
          </p>
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

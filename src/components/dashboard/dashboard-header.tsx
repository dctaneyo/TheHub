"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import {
  LogOut,
  MessageCircle,
  CalendarDays,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectionStatus } from "@/components/connection-status";
import { GamificationHub } from "@/components/dashboard/gamification-hub";
import { NotificationBell } from "@/components/notification-bell";
import { DashboardSettings } from "@/components/dashboard/dashboard-settings";
import { type TaskItem } from "@/components/dashboard/timeline";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
            <span className="text-base font-black text-white">H</span>
          </button>
          <div className="hidden md:flex h-9 w-9 items-center justify-center rounded-full bg-[var(--hub-red)] shadow-sm">
            <span className="text-base font-black text-white">H</span>
          </div>

          {/* Mobile Navigation Menu */}
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
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Quick Menu</p>
                </div>

                <div className="p-2 space-y-1">
                  <button
                    onClick={() => { onOpenForms(); setMobileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Forms</p>
                      <p className="text-xs text-muted-foreground">View documents</p>
                    </div>
                  </button>

                  <button
                    onClick={() => { onOpenCalendar(); setMobileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Calendar</p>
                      <p className="text-xs text-muted-foreground">View schedule</p>
                    </div>
                  </button>

                  <div className="px-3 py-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Connection</p>
                    <ConnectionStatus />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="hidden md:block">
          <h1 className="text-base font-bold text-foreground">The Hub</h1>
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
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  );
}

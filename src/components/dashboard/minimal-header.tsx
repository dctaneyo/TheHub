"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { SoundscapeIntensitySelector } from "@/components/dashboard/soundscape-intensity-selector";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/lib/socket-context";
import { useReducedMotion, ANIMATION, getTransition, getSpringTransition } from "@/lib/animation-constants";

// ── Food safety color cycle (same as idle-screensaver) ──
const COLOR_SEQUENCE = [
  { name: "Red",    bg: "#ef4444" },
  { name: "Orange", bg: "#f97316" },
  { name: "Yellow", bg: "#eab308" },
  { name: "Green",  bg: "#22c55e" },
  { name: "Blue",   bg: "#3b82f6" },
  { name: "Purple", bg: "#a855f7" },
  { name: "Brown",  bg: "#92400e" },
  { name: "Grey",   bg: "#9ca3af" },
  { name: "White",  bg: "#f8fafc" },
];

const ANCHOR_MINUTES = 10 * 60; // 10:00 AM

function getCurrentFoodSafetyColor(now: Date) {
  const mins = now.getHours() * 60 + now.getMinutes();
  const delta = ((mins - ANCHOR_MINUTES) % (9 * 30) + 9 * 30) % (9 * 30);
  const slotIndex = Math.floor(delta / 30);
  return COLOR_SEQUENCE[slotIndex];
}

// ── Hub Menu grouped sections (exported for testing) ──
export const HUB_MENU_SECTIONS = [
  {
    label: "Display",
    items: ["theme-toggle", "layout-selector", "screensaver-toggle"],
  },
  {
    label: "Shift",
    items: ["sound-toggle", "soundscape-intensity", "hand-off-shift"],
  },
  {
    label: "Account",
    items: ["connection-status", "logout"],
  },
] as const;

interface MinimalHeaderProps {
  user: { id?: string; name?: string; storeNumber?: string; userType?: string } | null;
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
  onHandOffShift?: () => void;
  effectiveLocationId?: string;
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
  onShowScreensaver: _onShowScreensaver,
  chatOpen: _chatOpen,
  onToggleChat,
  chatUnread,
  onOpenForms,
  onOpenCalendar,
  onLogout,
  onHandOffShift,
  effectiveLocationId,
}: MinimalHeaderProps) {
  const [layoutDropdownOpen, setLayoutDropdownOpen] = useState(false);
  const { layout, setLayout } = useLayout();
  const panelSyncRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  // Food safety indicator color
  const [foodSafetyColor, setFoodSafetyColor] = useState(() => getCurrentFoodSafetyColor(new Date()));

  useEffect(() => {
    const interval = setInterval(() => {
      setFoodSafetyColor(getCurrentFoodSafetyColor(new Date()));
    }, 30_000); // update every 30s
    return () => clearInterval(interval);
  }, []);

  // Sync H dropdown open/close FROM target (mirror side)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.hubMenuOpen !== undefined) {
        panelSyncRef.current = true;
        setLayoutDropdownOpen(detail.hubMenuOpen);
        requestAnimationFrame(() => { panelSyncRef.current = false; });
      }
    };
    window.addEventListener("mirror:panel-sync", handler);
    return () => window.removeEventListener("mirror:panel-sync", handler);
  }, []);

  // Broadcast H dropdown open/close changes
  useEffect(() => {
    if (panelSyncRef.current) return;
    window.dispatchEvent(new CustomEvent("mirror:panel-change", { detail: { hubMenuOpen: layoutDropdownOpen } }));
  }, [layoutDropdownOpen]);

  const storeName = user?.name || "Hub";
  const storeNumber = user?.storeNumber || "0000";

  return (
    <>
    <header className="sticky top-0 flex h-14 shrink-0 items-center bg-white/5 backdrop-blur-xl border-b border-white/10 px-4 z-[100]">
      {/* Left: Logo + Store */}
      <div className="flex items-center gap-2 shrink-0 relative">
        <button
          onClick={() => setLayoutDropdownOpen(!layoutDropdownOpen)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--hub-red)] to-red-700 shadow-sm hover:brightness-110 transition-colors"
          title="Hub Menu"
        >
          <span className="text-sm font-black text-white">H</span>
        </button>

        {/* Click outside to close */}
        {layoutDropdownOpen && (
          <div
            className="fixed inset-0 z-[199]"
            onClick={() => setLayoutDropdownOpen(false)}
          />
        )}

        {/* Hub Menu — slide-down with grouped sections */}
        <AnimatePresence>
          {layoutDropdownOpen && (
            <HubMenu
              soundEnabled={soundEnabled}
              onToggleSound={onToggleSound}
              screensaverEnabled={screensaverEnabled}
              onToggleScreensaver={onToggleScreensaver}
              layout={layout}
              setLayout={setLayout}
              onOpenForms={() => { onOpenForms(); setLayoutDropdownOpen(false); }}
              onOpenCalendar={() => { onOpenCalendar(); setLayoutDropdownOpen(false); }}
              onHandOffShift={onHandOffShift ? () => { onHandOffShift(); setLayoutDropdownOpen(false); } : undefined}
              onLogout={() => { onLogout(); setLayoutDropdownOpen(false); }}
              userType={user?.userType}
              prefersReducedMotion={prefersReducedMotion}
            />
          )}
        </AnimatePresence>

        <div>
          <p className="text-xs font-black text-foreground leading-none">
            {storeName}
          </p>
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
            #{storeNumber}
          </p>
        </div>
      </div>

      {/* Center: Live Clock + Food Safety Dot */}
      <div className="flex-1 flex justify-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black tabular-nums">{displayTime}</span>
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: foodSafetyColor.bg }}
            title={`Food safety: ${foodSafetyColor.name}`}
          />
        </div>
      </div>

      {/* Right: Action Icons — 40px touch targets with circular hover */}
      <div className="flex items-center gap-1 shrink-0">
        <GamificationHub locationId={effectiveLocationId || user?.id} />

        <div className="hidden sm:block">
          <ConnectionStatus />
        </div>

        <button
          onClick={onOpenForms}
          className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
          title="Forms"
        >
          <FileText className="h-[18px] w-[18px]" />
        </button>

        <button
          onClick={onOpenCalendar}
          className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
          title="Calendar"
        >
          <CalendarDays className="h-[18px] w-[18px]" />
        </button>

        <button
          onClick={onToggleChat}
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
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
          locationId={effectiveLocationId || user?.id}
        />
      </div>
    </header>
    <XpBar locationId={effectiveLocationId || user?.id} />
    </>
  );
}

// ── Persistent XP Bar — renders under header ──
function XpBar({ locationId }: { locationId?: string }) {
  const [progress, setProgress] = useState(0);
  const { socket } = useSocket();
  const prefersReducedMotion = useReducedMotion();

  const fetchXp = useCallback(async () => {
    try {
      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const locParam = locationId ? `&locationId=${locationId}` : "";
      const res = await fetch(`/api/gamification?localDate=${localDate}${locParam}`);
      if (!res.ok) return;
      const data = await res.json();
      setProgress(data.level?.progress ?? 0);
    } catch {
      // Requirement 11.6: render at 0% on failure, no error shown
    }
  }, [locationId]);

  useEffect(() => {
    fetchXp();
  }, [fetchXp]);

  // Requirement 11.7: retry on socket events or 30s interval
  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchXp();
    socket.on("task:completed", handler);
    socket.on("task:updated", handler);
    socket.on("leaderboard:updated", handler);
    return () => {
      socket.off("task:completed", handler);
      socket.off("task:updated", handler);
      socket.off("leaderboard:updated", handler);
    };
  }, [socket, fetchXp]);

  useEffect(() => {
    const interval = setInterval(fetchXp, 30_000);
    return () => clearInterval(interval);
  }, [fetchXp]);

  const handleClick = () => {
    window.dispatchEvent(
      new CustomEvent("mirror:panel-change", { detail: { gamificationOpen: true } })
    );
  };

  return (
    <div
      className="sticky top-14 z-[99] w-full h-[3px] bg-white/5 cursor-pointer"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClick(); }}
      aria-label="XP progress bar — tap to open profile"
    >
      <motion.div
        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-r-full"
        initial={{ width: "0%" }}
        animate={{ width: `${progress}%` }}
        transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 100, damping: 20 }}
      />
    </div>
  );
}

// ── Hub Menu Component — grouped sections with dividers ──
interface HubMenuProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
  screensaverEnabled: boolean;
  onToggleScreensaver: () => void;
  layout: string;
  setLayout: (layout: "classic" | "focus" | "pulse") => void;
  onOpenForms: () => void;
  onOpenCalendar: () => void;
  onHandOffShift?: () => void;
  onLogout: () => void;
  userType?: string;
  prefersReducedMotion: boolean;
}

function HubMenu({
  soundEnabled,
  onToggleSound,
  screensaverEnabled,
  onToggleScreensaver,
  layout,
  setLayout,
  onOpenForms,
  onOpenCalendar,
  onHandOffShift,
  onLogout,
  userType,
  prefersReducedMotion,
}: HubMenuProps) {
  const menuTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: ANIMATION.hubMenuSlide.duration, ease: ANIMATION.hubMenuSlide.ease };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={menuTransition}
      className="absolute top-full left-0 mt-1 w-72 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl overflow-hidden z-[200]"
    >
      <div className="px-4 py-3 border-b border-white/10">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Hub Menu</p>
      </div>

      {/* ── Display Section ── */}
      <div className="p-2 space-y-1">
        <p className="px-3 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Display</p>

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

        {/* Layout selector */}
        <div className="px-3 pt-1.5 pb-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Layout</p>
          <div className="flex gap-1.5">
            {LAYOUT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => { setLayout(opt.id); window.dispatchEvent(new CustomEvent("mirror:panel-change", { detail: { layout: opt.id } })); }}
                className={cn(
                  "flex-1 rounded-lg px-2.5 py-2 text-center transition-colors border",
                  layout === opt.id
                    ? "border-[var(--hub-red)]/30 bg-[var(--hub-red)]/10 text-[var(--hub-red)]"
                    : "border-white/10 hover:bg-white/10 text-foreground"
                )}
              >
                <LayoutGrid className={cn("h-3.5 w-3.5 mx-auto mb-0.5", layout === opt.id && "text-[var(--hub-red)]")} />
                <p className="text-[10px] font-bold">{opt.name}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Screensaver toggle */}
        <button
          onClick={onToggleScreensaver}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/10 transition-colors text-left"
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
      </div>

      {/* Divider */}
      <div className="border-t border-white/10 mx-2" />

      {/* ── Shift Section ── */}
      <div className="p-2 space-y-1">
        <p className="px-3 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Shift</p>

        {/* Sound toggle */}
        <button
          onClick={onToggleSound}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/10 transition-colors text-left"
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

        {/* Soundscape intensity */}
        <SoundscapeIntensitySelector />

        {/* Forms - visible on mobile only */}
        <button
          onClick={onOpenForms}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/10 transition-colors text-left sm:hidden"
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
          onClick={onOpenCalendar}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/10 transition-colors text-left sm:hidden"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Calendar</p>
            <p className="text-[11px] text-muted-foreground">View calendar</p>
          </div>
        </button>

        {/* Hand Off Shift - location users only */}
        {onHandOffShift && userType === "location" && (
          <button
            onClick={onHandOffShift}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors text-left"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <Play className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Hand Off Shift</p>
              <p className="text-[11px] text-muted-foreground">End shift &amp; brief next crew</p>
            </div>
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-white/10 mx-2" />

      {/* ── Account Section ── */}
      <div className="p-2 space-y-1">
        <p className="px-3 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Account</p>

        {/* Connection Status */}
        <div className="px-3 py-2">
          <ConnectionStatus />
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
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
  );
}

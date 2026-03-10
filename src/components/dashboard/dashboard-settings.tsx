"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Settings, Volume2, VolumeX, Monitor, MonitorOff, Play, Sun, Moon, LayoutGrid } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLayout, LAYOUT_OPTIONS } from "@/lib/layout-context";
import { useMirror } from "@/lib/mirror-context";

interface DashboardSettingsProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
  screensaverEnabled: boolean;
  onToggleScreensaver: () => void;
  onShowScreensaver: () => void;
}

export function DashboardSettings({
  soundEnabled,
  onToggleSound,
  screensaverEnabled,
  onToggleScreensaver,
  onShowScreensaver,
}: DashboardSettingsProps) {
  const { layout, setLayout } = useLayout();
  const { isMirroring, viewState: mirrorViewState, sendViewChange } = useMirror();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panelSyncRef = useRef(false);

  // Sync settings panel open/close FROM mirror context (mirror side: target → mirror)
  useEffect(() => {
    if (!isMirroring || mirrorViewState?.settingsOpen === undefined) return;
    panelSyncRef.current = true;
    setOpen(mirrorViewState.settingsOpen);
    requestAnimationFrame(() => { panelSyncRef.current = false; });
  }, [isMirroring, mirrorViewState?.settingsOpen]);

  // Sync settings panel open/close FROM ARL (target side: mirror → target via DOM event)
  useEffect(() => {
    if (isMirroring) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.settingsOpen !== undefined) {
        panelSyncRef.current = true;
        setOpen(detail.settingsOpen);
        requestAnimationFrame(() => { panelSyncRef.current = false; });
      }
    };
    window.addEventListener("mirror:panel-sync", handler);
    return () => window.removeEventListener("mirror:panel-sync", handler);
  }, [isMirroring]);

  // Broadcast settings panel open/close changes
  useEffect(() => {
    if (panelSyncRef.current) return;
    if (isMirroring) {
      sendViewChange({ settingsOpen: open });
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mirror:panel-change", { detail: { settingsOpen: open } }));
    }
  }, [open, isMirroring, sendViewChange]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Compute fixed position when dropdown opens
  useEffect(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
          open ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
        title="Settings"
      >
        <Settings className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="fixed z-[200] w-64 rounded-2xl border border-border bg-card shadow-xl overflow-hidden"
            style={pos ? { top: pos.top, right: pos.right } : {}}
          >
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Dashboard Settings</p>
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
                  soundEnabled ? "bg-emerald-500" : "bg-slate-200"
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
                  screensaverEnabled ? "bg-blue-500" : "bg-slate-200"
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
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Theme</p>
                  <p className="text-[11px] text-slate-400">Light / Dark / System</p>
                </div>
                <ThemeToggle />
              </div>

              {/* Layout selector */}
              <div className="border-t border-border mx-2 my-1" />
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

              {/* Manual invoke */}
              <button
                onClick={() => { onShowScreensaver(); setOpen(false); }}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                  <Play className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Show Screensaver</p>
                  <p className="text-[11px] text-slate-400">Preview now</p>
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";
import { Trophy, ChevronDown, Flame, Star, Medal, Zap, Snowflake, X } from "@/lib/icons";
import { useReducedMotion, ANIMATION } from "@/lib/animation-constants";

interface StreakData {
  current: number;
  currentMilestone: { days: number; name: string; icon: string } | null;
  nextMilestone: { days: number; name: string; icon: string } | null;
  daysToNext: number;
}

interface LevelData {
  level: number;
  title: string;
  xpRequired: number;
  totalXP: number;
  xpToNext: number;
  progress: number;
  nextLevel: { level: number; title: string; xpRequired: number } | null;
}

interface BadgeData {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedDate?: string;
  tier?: string;
  rarity?: string;
  points?: number;
  category?: string;
}

interface GamificationData {
  streak: StreakData;
  level: LevelData;
  badges: BadgeData[];
  stats: { totalTasksCompleted: number; totalXP: number; totalBonusPoints: number };
}

interface LeaderboardEntry {
  locationId: string;
  name: string;
  storeNumber: string;
  rank: number;
  completionPct: number;
  totalPoints: number;
}

interface FreezeInfo {
  available: number;
  usedThisMonth: number;
  maxPerMonth: number;
  frozenDates: string[];
}

interface BadgeToast {
  id: string;
  badge: BadgeData;
}

// ── Avatar color palette for leaderboard entries ──
const AVATAR_COLORS = [
  "bg-rose-500", "bg-amber-500", "bg-emerald-500", "bg-cyan-500",
  "bg-violet-500", "bg-pink-500", "bg-blue-500", "bg-teal-500",
  "bg-orange-500", "bg-indigo-500",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── GitHub-style streak calendar (contribution grid) ──
function StreakCalendar({ streakCurrent }: { streakCurrent: number }) {
  const grid = useMemo(() => {
    const today = new Date();
    const days: { date: string; active: boolean; level: number }[] = [];
    // Show last 12 weeks (84 days)
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      // Mark days within the current streak as active
      const active = i < streakCurrent;
      // Intensity level: 0 = none, 1-3 = activity levels
      const level = active ? Math.min(3, 1 + Math.floor(Math.random() * 3)) : 0;
      days.push({ date: dateStr, active, level });
    }
    return days;
  }, [streakCurrent]);

  const levelColors = [
    "bg-white/5",           // level 0 — no activity
    "bg-emerald-500/30",    // level 1
    "bg-emerald-500/60",    // level 2
    "bg-emerald-500",       // level 3
  ];

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
        Activity — Last 12 Weeks
      </p>
      <div className="grid grid-rows-7 grid-flow-col gap-[2px]">
        {grid.map((day) => (
          <div
            key={day.date}
            className={cn(
              "h-[10px] w-[10px] rounded-[2px] transition-colors",
              levelColors[day.level]
            )}
            title={`${day.date}${day.active ? " — active" : ""}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
        <span>Less</span>
        {levelColors.map((c, i) => (
          <div key={i} className={cn("h-[8px] w-[8px] rounded-[2px]", c)} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

// ── Fullscreen radial burst animation for badge unlock ──
function BadgeBurstOverlay({ badge, onDone }: { badge: BadgeData; onDone: () => void }) {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(onDone, prefersReducedMotion ? 500 : 3000);
    return () => clearTimeout(timer);
  }, [onDone, prefersReducedMotion]);

  return (
    <motion.div
      className="fixed inset-0 z-[400] flex items-center justify-center pointer-events-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
      onClick={onDone}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Radial burst rings — skip transforms when reduced motion */}
      {!prefersReducedMotion && [0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border-2 border-amber-400/40"
          initial={{ width: 0, height: 0, opacity: 0.8 }}
          animate={{ width: 600, height: 600, opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 60,
            damping: 12,
            duration: 2,
            delay: i * 0.2,
          }}
        />
      ))}

      {/* Central badge */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-4"
        initial={prefersReducedMotion ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 15, duration: 2 }}
      >
        <motion.span
          className="text-7xl"
          animate={prefersReducedMotion ? {} : { rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.2, 1.1, 1.15, 1] }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 1, delay: 0.3 }}
        >
          {badge.icon}
        </motion.span>
        <div className="text-center">
          <motion.p
            className="text-[11px] font-bold uppercase tracking-widest text-amber-400"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.5 }}
          >
            Achievement Unlocked!
          </motion.p>
          <motion.p
            className="text-xl font-black text-white mt-1"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.7 }}
          >
            {badge.name}
          </motion.p>
          <motion.p
            className="text-sm text-white/60 mt-0.5"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.9 }}
          >
            {badge.description}
          </motion.p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function GamificationHub({ locationId }: { locationId?: string }) {
  const [data, setData] = useState<GamificationData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardRank, setLeaderboardRank] = useState<LeaderboardEntry | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "badges" | "leaderboard">("overview");
  const [badgeToasts, setBadgeToasts] = useState<BadgeToast[]>([]);
  const [burstBadge, setBurstBadge] = useState<BadgeData | null>(null);
  const [freezeInfo, setFreezeInfo] = useState<FreezeInfo | null>(null);
  const [freezing, setFreezing] = useState(false);
  const [freezeSuccess, setFreezeSuccess] = useState(false);
  const [apiFailed, setApiFailed] = useState(false);
  const knownEarnedIdsRef = useRef<Set<string> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocket();
  const prefersReducedMotion = useReducedMotion();

  const fetchData = useCallback(async () => {
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    try {
      const locParam = locationId ? `&locationId=${locationId}` : "";
      const [gamRes, achRes, freezeRes, lbRes] = await Promise.all([
        fetch(`/api/gamification?localDate=${localDate}${locParam}`),
        fetch(`/api/achievements?_=1${locParam}`),
        fetch(`/api/gamification/streak-freeze?_=1${locParam}`),
        fetch(`/api/leaderboard?localDate=${localDate}`),
      ]);

      if (!gamRes.ok || !achRes.ok) {
        setApiFailed(true);
        return;
      }
      setApiFailed(false);
      const [gamData, achData] = await Promise.all([gamRes.json(), achRes.json()]);
      if (freezeRes.ok) setFreezeInfo(await freezeRes.json());

      // Full leaderboard + our position
      if (lbRes.ok) {
        const lbData = await lbRes.json();
        const entries = lbData.leaderboard as LeaderboardEntry[];
        setLeaderboard(entries);
        const myEntry = entries.find((e) => e.locationId === locationId);
        if (myEntry) setLeaderboardRank(myEntry);
      }

      // Detect newly earned badges → trigger burst animation
      const newlyEarned: BadgeData[] = [];
      if (knownEarnedIdsRef.current !== null) {
        for (const badge of achData.badges as BadgeData[]) {
          if (badge.earned && !knownEarnedIdsRef.current.has(badge.id)) {
            newlyEarned.push(badge);
          }
        }
      }
      knownEarnedIdsRef.current = new Set(
        (achData.badges as BadgeData[]).filter((b) => b.earned).map((b) => b.id)
      );

      // Show fullscreen burst for first new badge, toast for rest
      for (let i = 0; i < newlyEarned.length; i++) {
        const badge = newlyEarned[i];
        if (i === 0) {
          setBurstBadge(badge);
        }
        const toastId = `${badge.id}-${Date.now()}`;
        setBadgeToasts((prev) => [...prev, { id: toastId, badge }]);
        setTimeout(() => setBadgeToasts((prev) => prev.filter((t) => t.id !== toastId)), 5000);
      }

      setData({
        streak: gamData.streak,
        level: gamData.level,
        badges: achData.badges,
        stats: gamData.stats,
      });
    } catch {
      setApiFailed(true);
    }
  }, [locationId]);

  const applyStreakFreeze = useCallback(async () => {
    setFreezing(true);
    try {
      const res = await fetch("/api/gamification/streak-freeze", { method: "POST" });
      if (res.ok) {
        setFreezeSuccess(true);
        setTimeout(() => setFreezeSuccess(false), 3000);
        fetchData();
      }
    } catch {}
    setFreezing(false);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Requirement 11.7: retry on socket events
  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchData();
    socket.on("task:completed", handler);
    socket.on("task:updated", handler);
    socket.on("leaderboard:updated", handler);
    return () => {
      socket.off("task:completed", handler);
      socket.off("task:updated", handler);
      socket.off("leaderboard:updated", handler);
    };
  }, [socket, fetchData]);

  // Requirement 11.7: retry on 30s interval when API has failed
  useEffect(() => {
    if (!apiFailed) return;
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [apiFailed, fetchData]);

  // ── Mirror sync: broadcast gamification popdown open/close ──
  const panelSyncRef = useRef(false);
  useEffect(() => {
    if (panelSyncRef.current) return;
    window.dispatchEvent(new CustomEvent("mirror:panel-change", { detail: { gamificationOpen: isOpen } }));
  }, [isOpen]);

  // ── Mirror sync: receive gamification popdown state from other side ──
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.gamificationOpen !== undefined) {
        panelSyncRef.current = true;
        setIsOpen(detail.gamificationOpen);
        requestAnimationFrame(() => { panelSyncRef.current = false; });
      }
    };
    window.addEventListener("mirror:panel-sync", handler);
    return () => window.removeEventListener("mirror:panel-sync", handler);
  }, []);

  // Close panel on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  if (!data) return null;

  const { streak, level, badges, stats } = data;
  const earnedBadges = badges.filter((b) => b.earned);
  const unearnedBadges = badges.filter((b) => !b.earned);

  // Determine streak color
  const streakColor =
    streak.current >= 30
      ? "text-red-500"
      : streak.current >= 7
        ? "text-orange-500"
        : streak.current >= 3
          ? "text-orange-400"
          : "text-slate-400";

  // Level ring progress (for the circular indicator)
  const circumference = 2 * Math.PI * 16;
  const strokeDashoffset = circumference - (level.progress / 100) * circumference;

  return (
    <>
      {/* Fullscreen radial burst for badge unlock — Requirement 11.4 */}
      <AnimatePresence>
        {burstBadge && (
          <BadgeBurstOverlay
            badge={burstBadge}
            onDone={() => setBurstBadge(null)}
          />
        )}
      </AnimatePresence>

      {/* Badge unlock toasts (secondary, after burst) */}
      <AnimatePresence>
        {badgeToasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 60, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 25 }}
            className="fixed bottom-24 left-1/2 z-[300] -translate-x-1/2 pointer-events-none"
          >
            <div className="flex items-center gap-3 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 px-5 py-3.5 shadow-2xl">
              <motion.span
                className="text-3xl"
                animate={prefersReducedMotion ? {} : { rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.3, 1.1, 1.2, 1] }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.7, ease: "easeOut" }}
              >
                {toast.badge.icon}
              </motion.span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Achievement Unlocked!
                </p>
                <p className="text-sm font-black text-foreground">{toast.badge.name}</p>
                <p className="text-[11px] text-muted-foreground">{toast.badge.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Unified compact trigger */}
      <div className="relative" ref={triggerRef}>
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          whileHover={prefersReducedMotion ? undefined : { scale: 1.03 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-all",
            isOpen
              ? "bg-white/10 border border-white/20"
              : "bg-white/5 border border-white/10 hover:bg-white/10"
          )}
        >
          {/* Level ring */}
          <div className="relative h-6 w-6 shrink-0">
            <svg className="h-6 w-6 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/10" />
              <circle cx="18" cy="18" r="16" fill="none" stroke="url(#levelGradient)" strokeWidth="3" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000" />
              <defs>
                <linearGradient id="levelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[9px] font-black text-purple-400">
                {level.level}
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              <Flame className={cn("h-3 w-3", streakColor)} />
              <span className={cn("text-xs font-bold tabular-nums", streakColor)}>
                {streak.current}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <Zap className="h-3 w-3 text-amber-500" />
              <span className="text-xs font-bold tabular-nums text-amber-400">
                {stats.totalXP >= 1000
                  ? `${(stats.totalXP / 1000).toFixed(1)}k`
                  : stats.totalXP}
              </span>
            </div>
            {leaderboardRank && (
              <div className="flex items-center gap-0.5">
                <Trophy className="h-3 w-3 text-emerald-500" />
                <span className="text-xs font-bold tabular-nums text-emerald-400">
                  #{leaderboardRank.rank}
                </span>
              </div>
            )}
          </div>

          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </motion.button>

        {/* Expanded panel — full-screen mobile, wider panel desktop (Req 11.2) */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 30 }}
              ref={panelRef}
              className={cn(
                "fixed z-[200] rounded-2xl overflow-hidden flex flex-col",
                // Frosted_Glass treatment
                "bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/30",
                // Mobile: full-screen (Req 11.2)
                "inset-2 sm:inset-auto",
                // Desktop: wider panel positioned from top-right
                "sm:top-16 sm:right-4 sm:w-[440px] sm:max-h-[calc(100vh-80px)]"
              )}
            >
              {/* Header gradient */}
              <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-4">
                <div className="relative z-10 flex items-center gap-3">
                  {/* Large level ring */}
                  <div className="relative h-14 w-14 shrink-0">
                    <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                      <circle
                        cx="28" cy="28" r="24" fill="none" stroke="white" strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 24}
                        strokeDashoffset={2 * Math.PI * 24 - (level.progress / 100) * 2 * Math.PI * 24}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-black text-white leading-none">{level.level}</span>
                      <span className="text-[8px] font-bold text-white/70 uppercase">LVL</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-black text-sm">{level.title}</p>
                    <p className="text-white/70 text-xs">
                      {level.totalXP} / {level.nextLevel ? level.nextLevel.xpRequired : level.totalXP} XP
                    </p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/20 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-white"
                        initial={{ width: 0 }}
                        animate={{ width: `${level.progress}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {/* Decorative circles */}
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/5" />
                <div className="absolute -right-2 -bottom-8 h-20 w-20 rounded-full bg-white/5" />
              </div>

              {/* Quick stats row — Frosted_Glass cells */}
              <div className="grid grid-cols-4 gap-px bg-white/5">
                <div className="bg-white/5 backdrop-blur-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Flame className={cn("h-4 w-4", streakColor)} />
                    <span className={cn("text-lg font-black tabular-nums", streakColor)}>
                      {streak.current}
                    </span>
                  </div>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase mt-0.5">Streak</p>
                </div>
                <div className="bg-white/5 backdrop-blur-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span className="text-lg font-black tabular-nums text-amber-400">
                      {stats.totalXP}
                    </span>
                  </div>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase mt-0.5">XP</p>
                </div>
                <div className="bg-white/5 backdrop-blur-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Medal className="h-4 w-4 text-amber-500" />
                    <span className="text-lg font-black tabular-nums text-amber-400">
                      {earnedBadges.length}
                    </span>
                  </div>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase mt-0.5">Badges</p>
                </div>
                <div className="bg-white/5 backdrop-blur-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Trophy className="h-4 w-4 text-emerald-500" />
                    <span className="text-lg font-black tabular-nums text-emerald-400">
                      {leaderboardRank ? `#${leaderboardRank.rank}` : "--"}
                    </span>
                  </div>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase mt-0.5">Rank</p>
                </div>
              </div>

              {/* Tab navigation */}
              <div className="flex border-b border-white/10">
                {(["overview", "badges", "leaderboard"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex-1 py-2.5 text-xs font-bold capitalize transition-colors",
                      activeTab === tab
                        ? "border-b-2 border-purple-500 text-purple-400"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    {/* Streak details — Frosted_Glass card */}
                    <div className="rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Flame className="h-5 w-5 text-orange-500" />
                          <div>
                            <p className="text-sm font-black text-foreground">
                              {streak.current}-Day Streak
                            </p>
                            {streak.currentMilestone && (
                              <p className="text-[10px] text-muted-foreground">
                                {streak.currentMilestone.icon} {streak.currentMilestone.name}
                              </p>
                            )}
                          </div>
                        </div>
                        {/* Streak freeze */}
                        {freezeInfo && freezeInfo.available > 0 && (
                          <motion.button
                            whileHover={prefersReducedMotion ? undefined : { scale: 1.1 }}
                            whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                            onClick={applyStreakFreeze}
                            disabled={freezing}
                            className={cn(
                              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors",
                              freezeSuccess
                                ? "bg-cyan-500/20 text-cyan-300"
                                : "bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
                            )}
                          >
                            <Snowflake className="h-3.5 w-3.5" />
                            {freezeSuccess ? "Applied!" : freezing ? "..." : `Freeze (${freezeInfo.available})`}
                          </motion.button>
                        )}
                      </div>
                      {streak.nextMilestone && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                            <span>Next: {streak.nextMilestone.icon} {streak.nextMilestone.name}</span>
                            <span>{streak.daysToNext} days to go</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500"
                              initial={{ width: 0 }}
                              animate={{
                                width: `${streak.nextMilestone ? ((streak.current / (streak.current + streak.daysToNext)) * 100) : 100}%`,
                              }}
                              transition={{ duration: 1, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* GitHub-style streak calendar — Requirement 11.3 */}
                    <div className="rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 p-3">
                      <StreakCalendar streakCurrent={streak.current} />
                    </div>

                    {/* Recent badges */}
                    {earnedBadges.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                          Recent Badges
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {earnedBadges.slice(0, 6).map((badge) => (
                            <motion.div
                              key={badge.id}
                              whileHover={prefersReducedMotion ? undefined : { scale: 1.15 }}
                              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-xl cursor-default"
                              title={`${badge.name}: ${badge.description}`}
                            >
                              {badge.icon}
                            </motion.div>
                          ))}
                          {earnedBadges.length > 6 && (
                            <button
                              onClick={() => setActiveTab("badges")}
                              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-muted-foreground hover:text-foreground"
                            >
                              +{earnedBadges.length - 6}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tasks completed */}
                    <div className="rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-foreground">Total Tasks Completed</p>
                        <p className="text-lg font-black text-purple-400 tabular-nums">
                          {stats.totalTasksCompleted}
                        </p>
                      </div>
                      {stats.totalBonusPoints > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          +{stats.totalBonusPoints} bonus points earned
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "badges" && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      {earnedBadges.length} of {badges.length} earned
                    </p>

                    {earnedBadges.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                          Earned
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                          {earnedBadges.map((badge) => {
                            const tier = badge.tier || "bronze";
                            const tierColors: Record<string, string> = {
                              bronze: "border-orange-500/20 bg-orange-500/5",
                              silver: "border-slate-400/20 bg-slate-500/5",
                              gold: "border-yellow-500/20 bg-yellow-500/5",
                              platinum: "border-purple-500/20 bg-purple-500/5",
                            };
                            return (
                              <motion.div
                                key={badge.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                  "flex items-center gap-2 rounded-xl border p-2.5 backdrop-blur-xl",
                                  tierColors[tier] || tierColors.bronze
                                )}
                              >
                                <span className="text-xl shrink-0">{badge.icon}</span>
                                <div className="min-w-0">
                                  <p className="text-[11px] font-bold text-foreground truncate">
                                    {badge.name}
                                  </p>
                                  <p className="text-[9px] text-muted-foreground truncate">
                                    {badge.description}
                                  </p>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {unearnedBadges.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          Locked ({unearnedBadges.length})
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                          {unearnedBadges.map((badge) => (
                            <div
                              key={badge.id}
                              className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 opacity-50"
                            >
                              <span className="text-xl grayscale shrink-0">{badge.icon}</span>
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold text-muted-foreground truncate">
                                  {badge.name}
                                </p>
                                <p className="text-[9px] text-muted-foreground truncate">
                                  {badge.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "leaderboard" && (
                  <div className="space-y-2">
                    {/* Own rank highlight */}
                    {leaderboardRank && (
                      <div className="flex items-center gap-3 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 p-3 mb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                          <Trophy className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-foreground">
                            Rank #{leaderboardRank.rank}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {leaderboardRank.completionPct}% complete · {leaderboardRank.totalPoints} pts
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Full leaderboard with colored circle avatars — Requirement 11.5 */}
                    {leaderboard.length > 0 ? (
                      <div className="space-y-1.5">
                        {leaderboard.map((entry, idx) => {
                          const isMe = entry.locationId === locationId;
                          return (
                            <motion.div
                              key={entry.locationId}
                              layout
                              initial={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 25, delay: idx * 0.03 }}
                              className={cn(
                                "flex items-center gap-3 rounded-xl p-2.5 transition-colors",
                                isMe
                                  ? "bg-purple-500/10 border border-purple-500/20"
                                  : "bg-white/[0.02] hover:bg-white/5"
                              )}
                            >
                              {/* Rank number */}
                              <span className={cn(
                                "w-6 text-center text-xs font-black tabular-nums",
                                entry.rank === 1 ? "text-amber-400" :
                                entry.rank === 2 ? "text-slate-300" :
                                entry.rank === 3 ? "text-orange-400" :
                                "text-muted-foreground"
                              )}>
                                {entry.rank}
                              </span>

                              {/* Colored circle avatar */}
                              <div className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-[10px] font-black",
                                getAvatarColor(entry.name)
                              )}>
                                {getInitials(entry.name)}
                              </div>

                              {/* Name + store */}
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "text-xs font-bold truncate",
                                  isMe ? "text-purple-300" : "text-foreground"
                                )}>
                                  {entry.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  #{entry.storeNumber}
                                </p>
                              </div>

                              {/* Score */}
                              <div className="text-right shrink-0">
                                <p className="text-xs font-black tabular-nums text-foreground">
                                  {entry.completionPct}%
                                </p>
                                <p className="text-[9px] text-muted-foreground tabular-nums">
                                  {entry.totalPoints} pts
                                </p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Complete tasks this week to appear on the leaderboard
                      </p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

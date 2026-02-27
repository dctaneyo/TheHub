"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";
import { Trophy, ChevronDown, Flame, Star, Medal, Zap, Snowflake, X } from "lucide-react";

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

export function GamificationHub({ locationId }: { locationId?: string }) {
  const [data, setData] = useState<GamificationData | null>(null);
  const [leaderboardRank, setLeaderboardRank] = useState<LeaderboardEntry | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "badges" | "leaderboard">("overview");
  const [badgeToasts, setBadgeToasts] = useState<BadgeToast[]>([]);
  const [freezeInfo, setFreezeInfo] = useState<FreezeInfo | null>(null);
  const [freezing, setFreezing] = useState(false);
  const [freezeSuccess, setFreezeSuccess] = useState(false);
  const knownEarnedIdsRef = useRef<Set<string> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocket();

  const fetchData = useCallback(async () => {
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    try {
      const [gamRes, achRes, freezeRes, lbRes] = await Promise.all([
        fetch(`/api/gamification?localDate=${localDate}`),
        fetch("/api/achievements"),
        fetch("/api/gamification/streak-freeze"),
        fetch(`/api/leaderboard?localDate=${localDate}`),
      ]);

      if (!gamRes.ok || !achRes.ok) return;
      const [gamData, achData] = await Promise.all([gamRes.json(), achRes.json()]);
      if (freezeRes.ok) setFreezeInfo(await freezeRes.json());

      // Find our leaderboard position
      if (lbRes.ok) {
        const lbData = await lbRes.json();
        const myEntry = (lbData.leaderboard as LeaderboardEntry[]).find(
          (e) => e.locationId === locationId
        );
        if (myEntry) setLeaderboardRank(myEntry);
      }

      // Detect newly earned badges
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

      for (const badge of newlyEarned) {
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
    } catch {}
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

  // Live refresh via WebSocket
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

  // Close panel on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
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
      {/* Badge unlock toasts */}
      <AnimatePresence>
        {badgeToasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 60, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed bottom-24 left-1/2 z-[300] -translate-x-1/2 pointer-events-none"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-5 py-3.5 shadow-2xl shadow-amber-200/50 dark:border-amber-800 dark:from-amber-950/80 dark:to-yellow-950/80">
              <motion.span
                className="text-3xl"
                animate={{ rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.3, 1.1, 1.2, 1] }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              >
                {toast.badge.icon}
              </motion.span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
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
      <div className="relative" ref={panelRef}>
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className={cn(
            "flex items-center gap-2 rounded-2xl border px-3 py-1.5 transition-all",
            isOpen
              ? "border-purple-300 bg-purple-50/80 dark:border-purple-700 dark:bg-purple-950/40"
              : "border-border bg-card hover:border-purple-200 dark:hover:border-purple-800"
          )}
        >
          {/* Level ring */}
          <div className="relative h-9 w-9 shrink-0">
            <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-muted/40"
              />
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="url(#levelGradient)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000"
              />
              <defs>
                <linearGradient id="levelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-black text-purple-600 dark:text-purple-400">
                {level.level}
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-2.5">
            {/* Streak */}
            <div className="flex items-center gap-1">
              <Flame className={cn("h-3.5 w-3.5", streakColor)} />
              <span className={cn("text-sm font-bold tabular-nums", streakColor)}>
                {streak.current}
              </span>
            </div>

            {/* XP */}
            <div className="flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {stats.totalXP >= 1000
                  ? `${(stats.totalXP / 1000).toFixed(1)}k`
                  : stats.totalXP}
              </span>
            </div>

            {/* Rank */}
            {leaderboardRank && (
              <div className="flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
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

        {/* Expanded panel */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="absolute right-0 top-full mt-2 z-[200] w-[380px] rounded-2xl border border-border bg-card shadow-2xl shadow-black/10 dark:shadow-black/30 overflow-hidden"
            >
              {/* Header gradient */}
              <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-4">
                <div className="relative z-10 flex items-center gap-3">
                  {/* Large level ring */}
                  <div className="relative h-14 w-14 shrink-0">
                    <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                      <circle
                        cx="28"
                        cy="28"
                        r="24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
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
                    className="absolute top-3 right-3 text-white/60 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Decorative circles */}
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/5" />
                <div className="absolute -right-2 -bottom-8 h-20 w-20 rounded-full bg-white/5" />
              </div>

              {/* Quick stats row */}
              <div className="grid grid-cols-4 gap-px bg-border">
                <div className="bg-card p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Flame className={cn("h-4 w-4", streakColor)} />
                    <span className={cn("text-lg font-black tabular-nums", streakColor)}>
                      {streak.current}
                    </span>
                  </div>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase mt-0.5">Streak</p>
                </div>
                <div className="bg-card p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span className="text-lg font-black tabular-nums text-amber-600 dark:text-amber-400">
                      {stats.totalXP}
                    </span>
                  </div>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase mt-0.5">XP</p>
                </div>
                <div className="bg-card p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Medal className="h-4 w-4 text-amber-500" />
                    <span className="text-lg font-black tabular-nums text-amber-600 dark:text-amber-400">
                      {earnedBadges.length}
                    </span>
                  </div>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase mt-0.5">Badges</p>
                </div>
                <div className="bg-card p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Trophy className="h-4 w-4 text-emerald-500" />
                    <span className="text-lg font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                      {leaderboardRank ? `#${leaderboardRank.rank}` : "--"}
                    </span>
                  </div>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase mt-0.5">Rank</p>
                </div>
              </div>

              {/* Tab navigation */}
              <div className="flex border-b border-border">
                {(["overview", "badges", "leaderboard"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex-1 py-2.5 text-xs font-bold capitalize transition-colors",
                      activeTab === tab
                        ? "border-b-2 border-purple-500 text-purple-600 dark:text-purple-400"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="max-h-[320px] overflow-y-auto p-4">
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    {/* Streak details */}
                    <div className="rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 p-3">
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
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={applyStreakFreeze}
                            disabled={freezing}
                            className={cn(
                              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors",
                              freezeSuccess
                                ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300"
                                : "bg-cyan-50 text-cyan-600 hover:bg-cyan-100 dark:bg-cyan-950 dark:text-cyan-400 dark:hover:bg-cyan-900"
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
                          <div className="h-1.5 rounded-full bg-orange-200/40 dark:bg-orange-800/30 overflow-hidden">
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
                              whileHover={{ scale: 1.15 }}
                              className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-xl cursor-default"
                              title={`${badge.name}: ${badge.description}`}
                            >
                              {badge.icon}
                            </motion.div>
                          ))}
                          {earnedBadges.length > 6 && (
                            <button
                              onClick={() => setActiveTab("badges")}
                              className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-xs font-bold text-muted-foreground hover:text-foreground"
                            >
                              +{earnedBadges.length - 6}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tasks completed today */}
                    <div className="rounded-xl bg-muted/50 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-foreground">Total Tasks Completed</p>
                        <p className="text-lg font-black text-purple-600 dark:text-purple-400 tabular-nums">
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
                        <h3 className="mb-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                          Earned
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                          {earnedBadges.map((badge) => {
                            const tier = badge.tier || "bronze";
                            const tierColors: Record<string, string> = {
                              bronze: "border-orange-300/40 bg-orange-500/5 dark:border-orange-700/40",
                              silver: "border-slate-300/40 bg-slate-500/5 dark:border-slate-700/40",
                              gold: "border-yellow-300/40 bg-yellow-500/5 dark:border-yellow-700/40",
                              platinum: "border-purple-300/40 bg-purple-500/5 dark:border-purple-700/40",
                            };
                            return (
                              <motion.div
                                key={badge.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                  "flex items-center gap-2 rounded-xl border p-2.5",
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
                              className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-2.5 opacity-50"
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
                    {leaderboardRank ? (
                      <>
                        <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 p-3 mb-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                            <Trophy className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
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
                        <p className="text-[10px] text-muted-foreground text-center">
                          Complete more tasks to climb the weekly leaderboard!
                        </p>
                      </>
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

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";

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
}

interface GamificationData {
  streak: StreakData;
  level: LevelData;
  badges: BadgeData[];
  stats: { totalTasksCompleted: number; totalXP: number; totalBonusPoints: number };
}

interface BadgeToast {
  id: string;
  badge: BadgeData;
}

interface FreezeInfo {
  available: number;
  usedThisMonth: number;
  maxPerMonth: number;
  frozenDates: string[];
}

export function GamificationBar() {
  const [data, setData] = useState<GamificationData | null>(null);
  const [showBadges, setShowBadges] = useState(false);
  const [badgeToasts, setBadgeToasts] = useState<BadgeToast[]>([]);
  const [freezeInfo, setFreezeInfo] = useState<FreezeInfo | null>(null);
  const [showFreezeConfirm, setShowFreezeConfirm] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const [freezeSuccess, setFreezeSuccess] = useState(false);
  const knownEarnedIdsRef = useRef<Set<string> | null>(null);
  const { socket } = useSocket();

  const fetchData = useCallback(async () => {
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    
    try {
      const [gamRes, achRes, freezeRes] = await Promise.all([
        fetch(`/api/gamification?localDate=${localDate}`),
        fetch('/api/achievements'),
        fetch('/api/gamification/streak-freeze'),
      ]);
      if (!gamRes.ok || !achRes.ok) return;
      const [gamData, achData] = await Promise.all([gamRes.json(), achRes.json()]);
      if (freezeRes.ok) setFreezeInfo(await freezeRes.json());

      const newlyEarned: BadgeData[] = [];
      if (knownEarnedIdsRef.current !== null) {
        for (const badge of (achData.badges as BadgeData[])) {
          if (badge.earned && !knownEarnedIdsRef.current.has(badge.id)) {
            newlyEarned.push(badge);
          }
        }
      }
      knownEarnedIdsRef.current = new Set(
        (achData.badges as BadgeData[]).filter((b) => b.earned).map((b) => b.id)
      );

      // Show toast for each newly earned badge
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
  }, []);

  const applyStreakFreeze = useCallback(async () => {
    setFreezing(true);
    try {
      const res = await fetch("/api/gamification/streak-freeze", { method: "POST" });
      if (res.ok) {
        setFreezeSuccess(true);
        setShowFreezeConfirm(false);
        setTimeout(() => setFreezeSuccess(false), 3000);
        fetchData();
      }
    } catch {}
    setFreezing(false);
  }, [fetchData]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Live refresh when tasks are completed or leaderboard changes
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

  if (!data) return null;

  const { streak, level, badges } = data;
  const earnedBadges = badges.filter((b) => b.earned);
  const unearnedBadges = badges.filter((b) => !b.earned);

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
            <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-5 py-3.5 shadow-2xl shadow-amber-200/50">
              <motion.span
                className="text-3xl"
                animate={{ rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.3, 1.1, 1.2, 1] }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              >
                {toast.badge.icon}
              </motion.span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Achievement Unlocked!</p>
                <p className="text-sm font-black text-slate-800">{toast.badge.name}</p>
                <p className="text-[11px] text-slate-500">{toast.badge.description}</p>
              </div>
              <motion.div
                className="ml-1 text-2xl"
                animate={{ rotate: [0, 20, -20, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                🏅
              </motion.div>
            </div>
            {/* Confetti particles */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute h-2 w-2 rounded-full"
                style={{
                  background: ["#dc2626","#f59e0b","#22c55e","#3b82f6","#8b5cf6","#ec4899","#f97316","#14b8a6"][i],
                  left: "50%",
                  top: "50%",
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: (Math.cos((i / 8) * Math.PI * 2) * 60),
                  y: (Math.sin((i / 8) * Math.PI * 2) * 60),
                  opacity: 0,
                  scale: 0,
                }}
                transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
              />
            ))}
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="flex items-center gap-3">
        {/* Streak + Freeze */}
        <div className="relative flex items-center gap-1.5">
        <motion.div
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 px-3.5 py-2 cursor-default"
          whileHover={{ scale: 1.05 }}
          title={streak.current > 0
            ? `${streak.current}-day streak${streak.currentMilestone ? ` (${streak.currentMilestone.name})` : ""}${streak.nextMilestone ? ` — ${streak.daysToNext} days to ${streak.nextMilestone.name}` : ""}`
            : "Complete all tasks today to start a streak!"
          }
        >
          <motion.span
            className="text-xl leading-none"
            animate={streak.current >= 3 ? { scale: [1, 1.2, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          >
            {streak.current >= 30 ? "🔥" : streak.current >= 7 ? "⚡" : streak.current >= 3 ? "🔥" : "🔥"}
          </motion.span>
          <span className={cn(
            "text-base font-black tabular-nums",
            streak.current >= 7 ? "text-orange-600" : streak.current >= 3 ? "text-orange-500" : "text-slate-400"
          )}>
            {streak.current}
          </span>
        </motion.div>

        {/* Streak Freeze button */}
        {freezeInfo && freezeInfo.available > 0 && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowFreezeConfirm((v) => !v)}
            title={`Streak Freeze: ${freezeInfo.available} left this month`}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg text-base transition-colors",
              freezeSuccess ? "bg-cyan-100" : "hover:bg-cyan-100/60"
            )}
          >
            {freezeSuccess ? "✅" : "🧊"}
          </motion.button>
        )}

        {/* Freeze confirm popover */}
        <AnimatePresence>
          {showFreezeConfirm && freezeInfo && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className="absolute left-0 top-full mt-2 z-[2005] w-64 rounded-2xl border border-cyan-200 bg-card shadow-2xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🧊</span>
                <div>
                  <p className="text-sm font-black text-foreground">Streak Freeze</p>
                  <p className="text-[10px] text-muted-foreground">{freezeInfo.available} of {freezeInfo.maxPerMonth} left this month</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Apply a freeze to yesterday — it counts as a perfect day and protects your streak.</p>
              <div className="flex gap-2">
                <button
                  onClick={applyStreakFreeze}
                  disabled={freezing}
                  className="flex-1 rounded-xl bg-cyan-500 py-1.5 text-xs font-bold text-white hover:bg-cyan-600 disabled:opacity-50 transition-colors"
                >
                  {freezing ? "Applying..." : "Use Freeze"}
                </button>
                <button
                  onClick={() => setShowFreezeConfirm(false)}
                  className="flex-1 rounded-xl bg-muted py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>

        {/* Level */}
        <motion.div
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 px-3.5 py-2 cursor-default"
          whileHover={{ scale: 1.05 }}
          title={`Level ${level.level}: ${level.title} — ${level.totalXP} XP${level.nextLevel ? ` (${level.xpToNext} to Level ${level.nextLevel.level})` : ""}`}
        >
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-purple-500 uppercase tracking-wider">Lv</span>
            <span className="text-base font-black text-purple-700 tabular-nums">{level.level}</span>
          </div>
          <div className="w-20 h-2 rounded-full bg-purple-200/60 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${level.progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        {/* Badges */}
        <motion.button
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500/10 to-yellow-500/10 px-3.5 py-2"
          whileHover={{ scale: 1.05 }}
          onClick={() => setShowBadges(true)}
          title="View badges"
        >
          <span className="text-xl leading-none">🏅</span>
          <span className="text-base font-black text-amber-700 tabular-nums">{earnedBadges.length}/{badges.length}</span>
        </motion.button>
      </div>

      {/* Badge modal */}
      <AnimatePresence>
        {showBadges && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowBadges(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-[480px] max-w-[90vw] max-h-[80vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-black text-slate-800">Badges & Achievements</h2>
                  <p className="text-xs text-slate-400">{earnedBadges.length} of {badges.length} earned</p>
                </div>
                <button onClick={() => setShowBadges(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
              </div>

              {/* Stats strip */}
              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-orange-50 p-3 text-center">
                  <p className="text-2xl font-black text-orange-600">{streak.current}</p>
                  <p className="text-[10px] font-semibold text-orange-400 uppercase">Day Streak</p>
                </div>
                <div className="rounded-xl bg-purple-50 p-3 text-center">
                  <p className="text-2xl font-black text-purple-600">Lv.{level.level}</p>
                  <p className="text-[10px] font-semibold text-purple-400 uppercase">{level.title}</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3 text-center">
                  <p className="text-2xl font-black text-amber-600">{data.stats.totalXP}</p>
                  <p className="text-[10px] font-semibold text-amber-400 uppercase">Total XP</p>
                </div>
              </div>

              {/* Level progress */}
              <div className="mb-5 rounded-xl bg-slate-50 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-600">Level {level.level} → {level.nextLevel ? level.nextLevel.level : "MAX"}</span>
                  <span className="text-[10px] text-slate-400">{level.totalXP} / {level.nextLevel ? level.nextLevel.xpRequired : level.totalXP} XP</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${level.progress}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Earned badges */}
              {earnedBadges.length > 0 && (
                <div className="mb-4">
                  <h3 className="mb-2 text-xs font-bold text-emerald-600 uppercase tracking-wider">Earned</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {earnedBadges.map((badge) => {
                      const tier = (badge as any).tier || 'bronze';
                      const tierColors: Record<string, { border: string; bg: string }> = {
                        bronze: { border: 'border-orange-200', bg: 'bg-orange-50/50' },
                        silver: { border: 'border-slate-300', bg: 'bg-slate-50/50' },
                        gold: { border: 'border-yellow-300', bg: 'bg-yellow-50/50' },
                        platinum: { border: 'border-purple-300', bg: 'bg-purple-50/50' },
                      };
                      const colors = tierColors[tier] || tierColors.bronze;
                      
                      return (
                        <motion.div
                          key={badge.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn("flex items-center gap-3 rounded-xl border p-3", colors.border, colors.bg)}
                        >
                          <span className="text-2xl">{badge.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="text-xs font-bold text-slate-800 truncate">{badge.name}</p>
                              <span className={cn(
                                "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase shrink-0",
                                tier === 'platinum' && "bg-purple-100 text-purple-600",
                                tier === 'gold' && "bg-yellow-100 text-yellow-600",
                                tier === 'silver' && "bg-slate-200 text-slate-600",
                                tier === 'bronze' && "bg-orange-100 text-orange-600"
                              )}>
                                {tier}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate">{badge.description}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Unearned badges */}
              {unearnedBadges.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Locked</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {unearnedBadges.map((badge) => (
                      <div
                        key={badge.id}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 opacity-50"
                      >
                        <span className="text-2xl grayscale">{badge.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-500 truncate">{badge.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{badge.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

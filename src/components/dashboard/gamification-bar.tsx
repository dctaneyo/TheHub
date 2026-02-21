"use client";

import { useState, useEffect, useCallback } from "react";
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

export function GamificationBar() {
  const [data, setData] = useState<GamificationData | null>(null);
  const [showBadges, setShowBadges] = useState(false);
  const { socket } = useSocket();

  const fetchData = useCallback(async () => {
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    
    try {
      // Fetch gamification data (streak, level, stats)
      const gamRes = await fetch(`/api/gamification?localDate=${localDate}`);
      if (!gamRes.ok) return;
      const gamData = await gamRes.json();
      
      // Fetch new achievements
      const achRes = await fetch('/api/achievements');
      if (!achRes.ok) return;
      const achData = await achRes.json();
      
      // Merge data
      setData({
        streak: gamData.streak,
        level: gamData.level,
        badges: achData.badges,
        stats: gamData.stats,
      });
    } catch {}
  }, []);

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
      <div className="flex items-center gap-3">
        {/* Streak */}
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

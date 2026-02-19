"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    fetch("/api/gamification")
      .then(async (r) => { if (r.ok) setData(await r.json()); })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const { streak, level, badges } = data;
  const earnedBadges = badges.filter((b) => b.earned);
  const unearnedBadges = badges.filter((b) => !b.earned);

  return (
    <>
      <div className="flex items-center gap-3">
        {/* Streak */}
        <motion.div
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 px-3 py-1.5 cursor-default"
          whileHover={{ scale: 1.05 }}
          title={streak.current > 0
            ? `${streak.current}-day streak${streak.currentMilestone ? ` (${streak.currentMilestone.name})` : ""}${streak.nextMilestone ? ` — ${streak.daysToNext} days to ${streak.nextMilestone.name}` : ""}`
            : "Complete all tasks today to start a streak!"
          }
        >
          <motion.span
            className="text-lg leading-none"
            animate={streak.current >= 3 ? { scale: [1, 1.2, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          >
            {streak.current >= 30 ? "🔥" : streak.current >= 7 ? "⚡" : streak.current >= 3 ? "🔥" : "🔥"}
          </motion.span>
          <span className={cn(
            "text-sm font-black tabular-nums",
            streak.current >= 7 ? "text-orange-600" : streak.current >= 3 ? "text-orange-500" : "text-slate-400"
          )}>
            {streak.current}
          </span>
        </motion.div>

        {/* Level */}
        <motion.div
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 px-3 py-1.5 cursor-default"
          whileHover={{ scale: 1.05 }}
          title={`Level ${level.level}: ${level.title} — ${level.totalXP} XP${level.nextLevel ? ` (${level.xpToNext} to Level ${level.nextLevel.level})` : ""}`}
        >
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">Lv</span>
            <span className="text-sm font-black text-purple-700 tabular-nums">{level.level}</span>
          </div>
          <div className="w-16 h-1.5 rounded-full bg-purple-200/60 overflow-hidden">
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
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-yellow-500/10 px-3 py-1.5"
          whileHover={{ scale: 1.05 }}
          onClick={() => setShowBadges(true)}
          title="View badges"
        >
          <span className="text-lg leading-none">🏅</span>
          <span className="text-sm font-black text-amber-700 tabular-nums">{earnedBadges.length}/{badges.length}</span>
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
                    {earnedBadges.map((badge) => (
                      <motion.div
                        key={badge.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3"
                      >
                        <span className="text-2xl">{badge.icon}</span>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{badge.name}</p>
                          <p className="text-[10px] text-slate-400">{badge.description}</p>
                        </div>
                      </motion.div>
                    ))}
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
                        <div>
                          <p className="text-xs font-bold text-slate-500">{badge.name}</p>
                          <p className="text-[10px] text-slate-400">{badge.description}</p>
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

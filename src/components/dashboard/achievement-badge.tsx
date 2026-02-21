"use client";

import { useState, useEffect } from "react";
import { Trophy, Lock, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { playAchievementSound } from "@/lib/sound-effects";

interface Achievement {
  id: string;
  name: string;
  desc: string;
  tier: string;
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

interface AchievementData {
  achievements: Achievement[];
  unlockedCount: number;
  totalCount: number;
}

export function AchievementBadge() {
  const [data, setData] = useState<AchievementData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newUnlock, setNewUnlock] = useState<Achievement | null>(null);

  useEffect(() => {
    fetchAchievements();
  }, []);

  const fetchAchievements = async () => {
    try {
      const res = await fetch("/api/achievements");
      if (res.ok) {
        const achievementData = await res.json();
        setData(achievementData);
      }
    } catch {}
  };

  const tierColors: Record<string, { bg: string; text: string; border: string }> = {
    bronze: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200" },
    silver: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-300" },
    gold: { bg: "bg-yellow-50", text: "text-yellow-600", border: "border-yellow-300" },
    platinum: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-300" },
  };

  if (!data) return null;

  const recentUnlocked = data.achievements.filter(a => a.unlocked).slice(0, 3);

  return (
    <>
      {/* Badge Counter */}
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 px-4 py-2 shadow-sm hover:shadow-md transition-all"
      >
        <Trophy className="h-5 w-5 text-purple-600" />
        <div className="text-left">
          <p className="text-xs font-semibold text-purple-600">Achievements</p>
          <p className="text-sm font-bold text-slate-700">
            {data.unlockedCount}/{data.totalCount}
          </p>
        </div>
      </button>

      {/* Achievement Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">Achievements</h3>
                  <p className="text-sm text-slate-500">
                    {data.unlockedCount} of {data.totalCount} unlocked
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100"
                >
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {data.achievements.map((achievement) => {
                  const colors = tierColors[achievement.tier] || tierColors.bronze;
                  return (
                    <div
                      key={achievement.id}
                      className={cn(
                        "rounded-xl border-2 p-4 transition-all",
                        achievement.unlocked
                          ? `${colors.border} ${colors.bg}`
                          : "border-slate-200 bg-slate-50 opacity-60"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl",
                          achievement.unlocked ? colors.bg : "bg-slate-100"
                        )}>
                          {achievement.unlocked ? achievement.icon : <Lock className="h-5 w-5 text-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className={cn(
                              "text-sm font-bold",
                              achievement.unlocked ? "text-slate-800" : "text-slate-400"
                            )}>
                              {achievement.name}
                            </h4>
                            <span className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                              colors.bg,
                              colors.text
                            )}>
                              {achievement.tier}
                            </span>
                          </div>
                          <p className={cn(
                            "mt-1 text-xs",
                            achievement.unlocked ? "text-slate-600" : "text-slate-400"
                          )}>
                            {achievement.desc}
                          </p>
                          {achievement.unlocked && achievement.unlockedAt && (
                            <p className="mt-2 text-[10px] text-slate-400">
                              Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Achievement Unlock Notification */}
      <AnimatePresence>
        {newUnlock && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className="fixed bottom-4 right-4 z-50 w-80 rounded-2xl border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-orange-50 p-4 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-4xl">
                {newUnlock.icon}
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-yellow-600">
                  Achievement Unlocked!
                </p>
                <h4 className="mt-1 text-lg font-bold text-slate-800">{newUnlock.name}</h4>
                <p className="mt-0.5 text-sm text-slate-600">{newUnlock.desc}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Export function to show achievement unlock
export function showAchievementUnlock(achievement: Achievement) {
  playAchievementSound();
  // This would need to be wired up through context or state management
  // For now, the achievement unlock will be shown via the API response
}

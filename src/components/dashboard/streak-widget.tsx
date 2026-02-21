"use client";

import { useState, useEffect } from "react";
import { Flame, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface StreakData {
  current_streak: number;
  longest_streak: number;
  streak_freeze_available: number;
}

export function StreakWidget() {
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStreak();
  }, []);

  const fetchStreak = async () => {
    try {
      const res = await fetch("/api/streaks");
      if (res.ok) {
        const data = await res.json();
        setStreak(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  if (loading || !streak) return null;

  const hasStreak = streak.current_streak > 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "rounded-2xl border p-4 shadow-sm transition-all",
        hasStreak
          ? "border-orange-200 bg-gradient-to-br from-orange-50 to-red-50"
          : "border-slate-200 bg-white"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl",
            hasStreak ? "bg-orange-100" : "bg-slate-100"
          )}>
            <Flame className={cn("h-6 w-6", hasStreak ? "text-orange-500" : "text-slate-400")} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Current Streak
            </p>
            <div className="flex items-baseline gap-1">
              <p className={cn(
                "text-2xl font-black",
                hasStreak ? "text-orange-600" : "text-slate-400"
              )}>
                {streak.current_streak}
              </p>
              <p className="text-sm font-medium text-slate-500">
                {streak.current_streak === 1 ? "day" : "days"}
              </p>
            </div>
          </div>
        </div>

        {streak.streak_freeze_available > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5">
            <Shield className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-bold text-blue-600">
              {streak.streak_freeze_available} {streak.streak_freeze_available === 1 ? "freeze" : "freezes"}
            </span>
          </div>
        )}
      </div>

      {streak.longest_streak > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-white/50 px-3 py-2">
          <span className="text-xs font-medium text-slate-500">Longest Streak</span>
          <span className="text-sm font-bold text-slate-700">
            {streak.longest_streak} {streak.longest_streak === 1 ? "day" : "days"}
          </span>
        </div>
      )}

      <AnimatePresence>
        {hasStreak && streak.current_streak >= 7 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden"
          >
            <div className="rounded-lg bg-gradient-to-r from-orange-100 to-red-100 px-3 py-2">
              <p className="text-xs font-bold text-orange-700">
                🔥 You're on fire! Keep it going!
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

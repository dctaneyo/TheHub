"use client";

import { useState, useEffect } from "react";
import { Trophy, Medal, Star, TrendingUp, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  locationId: string;
  name: string;
  storeNumber: string;
  totalTasks: number;
  completedTasks: number;
  completionPct: number;
  basePoints: number;
  bonusPoints: number;
  totalPoints: number;
  rank: number;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  weekStart: string;
  weekEnd: string;
}

const rankIcons = [Trophy, Medal, Star];
const rankColors = [
  "text-amber-500",
  "text-slate-400",
  "text-orange-400",
];
const rankBgColors = [
  "bg-amber-50 border-amber-200",
  "bg-slate-50 border-slate-200",
  "bg-orange-50 border-orange-200",
];

function formatWeekRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const sMonth = s.toLocaleDateString("en-US", { month: "short" });
  const eMonth = e.toLocaleDateString("en-US", { month: "short" });
  if (sMonth === eMonth) {
    return `${sMonth} ${s.getDate()} – ${e.getDate()}`;
  }
  return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}`;
}

interface LeaderboardProps {
  currentLocationId?: string;
  compact?: boolean;
}

export function Leaderboard({ currentLocationId, compact = false }: LeaderboardProps) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then(async (r) => {
        if (r.ok) setData(await r.json());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-20 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-amber-500" />
      </div>
    );
  }

  if (!data || data.leaderboard.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-slate-400">No locations yet</div>
    );
  }

  const entries = compact ? data.leaderboard.slice(0, 5) : data.leaderboard;

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <h2 className={cn("font-bold text-slate-800", compact ? "text-xs" : "text-sm")}>Weekly Leaderboard</h2>
        </div>
        <span className="text-[10px] font-medium text-slate-400">
          {formatWeekRange(data.weekStart, data.weekEnd)}
        </span>
      </div>

      <div className={cn("space-y-1.5", compact ? "" : "space-y-2")}>
        {entries.map((entry) => {
          const isMe = entry.locationId === currentLocationId;
          const RankIcon = entry.rank <= 3 ? rankIcons[entry.rank - 1] : null;
          const rankColor = entry.rank <= 3 ? rankColors[entry.rank - 1] : "text-slate-400";
          const cardBg = isMe
            ? "bg-[var(--hub-red)]/5 border-[var(--hub-red)]/20 ring-1 ring-inset ring-[var(--hub-red)]/10"
            : entry.rank <= 3
            ? rankBgColors[entry.rank - 1]
            : "bg-white border-slate-200";

          return (
            <div
              key={entry.locationId}
              className={cn(
                "flex items-center gap-2 rounded-xl border p-2 transition-all",
                compact ? "p-1.5" : "p-2.5",
                cardBg
              )}
            >
              {/* Rank */}
              <div className={cn("flex shrink-0 items-center justify-center", compact ? "h-6 w-6" : "h-8 w-8")}>
                {RankIcon ? (
                  <RankIcon className={cn(rankColor, compact ? "h-3.5 w-3.5" : "h-4.5 w-4.5")} />
                ) : (
                  <span className={cn("font-bold text-slate-400", compact ? "text-[10px]" : "text-xs")}>#{entry.rank}</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn("font-semibold text-slate-800 truncate", compact ? "text-[11px]" : "text-xs")}>
                    {entry.name}
                  </span>
                  {isMe && (
                    <span className="shrink-0 rounded bg-[var(--hub-red)]/10 px-1 text-[8px] font-bold text-[var(--hub-red)]">YOU</span>
                  )}
                </div>
                {/* Progress bar */}
                <div className="mt-1 flex items-center gap-2">
                  <div className={cn("flex-1 rounded-full bg-slate-200/60", compact ? "h-1" : "h-1.5")}>
                    <div
                      className={cn(
                        "rounded-full transition-all duration-500",
                        compact ? "h-1" : "h-1.5",
                        entry.completionPct >= 80
                          ? "bg-emerald-500"
                          : entry.completionPct >= 50
                          ? "bg-amber-500"
                          : entry.completionPct >= 25
                          ? "bg-orange-500"
                          : "bg-red-400"
                      )}
                      style={{ width: `${Math.min(entry.completionPct, 100)}%` }}
                    />
                  </div>
                  <span className={cn("shrink-0 font-bold tabular-nums", compact ? "text-[9px]" : "text-[10px]",
                    entry.completionPct >= 80 ? "text-emerald-600" : entry.completionPct >= 50 ? "text-amber-600" : "text-slate-500"
                  )}>
                    {entry.completionPct}%
                  </span>
                </div>
              </div>

              {/* Points */}
              <div className={cn("shrink-0 text-right", compact ? "" : "")}>
                <div className="flex items-center gap-0.5 justify-end">
                  <Zap className={cn("text-amber-500", compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
                  <span className={cn("font-bold tabular-nums text-slate-800", compact ? "text-[10px]" : "text-xs")}>
                    {entry.totalPoints}
                  </span>
                </div>
                {entry.bonusPoints > 0 && (
                  <span className={cn("text-amber-600 font-medium", compact ? "text-[8px]" : "text-[9px]")}>
                    +{entry.bonusPoints} bonus
                  </span>
                )}
                {!compact && (
                  <p className="text-[9px] text-slate-400">
                    {entry.completedTasks}/{entry.totalTasks} tasks
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {compact && data.leaderboard.length > 5 && (
        <p className="mt-1 text-center text-[10px] text-slate-400">
          +{data.leaderboard.length - 5} more locations
        </p>
      )}
    </div>
  );
}

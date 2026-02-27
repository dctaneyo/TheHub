"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, Zap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";
import { ConfettiBurst } from "./celebrations";

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

function formatWeekRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const sMonth = s.toLocaleDateString("en-US", { month: "short" });
  const eMonth = e.toLocaleDateString("en-US", { month: "short" });
  if (sMonth === eMonth) return `${sMonth} ${s.getDate()} – ${e.getDate()}`;
  return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}`;
}

function pctColor(pct: number) {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  if (pct >= 25) return "bg-orange-500";
  return "bg-red-400";
}
function pctTextColor(pct: number) {
  if (pct >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const RANK_BG: Record<number, string> = {
  1: "bg-amber-50 border-amber-300/50 dark:bg-amber-500/10 dark:border-amber-500/20",
  2: "bg-slate-50 border-slate-300/50 dark:bg-slate-500/10 dark:border-slate-500/20",
  3: "bg-orange-50 border-orange-300/50 dark:bg-orange-500/10 dark:border-orange-500/20",
};

function RankRow({ entry, isMe, compact }: { entry: LeaderboardEntry; isMe: boolean; compact: boolean }) {
  const medal = MEDALS[entry.rank];
  const shouldCelebrate = isMe && entry.rank <= 3;

  const cardBg = isMe
    ? "bg-[var(--hub-red)]/5 border-[var(--hub-red)]/20 ring-1 ring-inset ring-[var(--hub-red)]/10"
    : RANK_BG[entry.rank] || "bg-card border-border";

  return (
    <>
      {shouldCelebrate && <ConfettiBurst active={true} />}
      <div className={cn("flex items-center gap-3 rounded-xl border transition-all", compact ? "p-1.5" : "p-3", cardBg)}>
        {/* Rank indicator */}
        <div className={cn("flex shrink-0 items-center justify-center", compact ? "h-6 w-6" : "h-9 w-9")}>
          {medal ? (
            <div className="flex items-center gap-0.5">
              <span className={compact ? "text-base leading-none" : "text-xl leading-none"}>{medal}</span>
              {shouldCelebrate && <Sparkles className="h-3 w-3 text-yellow-500 animate-pulse" />}
            </div>
          ) : (
            <span className={cn("font-bold text-muted-foreground tabular-nums", compact ? "text-[10px]" : "text-sm")}>#{entry.rank}</span>
          )}
        </div>

        {/* Name + store + progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("font-semibold text-foreground truncate", compact ? "text-[11px]" : "text-sm")}>{entry.name}</span>
            {!compact && <span className="text-[10px] text-muted-foreground shrink-0">#{entry.storeNumber}</span>}
            {isMe && <span className="shrink-0 rounded-full bg-[var(--hub-red)]/10 px-1.5 py-0.5 text-[8px] font-bold text-[var(--hub-red)]">YOU</span>}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className={cn("flex-1 rounded-full bg-muted", compact ? "h-1" : "h-2")}>
              <div className={cn("rounded-full transition-all duration-500", compact ? "h-1" : "h-2", pctColor(entry.completionPct))} style={{ width: `${Math.min(entry.completionPct, 100)}%` }} />
            </div>
            <span className={cn("shrink-0 font-bold tabular-nums", compact ? "text-[9px]" : "text-xs", pctTextColor(entry.completionPct))}>{entry.completionPct}%</span>
          </div>
        </div>

        {/* Points + tasks */}
        <div className="shrink-0 text-right">
          <div className="flex items-center gap-0.5 justify-end">
            <Zap className={cn("text-amber-500", compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5")} />
            <span className={cn("font-bold tabular-nums text-foreground", compact ? "text-[10px]" : "text-sm")}>{entry.totalPoints}</span>
          </div>
          {entry.bonusPoints > 0 && <span className={cn("text-amber-600 dark:text-amber-400 font-medium", compact ? "text-[8px]" : "text-[10px]")}>+{entry.bonusPoints} bonus</span>}
          {!compact && <p className="text-[10px] text-muted-foreground">{entry.completedTasks}/{entry.totalTasks} tasks</p>}
        </div>
      </div>
    </>
  );
}

interface LeaderboardProps {
  currentLocationId?: string;
  compact?: boolean;
}

export function Leaderboard({ currentLocationId, compact = false }: LeaderboardProps) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  const fetchData = useCallback(() => {
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    fetch(`/api/leaderboard?localDate=${localDate}`)
      .then(async (r) => { if (r.ok) setData(await r.json()); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Live refresh when leaderboard changes
  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchData();
    socket.on("leaderboard:updated", handler);
    socket.on("task:completed", handler);
    return () => {
      socket.off("leaderboard:updated", handler);
      socket.off("task:completed", handler);
    };
  }, [socket, fetchData]);

  if (loading) {
    return (
      <div className="flex h-20 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-amber-500" />
      </div>
    );
  }

  if (!data || data.leaderboard.length === 0) {
    return <div className="py-4 text-center text-xs text-muted-foreground">No locations yet</div>;
  }

  const entries = compact ? data.leaderboard.slice(0, 5) : data.leaderboard;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Trophy className={cn("text-amber-500", compact ? "h-3.5 w-3.5" : "h-5 w-5")} />
          <h2 className={cn("font-bold text-foreground", compact ? "text-xs" : "text-lg")}>Weekly Leaderboard</h2>
        </div>
        <span className={cn("font-medium text-muted-foreground", compact ? "text-[10px]" : "text-xs")}>{formatWeekRange(data.weekStart, data.weekEnd)}</span>
      </div>

      {/* Uniform list view for all entries */}
      <div className={compact ? "space-y-1.5" : "space-y-2"}>
        {entries.map((entry) => (
          <RankRow key={entry.locationId} entry={entry} isMe={entry.locationId === currentLocationId} compact={compact} />
        ))}
      </div>

      {compact && data.leaderboard.length > 5 && (
        <p className="text-center text-[10px] text-muted-foreground">+{data.leaderboard.length - 5} more</p>
      )}
    </div>
  );
}

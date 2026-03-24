"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, Zap, Sparkles } from "@/lib/icons";
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
  if (pct >= 80) return "bg-[var(--muted-green)]";
  if (pct >= 50) return "bg-[var(--warm-amber)]";
  if (pct >= 25) return "bg-orange-500";
  return "bg-[var(--hub-red)]";
}
function pctTextColor(pct: number) {
  if (pct >= 80) return "text-[var(--muted-green)]";
  if (pct >= 50) return "text-[var(--warm-amber)]";
  return "text-muted-foreground";
}

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const RANK_BG: Record<number, string> = {
  1: "bg-white/5 backdrop-blur-xl border-[var(--warm-amber)]/20",
  2: "bg-white/5 backdrop-blur-xl border-[var(--slate-blue)]/20",
  3: "bg-white/5 backdrop-blur-xl border-[var(--warm-amber)]/15",
};

// Colored circle avatar palette for leaderboard entries (Req 11.5)
const AVATAR_COLORS = [
  "bg-[var(--hub-red)]",
  "bg-[var(--warm-amber)]",
  "bg-[var(--muted-green)]",
  "bg-[var(--slate-blue)]",
  "bg-purple-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-indigo-500",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function RankRow({ entry, isMe, compact }: { entry: LeaderboardEntry; isMe: boolean; compact: boolean }) {
  const medal = MEDALS[entry.rank];
  const shouldCelebrate = isMe && entry.rank <= 3;

  const cardBg = isMe
    ? "bg-[var(--hub-red)]/5 backdrop-blur-xl border-[var(--hub-red)]/20 ring-1 ring-inset ring-[var(--hub-red)]/10"
    : RANK_BG[entry.rank] || "bg-white/5 backdrop-blur-xl border-white/10";

  return (
    <>
      {shouldCelebrate && <ConfettiBurst active={true} />}
      <div className={cn("flex items-center gap-3 rounded-2xl border transition-all", compact ? "p-1.5" : "p-3", cardBg)}>
        {/* Rank indicator */}
        <div className={cn("flex shrink-0 items-center justify-center", compact ? "h-6 w-6" : "h-9 w-9")}>
          {medal ? (
            <div className="flex items-center gap-0.5">
              <span className={compact ? "text-base leading-none" : "text-xl leading-none"}>{medal}</span>
              {shouldCelebrate && <Sparkles className="h-3 w-3 text-[var(--warm-amber)] animate-pulse" />}
            </div>
          ) : (
            <span className={cn("font-bold text-muted-foreground tabular-nums", compact ? "text-[10px]" : "text-sm")}>#{entry.rank}</span>
          )}
        </div>

        {/* Colored circle avatar */}
        <div className={cn(
          "shrink-0 flex items-center justify-center rounded-full text-white font-bold",
          compact ? "h-6 w-6 text-[8px]" : "h-8 w-8 text-xs",
          getAvatarColor(entry.name),
        )}>
          {getInitials(entry.name)}
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
            <Zap className={cn("text-[var(--warm-amber)]", compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5")} />
            <span className={cn("font-bold tabular-nums text-foreground", compact ? "text-[10px]" : "text-sm")}>{entry.totalPoints}</span>
          </div>
          {entry.bonusPoints > 0 && <span className={cn("text-[var(--warm-amber)] font-medium", compact ? "text-[8px]" : "text-[10px]")}>+{entry.bonusPoints} bonus</span>}
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
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[var(--warm-amber)]" />
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
          <Trophy className={cn("text-[var(--warm-amber)]", compact ? "h-3.5 w-3.5" : "h-5 w-5")} />
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

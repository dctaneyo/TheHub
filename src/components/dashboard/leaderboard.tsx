"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";

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
  if (pct >= 80) return "text-emerald-600";
  if (pct >= 50) return "text-amber-600";
  return "text-slate-500";
}

// Podium card for top 3 (full mode only)
function PodiumCard({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const configs = [
    {
      medal: "🥇",
      label: "1st Place",
      gradient: "from-amber-400 to-yellow-300",
      border: "border-amber-300",
      bg: "bg-gradient-to-br from-amber-50 to-yellow-50",
      text: "text-amber-800",
      sub: "text-amber-600",
      bar: "bg-amber-400",
      height: "pt-6",
    },
    {
      medal: "🥈",
      label: "2nd Place",
      gradient: "from-slate-400 to-slate-300",
      border: "border-slate-300",
      bg: "bg-gradient-to-br from-slate-50 to-slate-100",
      text: "text-slate-700",
      sub: "text-slate-500",
      bar: "bg-slate-400",
      height: "pt-3",
    },
    {
      medal: "🥉",
      label: "3rd Place",
      gradient: "from-orange-400 to-amber-300",
      border: "border-orange-300",
      bg: "bg-gradient-to-br from-orange-50 to-amber-50",
      text: "text-orange-800",
      sub: "text-orange-600",
      bar: "bg-orange-400",
      height: "pt-1",
    },
  ];
  const c = configs[entry.rank - 1];

  return (
    <div className={cn("flex flex-col items-center rounded-2xl border-2 p-4 transition-all", c.bg, c.border, isMe && "ring-2 ring-[var(--hub-red)] ring-offset-1")}>
      <span className="text-3xl leading-none">{c.medal}</span>
      <span className={cn("mt-1 text-[10px] font-bold uppercase tracking-wider", c.sub)}>{c.label}</span>
      <p className={cn("mt-2 text-center text-sm font-bold leading-tight", c.text)}>{entry.name}</p>
      <p className={cn("text-[10px]", c.sub)}>#{entry.storeNumber}</p>
      {isMe && <span className="mt-1 rounded-full bg-[var(--hub-red)]/10 px-2 py-0.5 text-[9px] font-bold text-[var(--hub-red)]">YOU</span>}
      <div className="mt-3 w-full">
        <div className="h-1.5 w-full rounded-full bg-black/10">
          <div className={cn("h-1.5 rounded-full transition-all duration-700", c.bar)} style={{ width: `${Math.min(entry.completionPct, 100)}%` }} />
        </div>
        <p className={cn("mt-1 text-center text-xs font-bold", c.text)}>{entry.completionPct}%</p>
      </div>
      <div className="mt-2 flex items-center gap-1">
        <Zap className="h-3 w-3 text-amber-500" />
        <span className={cn("text-sm font-black tabular-nums", c.text)}>{entry.totalPoints}</span>
        {entry.bonusPoints > 0 && <span className="text-[9px] text-amber-600">+{entry.bonusPoints}</span>}
      </div>
      <p className={cn("text-[9px]", c.sub)}>{entry.completedTasks}/{entry.totalTasks} tasks</p>
    </div>
  );
}

// Row for rank 4+ (and compact mode for all)
function RankRow({ entry, isMe, compact }: { entry: LeaderboardEntry; isMe: boolean; compact: boolean }) {
  const cardBg = isMe
    ? "bg-[var(--hub-red)]/5 border-[var(--hub-red)]/20 ring-1 ring-inset ring-[var(--hub-red)]/10"
    : "bg-white border-slate-200";

  return (
    <div className={cn("flex items-center gap-2 rounded-xl border transition-all", compact ? "p-1.5" : "p-2.5", cardBg)}>
      <div className={cn("flex shrink-0 items-center justify-center font-bold text-slate-400", compact ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs")}>
        #{entry.rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn("font-semibold text-slate-800 truncate", compact ? "text-[11px]" : "text-xs")}>{entry.name}</span>
          {isMe && <span className="shrink-0 rounded bg-[var(--hub-red)]/10 px-1 text-[8px] font-bold text-[var(--hub-red)]">YOU</span>}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className={cn("flex-1 rounded-full bg-slate-200/60", compact ? "h-1" : "h-1.5")}>
            <div className={cn("rounded-full transition-all duration-500", compact ? "h-1" : "h-1.5", pctColor(entry.completionPct))} style={{ width: `${Math.min(entry.completionPct, 100)}%` }} />
          </div>
          <span className={cn("shrink-0 font-bold tabular-nums", compact ? "text-[9px]" : "text-[10px]", pctTextColor(entry.completionPct))}>{entry.completionPct}%</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="flex items-center gap-0.5 justify-end">
          <Zap className={cn("text-amber-500", compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
          <span className={cn("font-bold tabular-nums text-slate-800", compact ? "text-[10px]" : "text-xs")}>{entry.totalPoints}</span>
        </div>
        {entry.bonusPoints > 0 && <span className={cn("text-amber-600 font-medium", compact ? "text-[8px]" : "text-[9px]")}>+{entry.bonusPoints}</span>}
        {!compact && <p className="text-[9px] text-slate-400">{entry.completedTasks}/{entry.totalTasks}</p>}
      </div>
    </div>
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
    fetch("/api/leaderboard")
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
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-amber-500" />
      </div>
    );
  }

  if (!data || data.leaderboard.length === 0) {
    return <div className="py-4 text-center text-xs text-slate-400">No locations yet</div>;
  }

  const top3 = data.leaderboard.filter((e) => e.rank <= 3);
  const rest = data.leaderboard.filter((e) => e.rank > 3);
  const compactEntries = data.leaderboard.slice(0, 5);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Trophy className={cn("text-amber-500", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
          <h2 className={cn("font-bold text-slate-800", compact ? "text-xs" : "text-sm")}>Weekly Leaderboard</h2>
        </div>
        <span className="text-[10px] font-medium text-slate-400">{formatWeekRange(data.weekStart, data.weekEnd)}</span>
      </div>

      {compact ? (
        /* Compact mode: simple rows for all */
        <div className="space-y-1.5">
          {compactEntries.map((entry) => (
            <RankRow key={entry.locationId} entry={entry} isMe={entry.locationId === currentLocationId} compact />
          ))}
          {data.leaderboard.length > 5 && (
            <p className="text-center text-[10px] text-slate-400">+{data.leaderboard.length - 5} more</p>
          )}
        </div>
      ) : (
        /* Full mode: podium for top 3, rows for rest */
        <>
          {top3.length > 0 && (
            <div className={cn("grid gap-3", top3.length === 1 ? "grid-cols-1" : top3.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
              {top3.map((entry) => (
                <PodiumCard key={entry.locationId} entry={entry} isMe={entry.locationId === currentLocationId} />
              ))}
            </div>
          )}
          {rest.length > 0 && (
            <div className="space-y-2">
              {rest.map((entry) => (
                <RankRow key={entry.locationId} entry={entry} isMe={entry.locationId === currentLocationId} compact={false} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

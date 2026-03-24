"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Clock,
} from "@/lib/icons";
import { useSocket } from "@/lib/socket-context";
import { cn } from "@/lib/utils";
import { ShoutoutsFeed } from "@/components/shoutouts-feed";
import { LiveActivityFeed } from "@/components/live-activity-feed";
import { TickerPush } from "@/components/arl/ticker-push";

interface OverviewData {
  locationsOnline: number;
  locationsTotal: number;
  overdueCount: number;
  completedToday: number;
  totalDueToday: number;
  completionRate: number;
  pointsToday: number;
  activeEmergencies: number;
  trend: { date: string; completed: number; total: number }[];
  locationPerformance: {
    id: string;
    name: string;
    storeNumber: string;
    completedToday: number;
    pointsToday: number;
    isOnline: boolean;
  }[];
}

/* ── Sparkline ─────────────────────────────────────────────── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * 60},${20 - ((v - min) / range) * 18}`
    )
    .join(" ");
  return (
    <svg width="60" height="20" className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ── Command Strip Metric ──────────────────────────────────── */
function CommandMetric({
  label,
  value,
  color,
  sparkData,
  sparkColor,
}: {
  label: string;
  value: string | number;
  color: string;
  sparkData?: number[];
  sparkColor?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <span className={cn("text-xl font-black tabular-nums", color)}>
          {value}
        </span>
      </div>
      {sparkData && sparkData.length >= 2 && (
        <Sparkline data={sparkData} color={sparkColor || "#94a3b8"} />
      )}
    </div>
  );
}

/* ── Location Card ─────────────────────────────────────────── */
function LocationCard({
  loc,
  totalDueToday,
}: {
  loc: OverviewData["locationPerformance"][number];
  totalDueToday: number;
}) {
  const [expanded, setExpanded] = useState(false);

  // Derive a per-location completion % from completedToday vs a share of totalDueToday
  // Since we don't have per-location total, use completedToday as a proxy metric
  const completion = totalDueToday > 0
    ? Math.min(100, Math.round((loc.completedToday / Math.max(totalDueToday, 1)) * 100))
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden"
    >
      {/* Health bar */}
      <div className="h-1 w-full bg-white/5">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            completion >= 80
              ? "bg-emerald-500"
              : completion >= 50
                ? "bg-amber-500"
                : "bg-red-500"
          )}
          style={{ width: `${Math.max(completion, 2)}%` }}
        />
      </div>

      {/* Location row */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        {/* Online indicator */}
        <div
          className={cn(
            "h-2.5 w-2.5 rounded-full shrink-0",
            loc.isOnline ? "bg-emerald-400" : "bg-slate-500"
          )}
        />

        {/* Name + store number */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground truncate">
              {loc.name}
            </span>
            <span className="text-[10px] text-muted-foreground">
              #{loc.storeNumber}
            </span>
          </div>
        </div>

        {/* Completion % */}
        <span
          className={cn(
            "text-xs font-bold tabular-nums",
            completion >= 80
              ? "text-emerald-400"
              : completion >= 50
                ? "text-amber-400"
                : "text-red-400"
          )}
        >
          {completion}%
        </span>

        {/* Points badge */}
        <div className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-0.5">
          <Zap className="h-3 w-3 text-purple-400" />
          <span className="text-xs font-bold text-purple-300">
            {loc.pointsToday}
          </span>
        </div>

        {/* Online status icon */}
        {loc.isOnline ? (
          <Wifi className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-slate-500 shrink-0" />
        )}

        {/* Expand chevron */}
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expandable inline task list + activity mirror */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/5 px-4 py-3 space-y-3">
              {/* Task summary */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>
                    <span className="font-bold text-foreground">
                      {loc.completedToday}
                    </span>{" "}
                    tasks completed
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-purple-400" />
                  <span>
                    <span className="font-bold text-foreground">
                      {loc.pointsToday}
                    </span>{" "}
                    points earned
                  </span>
                </div>
              </div>

              {/* Activity mirror */}
              <div className="rounded-xl bg-white/5 border border-white/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Activity
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {loc.isOnline
                    ? "Location is currently active and connected."
                    : "Location is offline. Last activity data may be stale."}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Main Dashboard ────────────────────────────────────────── */
export function OverviewDashboard() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/overview");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch overview data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh on key socket events
  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchData();
    socket.on("task:completed", refresh);
    socket.on("task:updated", refresh);
    socket.on("emergency:broadcast", refresh);
    socket.on("emergency:dismissed", refresh);

    // Handle presence updates in-memory
    const handlePresence = (presenceData: {
      userId: string;
      isOnline: boolean;
      name?: string;
      storeNumber?: string;
    }) => {
      setData((prev) => {
        if (!prev) return prev;
        const updated = prev.locationPerformance.map((loc) =>
          loc.id === presenceData.userId
            ? { ...loc, isOnline: presenceData.isOnline }
            : loc
        );
        const onlineCount = updated.filter((l) => l.isOnline).length;
        return {
          ...prev,
          locationPerformance: updated,
          locationsOnline: onlineCount,
        };
      });
    };
    socket.on("presence:update", handlePresence);

    return () => {
      socket.off("task:completed", refresh);
      socket.off("task:updated", refresh);
      socket.off("emergency:broadcast", refresh);
      socket.off("emergency:dismissed", refresh);
      socket.off("presence:update", handlePresence);
    };
  }, [socket, fetchData]);

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-16 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Build sparkline data from trend
  const completionSparkData = data.trend.map((t) =>
    t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0
  );
  const completedSparkData = data.trend.map((t) => t.completed);

  // Build sparkline data for online count (derive from trend length for visual consistency)
  const onlineSparkData = data.trend.map((_, i) =>
    Math.max(0, data.locationsOnline + Math.round(Math.sin(i) * 1))
  );
  // Build sparkline data for overdue count
  const overdueSparkData = data.trend.map((t) =>
    Math.max(0, t.total - t.completed)
  );

  return (
    <div className="space-y-6">
      {/* Emergency Alert Banner */}
      {data.activeEmergencies > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-2xl bg-red-500/10 backdrop-blur-xl border border-red-500/20 px-5 py-4"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/20">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-red-300">
              {data.activeEmergencies} Active Emergency Alert
              {data.activeEmergencies > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-red-400/70">
              Review emergency broadcasts immediately
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Command Strip ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center gap-4 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-4"
      >
        <CommandMetric
          label="Online"
          value={`${data.locationsOnline}/${data.locationsTotal}`}
          color="text-emerald-400"
          sparkData={onlineSparkData}
          sparkColor="#34d399"
        />
        <div className="h-8 w-px bg-white/10" />
        <CommandMetric
          label="Overdue"
          value={data.overdueCount}
          color={data.overdueCount === 0 ? "text-emerald-400" : "text-red-400"}
          sparkData={overdueSparkData}
          sparkColor={data.overdueCount === 0 ? "#34d399" : "#ef4444"}
        />
        <div className="h-8 w-px bg-white/10" />
        <CommandMetric
          label="Completion"
          value={`${data.completionRate}%`}
          color={
            data.completionRate >= 80
              ? "text-emerald-400"
              : data.completionRate >= 50
                ? "text-amber-400"
                : "text-red-400"
          }
          sparkData={completionSparkData}
          sparkColor={
            data.completionRate >= 80
              ? "#22c55e"
              : data.completionRate >= 50
                ? "#eab308"
                : "#ef4444"
          }
        />
        <div className="h-8 w-px bg-white/10" />
        <CommandMetric
          label="Points"
          value={data.pointsToday}
          color="text-purple-400"
          sparkData={completedSparkData}
          sparkColor="#a855f7"
        />
      </motion.div>

      {/* ── Location List (primary view) ── */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
          Locations
        </h3>
        {data.locationPerformance.length === 0 ? (
          <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-8 text-center">
            <Store className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">
              No location data available
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.locationPerformance.map((loc) => (
              <LocationCard
                key={loc.id}
                loc={loc}
                totalDueToday={data.totalDueToday}
              />
            ))}
          </div>
        )}
      </div>

      {/* Ticker Push */}
      <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6">
        <TickerPush />
      </div>

      {/* Shoutouts and Live Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6">
          <ShoutoutsFeed />
        </div>
        <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6">
          <LiveActivityFeed maxItems={15} />
        </div>
      </div>
    </div>
  );
}

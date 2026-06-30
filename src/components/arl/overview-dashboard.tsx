"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Store,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Activity,
  ChevronRight,
} from "@/lib/icons";
import { useSocket } from "@/lib/socket-context";
import { cn } from "@/lib/utils";
import { LiveActivityFeed } from "@/components/live-activity-feed";
import { TickerPush } from "@/components/arl/ticker-push";
import { StatusDot } from "@/components/ui/status-dot";

interface OverviewData {
  locationsOnline: number;
  locationsTotal: number;
  overdueCount: number;
  completedToday: number;
  totalDueToday: number;
  completionRate: number;
  activeEmergencies: number;
  trend: { date: string; completed: number; total: number }[];
  locationPerformance: {
    id: string;
    name: string;
    storeNumber: string;
    completedToday: number;
    isOnline: boolean;
  }[];
}

function MiniSparkline({ data, color = "#ef4444", height = 32 }: { data: number[]; color?: string; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 120;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

  useEffect(() => { fetchData(); }, [fetchData]);

  // Refresh on key socket events (but NOT presence:update — that fires every
  // 30s per connected client and would cause excessive HTTP re-fetches.
  // Presence changes are handled inline below.)
  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchData();
    socket.on("task:completed", refresh);
    socket.on("task:updated", refresh);
    socket.on("emergency:broadcast", refresh);
    socket.on("emergency:dismissed", refresh);

    // Handle presence updates in-memory instead of re-fetching everything
    const handlePresence = (presenceData: { userId: string; isOnline: boolean; name?: string; storeNumber?: string }) => {
      setData((prev) => {
        if (!prev) return prev;
        const updated = prev.locationPerformance.map((loc) =>
          loc.id === presenceData.userId ? { ...loc, isOnline: presenceData.isOnline } : loc
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl border border-border bg-card animate-pulse" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-48 rounded-2xl border border-border bg-card animate-pulse" />
          <div className="h-48 rounded-2xl border border-border bg-card animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  // `severity` is the second hierarchy signal alongside color (Section 7 —
  // color alone isn't hierarchy): a card that represents a real problem
  // ("bad") gets a heavier border, not just a different hue, so it still
  // reads as more urgent with color removed from the screen entirely.
  const kpiCards = [
    {
      label: "Locations Online",
      value: `${data.locationsOnline}/${data.locationsTotal}`,
      subtext: data.locationsOnline === data.locationsTotal ? "All connected" : `${data.locationsTotal - data.locationsOnline} offline`,
      icon: Store,
      color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
      borderColor: data.locationsOnline === data.locationsTotal ? "border-emerald-200 dark:border-emerald-900" : "border-amber-200 dark:border-amber-900",
      severity: data.locationsOnline === data.locationsTotal ? "good" : "warn",
      sparkData: null,
    },
    {
      label: "Tasks Overdue",
      value: String(data.overdueCount),
      subtext: data.overdueCount === 0 ? "All on track!" : `Across all locations`,
      icon: data.overdueCount === 0 ? CheckCircle2 : AlertTriangle,
      color: data.overdueCount === 0 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
      borderColor: data.overdueCount === 0 ? "border-emerald-200 dark:border-emerald-900" : "border-red-200 dark:border-red-900",
      severity: data.overdueCount === 0 ? "good" : "bad",
      sparkData: null,
    },
    {
      label: "Completion Rate",
      value: `${data.completionRate}%`,
      subtext: `${data.completedToday} of ${data.totalDueToday} tasks done`,
      icon: TrendingUp,
      color: data.completionRate >= 80 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" : data.completionRate >= 50 ? "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400" : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
      borderColor: data.completionRate >= 80 ? "border-emerald-200 dark:border-emerald-900" : data.completionRate >= 50 ? "border-amber-200 dark:border-amber-900" : "border-red-200 dark:border-red-900",
      severity: data.completionRate >= 80 ? "good" : data.completionRate >= 50 ? "warn" : "bad",
      sparkData: data.trend.map(t => t.completed),
    },
  ] as const;

  return (
    <div className="flex flex-col gap-4 md:h-full md:min-h-0">
      {/* Emergency Alert Banner — rare, sits outside the fixed-height grid
          below so it doesn't eat into KPI/panel space when absent. */}
      {data.activeEmergencies > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="shrink-0 flex items-center gap-3 rounded-2xl border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/50 px-5 py-4"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              {data.activeEmergencies} Active Emergency Alert{data.activeEmergencies > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-red-600/70 dark:text-red-400/70">Review emergency broadcasts immediately</p>
          </div>
        </motion.div>
      )}

      {/* KPI Cards — fixed height, never grows past its content */}
      <div className="shrink-0 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpiCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut", delay: i * 0.05 }}
            className={cn("rounded-2xl bg-card p-5", card.severity === "bad" ? "border-2" : "border", card.borderColor)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">{card.label}</p>
                <p className="mt-2 text-2xl font-mono font-black text-foreground">{card.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.subtext}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", card.color)}>
                  <card.icon className="h-5 w-5" />
                </div>
                {card.sparkData && (
                  <MiniSparkline
                    data={card.sparkData}
                    color={data.completionRate >= 80 ? "#22c55e" : data.completionRate >= 50 ? "#eab308" : "#ef4444"}
                  />
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Remaining space — Location Performance + Live Feed each own an
          allocated region and scroll internally, so the page itself never
          scrolls on desktop (a real "look once" dashboard, not a stack of
          cards that happens to add up past one viewport). Mobile keeps
          natural stacking/scroll — there's not enough width for two
          columns to make sense there anyway. */}
      <div className="flex flex-col gap-4 md:flex-1 md:min-h-0 md:grid md:grid-cols-2">
        {/* Location Performance — the 7-Day Completion Trend chart that used
            to sit beside this was a second implementation of the same chart
            Analytics already owns (date-range controls, CSV export); Overview
            links to it instead of recomputing it (Section 11/18). */}
        <div className="flex flex-col md:min-h-0 rounded-2xl border border-border bg-card p-6 overflow-hidden">
          <div className="mb-4 flex items-center justify-between shrink-0">
            <h3 className="text-sm font-semibold text-foreground">Location Performance Today</h3>
            <Link
              href="/arl/analytics"
              className="flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors active:text-foreground"
            >
              View full analytics
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2 md:flex-1 md:min-h-0 md:overflow-y-auto">
            {data.locationPerformance.map((loc) => (
              <div key={loc.id} className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-2">
                <StatusDot color={loc.isOnline ? "emerald" : "muted"} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">{loc.name}</span>
                    <span className="text-xs text-muted-foreground">#{loc.storeNumber}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {loc.completedToday} tasks
                  </span>
                </div>
              </div>
            ))}
            {data.locationPerformance.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">No location data available</p>
            )}
          </div>
        </div>

        {/* Live Feed — ticker composer + live activity used to be two separate
            cards for what's the same underlying concept: the kiosk-facing
            ticker (GridTickerBar) already merges task completions and
            ARL-pushed messages into one stream, so the ARL-facing view
            shouldn't split what its own destination surface treats as one
            (Section 18). */}
        <div className="flex flex-col md:min-h-0 rounded-2xl border border-border bg-card p-6 overflow-hidden">
          <div className="mb-4 flex items-center gap-2 shrink-0">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Live Feed</h3>
          </div>
          <div className="shrink-0">
            <TickerPush showHeader={false} />
          </div>
          <div className="mt-4 border-t border-border pt-4 md:flex-1 md:min-h-0">
            <LiveActivityFeed maxItems={15} showHeader={false} />
          </div>
        </div>
      </div>
    </div>
  );
}

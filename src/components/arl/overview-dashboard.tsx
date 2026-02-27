"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Store,
  Users,
  MessageCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  TrendingUp,
  Wifi,
  WifiOff,
} from "lucide-react";
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

  // Refresh on key socket events
  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchData();
    socket.on("task:completed", refresh);
    socket.on("task:updated", refresh);
    socket.on("presence:update", refresh);
    socket.on("emergency:broadcast", refresh);
    socket.on("emergency:dismissed", refresh);
    return () => {
      socket.off("task:completed", refresh);
      socket.off("task:updated", refresh);
      socket.off("presence:update", refresh);
      socket.off("emergency:broadcast", refresh);
      socket.off("emergency:dismissed", refresh);
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

  const kpiCards = [
    {
      label: "Locations Online",
      value: `${data.locationsOnline}/${data.locationsTotal}`,
      subtext: data.locationsOnline === data.locationsTotal ? "All connected" : `${data.locationsTotal - data.locationsOnline} offline`,
      icon: Store,
      color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
      borderColor: data.locationsOnline === data.locationsTotal ? "border-emerald-200 dark:border-emerald-900" : "border-amber-200 dark:border-amber-900",
      sparkData: null,
    },
    {
      label: "Tasks Overdue",
      value: String(data.overdueCount),
      subtext: data.overdueCount === 0 ? "All on track!" : `Across all locations`,
      icon: data.overdueCount === 0 ? CheckCircle2 : AlertTriangle,
      color: data.overdueCount === 0 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
      borderColor: data.overdueCount === 0 ? "border-emerald-200 dark:border-emerald-900" : "border-red-200 dark:border-red-900",
      sparkData: null,
    },
    {
      label: "Completion Rate",
      value: `${data.completionRate}%`,
      subtext: `${data.completedToday} of ${data.totalDueToday} tasks done`,
      icon: TrendingUp,
      color: data.completionRate >= 80 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" : data.completionRate >= 50 ? "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400" : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
      borderColor: "border-border",
      sparkData: data.trend.map(t => t.completed),
    },
    {
      label: "Points Earned Today",
      value: String(data.pointsToday),
      subtext: "Across all locations",
      icon: Zap,
      color: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
      borderColor: "border-border",
      sparkData: null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Emergency Alert Banner */}
      {data.activeEmergencies > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-2xl border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/50 px-5 py-4"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-red-700 dark:text-red-300">
              {data.activeEmergencies} Active Emergency Alert{data.activeEmergencies > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-red-600/70 dark:text-red-400/70">Review emergency broadcasts immediately</p>
          </div>
        </motion.div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn("rounded-2xl border bg-card p-5 shadow-sm", card.borderColor)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                <p className="mt-1.5 text-3xl font-black text-foreground tabular-nums">{card.value}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{card.subtext}</p>
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

      {/* Location Performance + 7-Day Trend */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Location Performance */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-4">Location Performance Today</h3>
          <div className="space-y-2.5">
            {data.locationPerformance.slice(0, 8).map((loc) => (
              <div key={loc.id} className="flex items-center gap-3 rounded-xl bg-muted/50 px-3.5 py-2.5">
                <div className={cn("h-2 w-2 rounded-full shrink-0", loc.isOnline ? "bg-emerald-400" : "bg-slate-300")} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{loc.name}</span>
                    <span className="text-[10px] text-muted-foreground">#{loc.storeNumber}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {loc.completedToday} tasks
                  </span>
                  <div className="flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950 px-2 py-0.5">
                    <Zap className="h-3 w-3 text-amber-500" />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300">{loc.pointsToday}</span>
                  </div>
                </div>
              </div>
            ))}
            {data.locationPerformance.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">No location data available</p>
            )}
          </div>
        </div>

        {/* 7-Day Completion Trend */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-4">7-Day Completion Trend</h3>
          <div className="flex items-end gap-2 h-32">
            {data.trend.map((day, i) => {
              const maxCompleted = Math.max(...data.trend.map(d => d.completed), 1);
              const barHeight = (day.completed / maxCompleted) * 100;
              const dayLabel = new Date(day.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
              const isToday = i === data.trend.length - 1;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-foreground tabular-nums">{day.completed}</span>
                  <div className="w-full max-w-[32px] rounded-t-lg relative" style={{ height: "80px" }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(barHeight, 4)}%` }}
                      transition={{ delay: i * 0.05, duration: 0.4 }}
                      className={cn(
                        "absolute bottom-0 left-0 right-0 rounded-t-lg",
                        isToday ? "bg-[var(--hub-red)]" : "bg-[var(--hub-red)]/30"
                      )}
                    />
                  </div>
                  <span className={cn("text-[10px]", isToday ? "font-bold text-foreground" : "text-muted-foreground")}>{dayLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ticker Push */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <TickerPush />
      </div>

      {/* Shoutouts and Live Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <ShoutoutsFeed />
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <LiveActivityFeed maxItems={15} />
        </div>
      </div>
    </div>
  );
}

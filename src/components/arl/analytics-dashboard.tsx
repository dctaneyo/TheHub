"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart,
} from "recharts";
import {
  TrendingUp, TrendingDown, CheckCircle2, MessageCircle, Trophy,
  Calendar, Download, RefreshCw, Filter, ChevronDown, Users, Zap, Target,
  Clock, Star, Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";

type DateRange = "7d" | "30d" | "90d" | "thisMonth" | "lastMonth" | "custom";

interface TaskAnalytics {
  completionsByDate: Array<{ date: string; count: number; totalPoints: number; bonusPoints: number }>;
  topLocations: Array<{ locationId: string; locationName: string; completions: number; totalPoints: number }>;
  timeOfDayPattern: Array<{ hour: number; count: number }>;
  taskPerformance: Array<{ taskId: string; taskTitle: string; completions: number; uniqueLocations: number; avgPoints: number }>;
  summary: { totalCompletions: number; totalPoints: number; totalBonusPoints: number; activeLocations: number; uniqueTasks: number };
}

interface MessagingAnalytics {
  messagesByDate: Array<{ date: string; count: number; uniqueSenders: number }>;
  topSenders: Array<{ senderId: string; senderType: string; senderName: string; messageCount: number }>;
  hourlyPattern: Array<{ hour: number; count: number }>;
  summary: { totalMessages: number; uniqueSenders: number; activeConversations: number };
}

interface GamificationAnalytics {
  leaderboard: Array<{ locationId: string; locationName: string; totalPoints: number; completions: number }>;
  achievementTrends: Array<{ date: string; count: number }>;
  popularAchievements: Array<{ achievement_id: string; count: number }>;
  locationSummary: Array<{ locationId: string; locationName: string; achievementCount: number }>;
}

const CHART_COLORS = ["#dc2626", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

function StatCard({ label, value, icon: Icon, trend, trendLabel, color = "red" }: {
  label: string; value: string | number; icon: any; trend?: number; trendLabel?: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    red: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    green: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
    yellow: "bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400",
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", colorMap[color])}>
          <Icon className="h-5 w-5" />
        </div>
        {trend !== undefined && (
          <div className={cn("flex items-center gap-1 text-xs font-medium", trend >= 0 ? "text-green-600" : "text-red-500")}>
            {trend >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-foreground">{typeof value === "number" ? value.toLocaleString() : value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      {trendLabel && <p className="mt-1 text-[10px] text-muted-foreground">{trendLabel}</p>}
    </div>
  );
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

export function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<"tasks" | "messaging" | "gamification">("tasks");
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [loading, setLoading] = useState(true);
  const [taskData, setTaskData] = useState<TaskAnalytics | null>(null);
  const [msgData, setMsgData] = useState<MessagingAnalytics | null>(null);
  const [gamData, setGamData] = useState<GamificationAnalytics | null>(null);

  const dateParams = useMemo(() => {
    const now = new Date();
    let start: string, end: string;
    switch (dateRange) {
      case "7d": start = format(subDays(now, 7), "yyyy-MM-dd"); end = format(now, "yyyy-MM-dd"); break;
      case "30d": start = format(subDays(now, 30), "yyyy-MM-dd"); end = format(now, "yyyy-MM-dd"); break;
      case "90d": start = format(subDays(now, 90), "yyyy-MM-dd"); end = format(now, "yyyy-MM-dd"); break;
      case "thisMonth": start = format(startOfMonth(now), "yyyy-MM-dd"); end = format(endOfMonth(now), "yyyy-MM-dd"); break;
      case "lastMonth": {
        const lm = subMonths(now, 1);
        start = format(startOfMonth(lm), "yyyy-MM-dd"); end = format(endOfMonth(lm), "yyyy-MM-dd"); break;
      }
      default: start = format(subDays(now, 30), "yyyy-MM-dd"); end = format(now, "yyyy-MM-dd");
    }
    return `startDate=${start}&endDate=${end}`;
  }, [dateRange]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [taskRes, msgRes, gamRes] = await Promise.all([
        fetch(`/api/analytics/tasks?${dateParams}`),
        fetch(`/api/analytics/messaging?${dateParams}`),
        fetch(`/api/analytics/gamification?${dateParams}`),
      ]);
      if (taskRes.ok) setTaskData(await taskRes.json());
      if (msgRes.ok) setMsgData(await msgRes.json());
      if (gamRes.ok) setGamData(await gamRes.json());
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [dateParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const [showExportMenu, setShowExportMenu] = useState(false);

  const downloadCSV = useCallback((filename: string, rows: string[][]) => {
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportTaskCompletions = useCallback(() => {
    if (!taskData) return;
    const rows = [["Date", "Completions", "Total Points", "Bonus Points"]];
    taskData.completionsByDate.forEach(d => rows.push([d.date, String(d.count), String(d.totalPoints), String(d.bonusPoints)]));
    downloadCSV(`task-completions-${format(new Date(), "yyyy-MM-dd")}.csv`, rows);
    setShowExportMenu(false);
  }, [taskData, downloadCSV]);

  const exportTopLocations = useCallback(() => {
    if (!taskData) return;
    const rows = [["Location", "Completions", "Total Points"]];
    taskData.topLocations.forEach(l => rows.push([l.locationName, String(l.completions), String(l.totalPoints)]));
    downloadCSV(`top-locations-${format(new Date(), "yyyy-MM-dd")}.csv`, rows);
    setShowExportMenu(false);
  }, [taskData, downloadCSV]);

  const exportTaskPerformance = useCallback(() => {
    if (!taskData) return;
    const rows = [["Task", "Completions", "Locations", "Avg Points"]];
    taskData.taskPerformance.forEach(t => rows.push([t.taskTitle || "Unknown", String(t.completions), String(t.uniqueLocations), String(t.avgPoints)]));
    downloadCSV(`task-performance-${format(new Date(), "yyyy-MM-dd")}.csv`, rows);
    setShowExportMenu(false);
  }, [taskData, downloadCSV]);

  const exportMessages = useCallback(() => {
    if (!msgData) return;
    const rows = [["Date", "Messages", "Unique Senders"]];
    msgData.messagesByDate.forEach(d => rows.push([d.date, String(d.count), String(d.uniqueSenders)]));
    downloadCSV(`messaging-${format(new Date(), "yyyy-MM-dd")}.csv`, rows);
    setShowExportMenu(false);
  }, [msgData, downloadCSV]);

  const exportTopSenders = useCallback(() => {
    if (!msgData) return;
    const rows = [["Name", "Type", "Messages"]];
    msgData.topSenders.forEach(s => rows.push([s.senderName || "Unknown", s.senderType, String(s.messageCount)]));
    downloadCSV(`top-senders-${format(new Date(), "yyyy-MM-dd")}.csv`, rows);
    setShowExportMenu(false);
  }, [msgData, downloadCSV]);

  const exportLeaderboard = useCallback(() => {
    if (!gamData) return;
    const rows = [["Rank", "Location", "Total Points", "Completions"]];
    (gamData.leaderboard ?? []).forEach((l, i) => rows.push([String(i + 1), l.locationName || "Unknown", String(l.totalPoints ?? 0), String(l.completions)]));
    downloadCSV(`leaderboard-${format(new Date(), "yyyy-MM-dd")}.csv`, rows);
    setShowExportMenu(false);
  }, [gamData, downloadCSV]);

  const exportAllData = useCallback(() => {
    const sections: string[] = [];
    if (taskData) {
      sections.push("=== TASK COMPLETIONS BY DATE ===");
      sections.push(["Date", "Completions", "Total Points", "Bonus Points"].join(","));
      taskData.completionsByDate.forEach(d => sections.push([d.date, d.count, d.totalPoints, d.bonusPoints].join(",")));
      sections.push("");
      sections.push("=== TOP LOCATIONS ===");
      sections.push(["Location", "Completions", "Total Points"].join(","));
      taskData.topLocations.forEach(l => sections.push([`"${l.locationName}"`, l.completions, l.totalPoints].join(",")));
      sections.push("");
      sections.push("=== TASK PERFORMANCE ===");
      sections.push(["Task", "Completions", "Locations", "Avg Points"].join(","));
      taskData.taskPerformance.forEach(t => sections.push([`"${t.taskTitle || "Unknown"}"`, t.completions, t.uniqueLocations, t.avgPoints].join(",")));
    }
    if (msgData) {
      sections.push("");
      sections.push("=== MESSAGES BY DATE ===");
      sections.push(["Date", "Messages", "Unique Senders"].join(","));
      msgData.messagesByDate.forEach(d => sections.push([d.date, d.count, d.uniqueSenders].join(",")));
      sections.push("");
      sections.push("=== TOP SENDERS ===");
      sections.push(["Name", "Type", "Messages"].join(","));
      msgData.topSenders.forEach(s => sections.push([`"${s.senderName || "Unknown"}"`, s.senderType, s.messageCount].join(",")));
    }
    if (gamData) {
      sections.push("");
      sections.push("=== POINTS LEADERBOARD ===");
      sections.push(["Rank", "Location", "Total Points", "Completions"].join(","));
      (gamData.leaderboard ?? []).forEach((l, i) => sections.push([i + 1, `"${l.locationName || "Unknown"}"`, l.totalPoints ?? 0, l.completions].join(",")));
    }
    const blob = new Blob([sections.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `hub-analytics-full-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [taskData, msgData, gamData]);

  // Export options per tab
  const exportOptions = useMemo(() => {
    if (activeTab === "tasks") return [
      { label: "Completions by Date", action: exportTaskCompletions, enabled: !!taskData },
      { label: "Top Locations", action: exportTopLocations, enabled: !!taskData },
      { label: "Task Performance", action: exportTaskPerformance, enabled: !!taskData },
      { label: "Export All Data", action: exportAllData, enabled: !!(taskData || msgData || gamData) },
    ];
    if (activeTab === "messaging") return [
      { label: "Messages by Date", action: exportMessages, enabled: !!msgData },
      { label: "Top Senders", action: exportTopSenders, enabled: !!msgData },
      { label: "Export All Data", action: exportAllData, enabled: !!(taskData || msgData || gamData) },
    ];
    return [
      { label: "Points Leaderboard", action: exportLeaderboard, enabled: !!gamData },
      { label: "Export All Data", action: exportAllData, enabled: !!(taskData || msgData || gamData) },
    ];
  }, [activeTab, taskData, msgData, gamData, exportTaskCompletions, exportTopLocations, exportTaskPerformance, exportMessages, exportTopSenders, exportLeaderboard, exportAllData]);

  const tabs = [
    { id: "tasks" as const, label: "Tasks", icon: CheckCircle2 },
    { id: "messaging" as const, label: "Messaging", icon: MessageCircle },
    { id: "gamification" as const, label: "Gamification", icon: Trophy },
  ];

  const dateRanges: { id: DateRange; label: string }[] = [
    { id: "7d", label: "7 Days" },
    { id: "30d", label: "30 Days" },
    { id: "90d", label: "90 Days" },
    { id: "thisMonth", label: "This Month" },
    { id: "lastMonth", label: "Last Month" },
  ];

  // Format hourly data for full 24h display
  const formatHourlyData = (data: Array<{ hour: number; count: number }>) => {
    const full = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${i === 0 ? 12 : i > 12 ? i - 12 : i}${i < 12 ? "a" : "p"}`,
      count: 0,
    }));
    data.forEach(d => { if (full[d.hour]) full[d.hour].count = d.count; });
    return full;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Analytics Dashboard</h1>
          <p className="text-sm text-muted-foreground">Track performance across your locations</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground hover:bg-accent transition-colors">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
          </button>
          <div className="relative">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              className="flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground hover:bg-accent transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-10 z-20 min-w-48 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                {exportOptions.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={opt.action}
                    disabled={!opt.enabled}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar + Date range */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                activeTab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {dateRanges.map(d => (
            <button key={d.id} onClick={() => setDateRange(d.id)}
              className={cn("rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                dateRange === d.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
          <div className="col-span-2 h-72 animate-pulse rounded-2xl bg-muted lg:col-span-4" />
        </div>
      ) : (
        <>
          {/* ── TASKS TAB ── */}
          {activeTab === "tasks" && taskData && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <StatCard label="Total Completions" value={taskData.summary?.totalCompletions ?? 0} icon={CheckCircle2} color="green" />
                <StatCard label="Total Points" value={taskData.summary?.totalPoints ?? 0} icon={Zap} color="yellow" />
                <StatCard label="Bonus Points" value={taskData.summary?.totalBonusPoints ?? 0} icon={Star} color="orange" />
                <StatCard label="Active Locations" value={taskData.summary?.activeLocations ?? 0} icon={Users} color="blue" />
                <StatCard label="Unique Tasks" value={taskData.summary?.uniqueTasks ?? 0} icon={Target} color="purple" />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <ChartCard title="Completion Trends" className="lg:col-span-2">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={[...taskData.completionsByDate].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => { try { return format(new Date(v + "T00:00:00"), "MMM d"); } catch { return v; } }} />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid var(--border)", background: "var(--card)" }} />
                      <Area type="monotone" dataKey="count" stroke="#dc2626" fill="#dc262620" name="Completions" />
                      <Area type="monotone" dataKey="totalPoints" stroke="#22c55e" fill="#22c55e20" name="Points" />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Top Locations">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={taskData.topLocations.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis dataKey="locationName" type="category" width={100} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid var(--border)", background: "var(--card)" }} />
                      <Bar dataKey="completions" fill="#dc2626" radius={[0, 6, 6, 0]} name="Completions" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Activity by Hour">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={formatHourlyData(taskData.timeOfDayPattern)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid var(--border)", background: "var(--card)" }} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Completions" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <ChartCard title="Task Performance">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="pb-2 font-medium">Task</th>
                        <th className="pb-2 font-medium text-right">Completions</th>
                        <th className="pb-2 font-medium text-right">Locations</th>
                        <th className="pb-2 font-medium text-right">Avg Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taskData.taskPerformance.slice(0, 10).map((t, i) => (
                        <tr key={t.taskId ?? i} className="border-b border-border/50 last:border-0">
                          <td className="py-2.5 font-medium text-foreground">{t.taskTitle || "Unknown Task"}</td>
                          <td className="py-2.5 text-right text-muted-foreground">{t.completions}</td>
                          <td className="py-2.5 text-right text-muted-foreground">{t.uniqueLocations}</td>
                          <td className="py-2.5 text-right text-muted-foreground">{t.avgPoints}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
            </div>
          )}

          {/* ── MESSAGING TAB ── */}
          {activeTab === "messaging" && msgData && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <StatCard label="Total Messages" value={msgData.summary?.totalMessages ?? 0} icon={MessageCircle} color="blue" />
                <StatCard label="Unique Senders" value={msgData.summary?.uniqueSenders ?? 0} icon={Users} color="green" />
                <StatCard label="Active Conversations" value={msgData.summary?.activeConversations ?? 0} icon={Target} color="purple" />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <ChartCard title="Messages Over Time" className="lg:col-span-2">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={[...msgData.messagesByDate].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => { try { return format(new Date(v + "T00:00:00"), "MMM d"); } catch { return v; } }} />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid var(--border)", background: "var(--card)" }} />
                      <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f620" name="Messages" />
                      <Area type="monotone" dataKey="uniqueSenders" stroke="#8b5cf6" fill="#8b5cf620" name="Unique Senders" />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Top Senders">
                  <div className="space-y-2">
                    {msgData.topSenders.slice(0, 8).map((s, i) => (
                      <div key={s.senderId ?? i} className="flex items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{s.senderName || "Unknown"}</p>
                          <p className="text-[10px] capitalize text-muted-foreground">{s.senderType}</p>
                        </div>
                        <span className="text-sm font-semibold text-foreground">{s.messageCount}</span>
                      </div>
                    ))}
                  </div>
                </ChartCard>

                <ChartCard title="Peak Hours">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={formatHourlyData(msgData.hourlyPattern)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid var(--border)", background: "var(--card)" }} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Messages" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </div>
          )}

          {/* ── GAMIFICATION TAB ── */}
          {activeTab === "gamification" && gamData && (
            <div className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-2">
                <ChartCard title="Points Leaderboard">
                  <div className="space-y-2">
                    {(gamData.leaderboard ?? []).slice(0, 10).map((l, i) => (
                      <div key={l.locationId ?? i} className="flex items-center gap-3">
                        <span className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          i === 0 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                          i === 1 ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300" :
                          i === 2 ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{l.locationName || "Unknown"}</p>
                          <p className="text-[10px] text-muted-foreground">{l.completions} completions</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">{(l.totalPoints ?? 0).toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">pts</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ChartCard>

                <ChartCard title="Achievement Unlocks Over Time">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={[...(gamData.achievementTrends ?? [])].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => { try { return format(new Date(v + "T00:00:00"), "MMM d"); } catch { return v; } }} />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid var(--border)", background: "var(--card)" }} />
                      <Line type="monotone" dataKey="count" stroke="#eab308" strokeWidth={2} dot={false} name="Unlocks" />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Location Achievement Summary" className="lg:col-span-2">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={(gamData.locationSummary ?? []).slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="locationName" tick={{ fontSize: 10 }} className="fill-muted-foreground" angle={-30} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid var(--border)", background: "var(--card)" }} />
                      <Bar dataKey="achievementCount" fill="#a855f7" radius={[4, 4, 0, 0]} name="Achievements" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

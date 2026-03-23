"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ShiftSummaryData {
  completionDelta: number | null;
  fastestTask: { title: string; minutesEarly: number } | null;
  earlyCount: number;
  totalTasks: number;
  totalPoints: number;
  snippets: string[];
}

interface SmartSummaryProps {
  locationId?: string;
  date?: string;
  shiftPeriod?: "morning" | "afternoon" | "evening";
}

export function SmartSummary({ locationId, date, shiftPeriod }: SmartSummaryProps) {
  const [summary, setSummary] = useState<ShiftSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (locationId) params.set("locationId", locationId);
    if (date) params.set("date", date);
    if (shiftPeriod) params.set("shiftPeriod", shiftPeriod);

    setLoading(true);
    setError(false);

    fetch(`/api/analytics/shift-summary?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => setSummary(data.summary))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [locationId, date, shiftPeriod]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-4 animate-pulse">
        <div className="h-4 w-32 rounded bg-muted mb-3" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-3/4 rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (error || !summary || summary.snippets.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-border bg-card/90 backdrop-blur-sm p-4 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">✨</span>
        <h3 className="text-sm font-bold text-foreground">Shift Summary</h3>
        {summary.completionDelta !== null && summary.completionDelta > 0 && (
          <span className="ml-auto text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400 px-2 py-0.5 rounded-full">
            +{summary.completionDelta}%
          </span>
        )}
      </div>
      <AnimatePresence>
        <div className="space-y-1.5">
          {summary.snippets.map((snippet, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="text-xs text-muted-foreground leading-relaxed"
            >
              {snippet}
            </motion.p>
          ))}
        </div>
      </AnimatePresence>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{summary.totalTasks}</p>
          <p className="text-[10px] text-muted-foreground">Tasks</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-emerald-600">{summary.earlyCount}</p>
          <p className="text-[10px] text-muted-foreground">Early</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-amber-600">{summary.totalPoints}</p>
          <p className="text-[10px] text-muted-foreground">Points</p>
        </div>
      </div>
    </motion.div>
  );
}

/** Standalone panel for ARL analytics with location/date selectors */
export function SmartSummaryPanel() {
  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [shiftPeriod, setShiftPeriod] = useState<"morning" | "afternoon" | "evening">("morning");
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetch("/api/analytics/overview")
      .then((res) => res.json())
      .then((data) => {
        if (data.locations) setLocations(data.locations);
        else if (data.topLocations) {
          setLocations(data.topLocations.map((l: { locationId: string; locationName: string }) => ({
            id: l.locationId,
            name: l.locationName,
          })));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">Select location</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-1.5 text-sm text-foreground"
        />
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {(["morning", "afternoon", "evening"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setShiftPeriod(p)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all capitalize ${
                shiftPeriod === p
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      {locationId ? (
        <SmartSummary locationId={locationId} date={date} shiftPeriod={shiftPeriod} />
      ) : (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Select a location to view shift summary
        </p>
      )}
    </div>
  );
}

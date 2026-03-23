"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSocket } from "@/lib/socket-context";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Plus, Trophy, X, Target } from "@/lib/icons";

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  goalType: string;
  targetValue: number;
  startDate: string;
  endDate: string;
  status: string;
  winnerLocationId: string | null;
  participantCount: number;
  createdAt: string;
};

type LocationOption = { id: string; name: string; storeNumber: string };

const GOAL_TYPE_LABELS: Record<string, string> = {
  consecutive_perfect_days: "Consecutive Perfect Days",
  total_points: "Total Points",
  completion_rate: "Completion Rate",
  fastest_completion: "Fastest Completion",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function ChallengesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [locations, setLocations] = useState<LocationOption[]>([]);

  useEffect(() => {
    if (!authLoading && (!user || user.userType !== "arl")) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  const fetchChallenges = useCallback(async () => {
    try {
      const url = filter ? `/api/challenges?status=${filter}` : "/api/challenges";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) setChallenges(data.challenges);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (user?.userType === "arl") fetchChallenges();
  }, [user, fetchChallenges]);

  // Real-time: refresh challenges on progress updates
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchChallenges();
    socket.on("challenge:progress", handler);
    return () => { socket.off("challenge:progress", handler); };
  }, [socket, fetchChallenges]);

  // Fetch locations for the create form
  useEffect(() => {
    if (!showForm) return;
    fetch("/api/analytics/overview")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.locations) {
          setLocations(data.locations.map((l: any) => ({ id: l.id, name: l.name, storeNumber: l.storeNumber })));
        }
      })
      .catch(() => {});
  }, [showForm]);

  if (authLoading || !user || user.userType !== "arl") {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="h-6 w-6 text-[var(--hub-red)]" />
          <h1 className="text-2xl font-bold text-foreground">Challenges</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-[var(--hub-red)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
        >
          <Plus className="h-4 w-4" />
          Create Challenge
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {["", "active", "completed", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => { setFilter(s); setLoading(true); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === s
                ? "bg-[var(--hub-red)] text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {/* Challenge cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : challenges.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Trophy className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No challenges yet. Create one to get started!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {challenges.map((c) => (
            <ChallengeCard key={c.id} challenge={c} onUpdate={fetchChallenges} />
          ))}
        </div>
      )}

      {/* Create form modal */}
      <AnimatePresence>
        {showForm && (
          <CreateChallengeModal
            locations={locations}
            onClose={() => setShowForm(false)}
            onCreated={() => { setShowForm(false); fetchChallenges(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ChallengeCard({ challenge: c, onUpdate }: { challenge: Challenge; onUpdate: () => void }) {
  const [ending, setEnding] = useState(false);
  const daysLeft = Math.max(0, Math.ceil((new Date(c.endDate).getTime() - Date.now()) / 86400000));

  async function endChallenge(status: "completed" | "cancelled") {
    setEnding(true);
    try {
      await fetch(`/api/challenges/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      onUpdate();
    } catch {} finally {
      setEnding(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-5 space-y-3"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">{c.title}</h3>
          {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[c.status] || ""}`}>
          {c.status}
        </span>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>🎯 {GOAL_TYPE_LABELS[c.goalType] || c.goalType}</span>
        <span>Target: {c.targetValue}</span>
        <span>📍 {c.participantCount} locations</span>
        <span>{c.startDate} → {c.endDate}</span>
        {c.status === "active" && <span className="text-emerald-600 font-medium">{daysLeft}d left</span>}
      </div>

      {c.status === "active" && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => endChallenge("completed")}
            disabled={ending}
            className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-200 transition dark:bg-emerald-900/30 dark:text-emerald-400"
          >
            End & Pick Winner
          </button>
          <button
            onClick={() => endChallenge("cancelled")}
            disabled={ending}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 transition dark:bg-gray-800 dark:text-gray-400"
          >
            Cancel
          </button>
        </div>
      )}
    </motion.div>
  );
}

function CreateChallengeModal({
  locations,
  onClose,
  onCreated,
}: {
  locations: LocationOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goalType, setGoalType] = useState("total_points");
  const [targetValue, setTargetValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggleLocation(id: string) {
    setSelectedLocations((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title || !targetValue || !startDate || !endDate) {
      setError("Please fill in all required fields");
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      setError("End date must be after start date");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          goalType,
          targetValue: Number(targetValue),
          startDate,
          endDate,
          locationIds: selectedLocations.length ? selectedLocations : undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        onCreated();
      } else {
        setError(data.error?.message || "Failed to create challenge");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-card border border-border p-6 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground">Create Challenge</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hub-red)]/30"
              placeholder="e.g. Holiday Sprint Challenge"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--hub-red)]/30"
              placeholder="Optional description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Goal Type *</label>
              <select
                value={goalType}
                onChange={(e) => setGoalType(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hub-red)]/30"
              >
                {Object.entries(GOAL_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Target Value *</label>
              <input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hub-red)]/30"
                placeholder="e.g. 100"
                min={1}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hub-red)]/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">End Date *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hub-red)]/30"
              />
            </div>
          </div>

          {/* Location multi-select */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Participating Locations {selectedLocations.length > 0 ? `(${selectedLocations.length})` : "(all)"}
            </label>
            <div className="mt-1 max-h-32 overflow-y-auto rounded-xl border border-border bg-background p-2 space-y-1">
              {locations.length === 0 ? (
                <p className="text-xs text-muted-foreground p-1">Loading locations...</p>
              ) : (
                locations.map((loc) => (
                  <label key={loc.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={selectedLocations.includes(loc.id)}
                      onChange={() => toggleLocation(loc.id)}
                      className="rounded"
                    />
                    <span className="text-foreground">{loc.name}</span>
                    <span className="text-muted-foreground text-xs">#{loc.storeNumber}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[var(--hub-red)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Challenge"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSocket } from "@/lib/socket-context";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Plus, Heart, X } from "@/lib/icons";

type Pairing = {
  id: string;
  mentorLocationId: string;
  menteeLocationId: string;
  mentorName: string;
  mentorStoreNumber: string;
  menteeName: string;
  menteeStoreNumber: string;
  status: string;
  createdAt: string;
  endedAt: string | null;
};

type LocationOption = { id: string; name: string; storeNumber: string };

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  dissolved: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function MentorshipPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [pairs, setPairs] = useState<Pairing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [locations, setLocations] = useState<LocationOption[]>([]);

  useEffect(() => {
    if (!authLoading && (!user || user.userType !== "arl")) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  const fetchPairs = useCallback(async () => {
    try {
      const url = filter ? `/api/mentorship-pairs?status=${filter}` : "/api/mentorship-pairs";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) setPairs(data.pairs);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (user?.userType === "arl") fetchPairs();
  }, [user, fetchPairs]);

  // Real-time: refresh pairings on XP award events
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchPairs();
    socket.on("mentorship:xp-awarded", handler);
    return () => { socket.off("mentorship:xp-awarded", handler); };
  }, [socket, fetchPairs]);

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Heart className="h-6 w-6 text-[var(--hub-red)]" />
          <h1 className="text-2xl font-bold text-foreground">Mentorship</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-[var(--hub-red)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
        >
          <Plus className="h-4 w-4" />
          Create Pairing
        </button>
      </div>

      <div className="flex gap-2">
        {["", "active", "completed", "dissolved"].map((s) => (
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

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : pairs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Heart className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No mentorship pairings yet. Create one to get started!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {pairs.map((p) => (
            <PairingCard key={p.id} pairing={p} onUpdate={fetchPairs} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <CreatePairingModal
            locations={locations}
            onClose={() => setShowForm(false)}
            onCreated={() => { setShowForm(false); fetchPairs(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PairingCard({ pairing: p, onUpdate }: { pairing: Pairing; onUpdate: () => void }) {
  const [ending, setEnding] = useState(false);
  const daysPaired = Math.max(1, Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86400000));

  async function endPairing(status: "completed" | "dissolved") {
    setEnding(true);
    try {
      await fetch(`/api/mentorship-pairs/${p.id}`, {
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
        <div className="flex gap-4">
          <div className="text-center">
            <p className="text-[10px] uppercase text-muted-foreground font-medium">Mentor</p>
            <p className="text-sm font-bold text-foreground">{p.mentorName}</p>
            <p className="text-[10px] text-muted-foreground">#{p.mentorStoreNumber}</p>
          </div>
          <div className="flex items-center text-muted-foreground">→</div>
          <div className="text-center">
            <p className="text-[10px] uppercase text-muted-foreground font-medium">Mentee</p>
            <p className="text-sm font-bold text-foreground">{p.menteeName}</p>
            <p className="text-[10px] text-muted-foreground">#{p.menteeStoreNumber}</p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[p.status] || ""}`}>
          {p.status}
        </span>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>📅 {daysPaired} days paired</span>
        <span>Started {new Date(p.createdAt).toLocaleDateString()}</span>
        {p.endedAt && <span>Ended {new Date(p.endedAt).toLocaleDateString()}</span>}
      </div>

      {p.status === "active" && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => endPairing("completed")}
            disabled={ending}
            className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-200 transition dark:bg-emerald-900/30 dark:text-emerald-400"
          >
            Complete
          </button>
          <button
            onClick={() => endPairing("dissolved")}
            disabled={ending}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 transition dark:bg-gray-800 dark:text-gray-400"
          >
            Dissolve
          </button>
        </div>
      )}
    </motion.div>
  );
}

function CreatePairingModal({
  locations,
  onClose,
  onCreated,
}: {
  locations: LocationOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [mentorId, setMentorId] = useState("");
  const [menteeId, setMenteeId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!mentorId || !menteeId) {
      setError("Please select both mentor and mentee locations");
      return;
    }
    if (mentorId === menteeId) {
      setError("Mentor and mentee must be different locations");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/mentorship-pairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentorLocationId: mentorId, menteeLocationId: menteeId }),
      });
      const data = await res.json();
      if (data.ok) {
        onCreated();
      } else {
        setError(data.error?.message || "Failed to create pairing");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  // Sort locations by name for dropdowns
  const sorted = [...locations].sort((a, b) => a.name.localeCompare(b.name));

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
        className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground">Create Mentorship Pairing</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Mentor Location *</label>
            <select
              value={mentorId}
              onChange={(e) => setMentorId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hub-red)]/30"
            >
              <option value="">Select mentor...</option>
              {sorted.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} (#{loc.storeNumber})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Mentee Location *</label>
            <select
              value={menteeId}
              onChange={(e) => setMenteeId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hub-red)]/30"
            >
              <option value="">Select mentee...</option>
              {sorted.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} (#{loc.storeNumber})
                </option>
              ))}
            </select>
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
              {submitting ? "Creating..." : "Create Pairing"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

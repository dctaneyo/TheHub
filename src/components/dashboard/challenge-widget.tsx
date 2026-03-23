"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useSocket } from "@/lib/socket-context";
import { Trophy, Target, ChevronDown, ChevronUp } from "@/lib/icons";

type LeaderboardEntry = {
  locationId: string;
  locationName: string;
  storeNumber: string;
  totalProgress: number;
  rank: number;
};

type ChallengeData = {
  id: string;
  title: string;
  description: string | null;
  goalType: string;
  targetValue: number;
  startDate: string;
  endDate: string;
  status: string;
  winnerLocationId: string | null;
};

export function ChallengeWidget() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [showTrophy, setShowTrophy] = useState(false);
  const [loading, setLoading] = useState(true);

  const locationId = user?.id;

  const fetchActiveChallenge = useCallback(async () => {
    try {
      const res = await fetch("/api/challenges?status=active");
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok || !data.challenges?.length) {
        setChallenge(null);
        setLoading(false);
        return;
      }
      // Pick the first active challenge
      const c = data.challenges[0];
      setChallenge(c);

      // Fetch leaderboard
      const detailRes = await fetch(`/api/challenges/${c.id}`);
      if (detailRes.ok) {
        const detail = await detailRes.json();
        if (detail.ok) setLeaderboard(detail.leaderboard);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveChallenge();
  }, [fetchActiveChallenge]);

  // Listen for real-time progress updates
  useEffect(() => {
    if (!socket || !challenge) return;

    function handleProgress(data: { challengeId: string; locationId: string; progressValue: number; rank: number }) {
      if (data.challengeId !== challenge?.id) return;
      // Refresh leaderboard
      fetch(`/api/challenges/${challenge.id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setLeaderboard(d.leaderboard);
        })
        .catch(() => {});
    }

    socket.on("challenge:progress", handleProgress);
    return () => { socket.off("challenge:progress", handleProgress); };
  }, [socket, challenge]);

  // Check for trophy badge in sessionStorage
  useEffect(() => {
    const trophyData = sessionStorage.getItem("hub-challenge-trophy");
    if (trophyData) {
      try {
        const { expiry } = JSON.parse(trophyData);
        if (Date.now() < expiry) {
          setShowTrophy(true);
        } else {
          sessionStorage.removeItem("hub-challenge-trophy");
        }
      } catch {
        sessionStorage.removeItem("hub-challenge-trophy");
      }
    }
  }, []);

  if (loading || !challenge) return null;

  const myEntry = leaderboard.find((e) => e.locationId === locationId);
  const myRank = myEntry?.rank ?? 0;
  const myProgress = myEntry?.totalProgress ?? 0;
  const progressPct = Math.min(100, (myProgress / challenge.targetValue) * 100);
  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.endDate).getTime() - Date.now()) / 86400000));

  return (
    <>
      <motion.div
        layout
        className="rounded-2xl border border-border bg-card p-4 space-y-3"
      >
        {/* Compact view */}
        <button
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Collapse challenge leaderboard" : "Expand challenge leaderboard"}
          aria-expanded={expanded}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <Target className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{challenge.title}</p>
              <p className="text-[10px] text-muted-foreground">
                {myRank > 0 ? `#${myRank} of ${leaderboard.length}` : `${leaderboard.length} locations`}
                {" · "}
                {daysLeft}d left
              </p>
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Progress bar */}
        {myRank > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{myProgress} / {challenge.targetValue}</span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>
        )}

        {/* Expanded leaderboard */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-1.5 pt-2 border-t border-border">
                {leaderboard.map((entry) => {
                  const isMe = entry.locationId === locationId;
                  const pct = Math.min(100, (entry.totalProgress / challenge.targetValue) * 100);
                  return (
                    <div
                      key={entry.locationId}
                      className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs ${
                        isMe
                          ? "bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-800"
                          : ""
                      }`}
                    >
                      <span className="w-5 text-center font-bold text-muted-foreground">
                        {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
                      </span>
                      <span className="flex-1 font-medium text-foreground truncate">
                        {entry.locationName}
                      </span>
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-muted-foreground">{entry.totalProgress}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Trophy badge for header (24h) */}
      {showTrophy && <TrophyBadge />}
    </>
  );
}

function TrophyBadge() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="fixed top-3 right-16 z-50"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 shadow-lg ring-2 ring-amber-300 dark:bg-amber-900/40 dark:ring-amber-700">
        <span className="text-sm">🏆</span>
      </div>
    </motion.div>
  );
}

// Trophy animation overlay — call this when a location wins
export function TrophyOverlay({ challengeTitle, onDone }: { challengeTitle: string; onDone: () => void }) {
  useEffect(() => {
    // Store trophy badge with 24h expiry
    sessionStorage.setItem(
      "hub-challenge-trophy",
      JSON.stringify({ expiry: Date.now() + 24 * 60 * 60 * 1000 })
    );

    const timer = setTimeout(onDone, 5000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      {/* Confetti particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-2 w-2 rounded-full"
          style={{
            backgroundColor: ["#f59e0b", "#ef4444", "#3b82f6", "#10b981", "#8b5cf6"][i % 5],
            left: `${10 + Math.random() * 80}%`,
            top: "-5%",
          }}
          animate={{
            y: ["0vh", `${60 + Math.random() * 40}vh`],
            x: [0, (Math.random() - 0.5) * 200],
            rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
            opacity: [1, 0],
          }}
          transition={{
            duration: 2 + Math.random() * 2,
            delay: Math.random() * 1.5,
            ease: "easeOut",
          }}
        />
      ))}

      {/* Trophy */}
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.3 }}
        className="text-8xl mb-6"
      >
        🏆
      </motion.div>

      {/* Text */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="text-4xl font-black text-white mb-2"
      >
        CHAMPIONS!
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="text-lg text-white/80 font-medium"
      >
        {challengeTitle}
      </motion.p>
    </motion.div>
  );
}

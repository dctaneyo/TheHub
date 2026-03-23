"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useSocket } from "@/lib/socket-context";
import { Heart, TrendingUp } from "@/lib/icons";

type PairingDetail = {
  id: string;
  mentorLocationId: string;
  menteeLocationId: string;
  mentorName: string;
  menteeName: string;
  status: string;
  daysPaired: number;
  improvement: number;
  bonusXP: number;
};

export function MentorshipWidget() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [pairing, setPairing] = useState<PairingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMentor, setIsMentor] = useState(false);

  const locationId = user?.id;

  const fetchPairing = useCallback(async () => {
    try {
      const res = await fetch("/api/mentorship-pairs?status=active");
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok || !data.pairs?.length) {
        setPairing(null);
        setLoading(false);
        return;
      }

      // Find pairing where this location is mentor or mentee
      const myPair = data.pairs.find(
        (p: any) => p.mentorLocationId === locationId || p.menteeLocationId === locationId
      );
      if (!myPair) {
        setPairing(null);
        setLoading(false);
        return;
      }

      setIsMentor(myPair.mentorLocationId === locationId);

      // Fetch detail with stats
      const detailRes = await fetch(`/api/mentorship-pairs/${myPair.id}`);
      if (detailRes.ok) {
        const detail = await detailRes.json();
        if (detail.ok) setPairing(detail.pair);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (locationId) fetchPairing();
  }, [locationId, fetchPairing]);

  // Listen for XP award events
  useEffect(() => {
    if (!socket || !pairing) return;

    function handleXpAwarded() {
      fetchPairing();
    }

    socket.on("mentorship:xp-awarded", handleXpAwarded);
    return () => { socket.off("mentorship:xp-awarded", handleXpAwarded); };
  }, [socket, pairing, fetchPairing]);

  if (loading || !pairing) return null;

  const partnerName = isMentor ? pairing.menteeName : pairing.mentorName;
  const roleLabel = isMentor ? "Mentoring" : "Mentor";
  const improvementLabel = isMentor ? "Mentee improvement" : "Your improvement";
  const improvementColor = pairing.improvement >= 10
    ? "text-emerald-600"
    : pairing.improvement > 0
    ? "text-amber-600"
    : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-4 space-y-2"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-100 dark:bg-pink-900/30">
          <Heart className="h-4 w-4 text-pink-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">
            {roleLabel}: {partnerName}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {pairing.daysPaired} days paired
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{improvementLabel}:</span>
          <span className={`font-bold ${improvementColor}`}>
            {pairing.improvement > 0 ? "+" : ""}{pairing.improvement}%
          </span>
        </div>
        {isMentor && pairing.bonusXP > 0 && (
          <span className="text-[10px] font-medium text-emerald-600">
            +{pairing.bonusXP} XP
          </span>
        )}
      </div>
    </motion.div>
  );
}

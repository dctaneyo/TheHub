"use client";

import { Leaderboard } from "@/components/dashboard/leaderboard";

export default function LeaderboardPage() {
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain p-4">
      <Leaderboard />
    </div>
  );
}

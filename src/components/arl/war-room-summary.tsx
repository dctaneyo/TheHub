"use client";

import { motion } from "framer-motion";
import { Activity, AlertCircle, Wifi, WifiOff } from "@/lib/icons";

export interface WarRoomLocation {
  id: string;
  name: string;
  storeNumber: string;
  healthScore: number;
  taskCompletionPct: number;
  moodScore: number | null;
  isOnline: boolean;
  latitude: number | null;
  longitude: number | null;
  alertCount: number;
}

interface WarRoomSummaryProps {
  locations: WarRoomLocation[];
}

export function WarRoomSummary({ locations }: WarRoomSummaryProps) {
  const online = locations.filter((l) => l.isOnline).length;
  const offline = locations.length - online;
  const avgHealth =
    locations.length > 0
      ? Math.round(locations.reduce((s, l) => s + l.healthScore, 0) / locations.length)
      : 0;
  const critical = locations.filter((l) => l.healthScore < 40).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 rounded-2xl border border-border bg-card/90 backdrop-blur-md px-5 py-3 text-sm font-medium shadow-lg"
    >
      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
        <Wifi className="h-3.5 w-3.5" />
        {online} online
      </span>
      <span className="text-muted-foreground">·</span>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <WifiOff className="h-3.5 w-3.5" />
        {offline} offline
      </span>
      <span className="text-muted-foreground">·</span>
      <span className="flex items-center gap-1.5">
        <Activity className="h-3.5 w-3.5 text-blue-500" />
        Avg Health: {avgHealth}%
      </span>
      {critical > 0 && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
            <AlertCircle className="h-3.5 w-3.5" />
            {critical} critical
          </span>
        </>
      )}
    </motion.div>
  );
}

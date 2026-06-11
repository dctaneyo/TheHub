"use client";

import { motion } from "framer-motion";
import { Trophy, CheckCircle2, Clock, AlertTriangle } from "@/lib/icons";

interface StatsWidgetProps {
  completed: number;
  total: number;
  points: number;
  missed: number;
}

export function StatsWidget({ completed, total, points, missed }: StatsWidgetProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const cards = [
    {
      icon: CheckCircle2,
      label: "Completed",
      value: `${completed}/${total}`,
      tint: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      icon: Trophy,
      label: "Points today",
      value: String(points),
      tint: "text-yellow-500",
      bg: "bg-yellow-500/10",
    },
    {
      icon: Clock,
      label: "Progress",
      value: `${pct}%`,
      tint: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      icon: AlertTriangle,
      label: "Missed",
      value: String(missed),
      tint: "text-red-500",
      bg: "bg-red-500/10",
    },
  ];

  return (
    <div className="grid h-full grid-cols-2 gap-2 p-3 sm:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2"
        >
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.bg}`}>
            <c.icon className={`h-5 w-5 ${c.tint}`} />
          </div>
          <div className="min-w-0">
            <motion.p
              key={c.value}
              initial={{ scale: 1.15 }}
              animate={{ scale: 1 }}
              className="text-lg font-bold leading-none text-foreground"
            >
              {c.value}
            </motion.p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{c.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

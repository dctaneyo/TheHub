"use client";

import { motion } from "framer-motion";
import { 
  Trophy, 
  CheckCircle2, 
  XCircle, 
  TrendingUp,
  Clock,
  Target
} from "@/lib/icons";
import { cn } from "@/lib/utils";

interface StatsWidgetProps {
  completedTasks: number;
  totalTasks: number;
  pointsToday: number;
  missedTasks: number;
  loading?: boolean;
  compact?: boolean;
}

export function StatsWidget({ 
  completedTasks, 
  totalTasks, 
  pointsToday, 
  missedTasks, 
  loading = false,
  compact = false 
}: StatsWidgetProps) {
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const circumference = 2 * Math.PI * 36;
  const strokeDash = (completionRate / 100) * circumference;

  if (compact) {
    return (
      <div className="flex items-center justify-between h-full p-3">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0">
            <svg className="h-10 w-10 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted" />
              <motion.circle
                cx="40" cy="40" r="36" fill="none" strokeWidth="4" strokeLinecap="round"
                className="text-primary"
                stroke="currentColor"
                initial={{ strokeDasharray: `0 ${circumference}` }}
                animate={{ strokeDasharray: `${strokeDash} ${circumference - strokeDash}` }}
                transition={{ duration: 1 }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold">{completionRate}%</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">{completedTasks}/{totalTasks}</p>
            <p className="text-[10px] text-muted-foreground">tasks done</p>
          </div>
        </div>
        <div className="text-right">
          <motion.div 
            key={pointsToday} 
            initial={{ scale: 1.2 }} 
            animate={{ scale: 1 }} 
            className="flex items-center gap-1"
          >
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-bold text-foreground">{pointsToday}</span>
          </motion.div>
          <p className="text-[10px] text-muted-foreground">points</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-4">
      <div className="grid grid-cols-2 gap-4 h-full">
        {/* Progress Card */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative h-16 w-16 mb-2">
            <svg className="h-16 w-16 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="5" className="text-muted" />
              <motion.circle
                cx="40" cy="40" r="36" fill="none" strokeWidth="5" strokeLinecap="round"
                className="text-primary"
                stroke="currentColor"
                initial={{ strokeDasharray: `0 ${circumference}` }}
                animate={{ strokeDasharray: `${strokeDash} ${circumference - strokeDash}` }}
                transition={{ duration: 1 }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-foreground">{completionRate}%</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">{completedTasks}/{totalTasks}</p>
            <p className="text-xs text-muted-foreground">tasks done</p>
          </div>
        </div>

        {/* Points Card */}
        <div className="flex flex-col items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 mb-2">
            <Trophy className="h-8 w-8 text-white" />
          </div>
          <div className="text-center">
            <motion.p 
              key={pointsToday} 
              initial={{ scale: 1.3 }} 
              animate={{ scale: 1 }} 
              className="text-lg font-bold text-foreground"
            >
              {pointsToday}
            </motion.p>
            <p className="text-xs text-muted-foreground">points today</p>
          </div>
        </div>

        {/* Status Card */}
        <div className="flex flex-col items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-2">
            {completionRate === 100 ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            ) : missedTasks > 0 ? (
              <XCircle className="h-8 w-8 text-red-500" />
            ) : (
              <Clock className="h-8 w-8 text-blue-500" />
            )}
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">
              {completionRate === 100 ? 'All Done!' : missedTasks > 0 ? `${missedTasks} missed` : 'On Track'}
            </p>
            <p className="text-xs text-muted-foreground">status</p>
          </div>
        </div>

        {/* Performance Card */}
        <div className="flex flex-col items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-2">
            <TrendingUp className="h-8 w-8 text-purple-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">
              {pointsToday > 0 ? 'Great!' : 'Keep Going!'}
            </p>
            <p className="text-xs text-muted-foreground">performance</p>
          </div>
        </div>
      </div>
    </div>
  );
}
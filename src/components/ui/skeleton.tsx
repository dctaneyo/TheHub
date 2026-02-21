"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "default" | "card" | "list" | "text" | "avatar";
  lines?: number;
}

export function Skeleton({ className, variant = "default", lines = 1 }: SkeletonProps) {
  const variants = {
    default: "h-4 w-full rounded",
    card: "h-24 w-full rounded-xl",
    list: "h-12 w-full rounded-lg",
    text: "h-3 w-full rounded",
    avatar: "h-10 w-10 rounded-full",
  };

  const baseClass = cn(
    "bg-slate-200 overflow-hidden",
    variants[variant],
    className
  );

  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <motion.div
          key={i}
          className={baseClass}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.1 }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity, 
              ease: "easeInOut", 
              delay: i * 0.2 
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}

// Predefined skeleton layouts
export function TaskSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton variant="avatar" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="w-3/4" />
        <Skeleton variant="text" className="w-1/2" />
      </div>
      <Skeleton variant="text" className="w-16" />
    </div>
  );
}

export function MessageSkeleton() {
  return (
    <div className="flex gap-3 p-3">
      <Skeleton variant="avatar" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="w-1/4" />
        <Skeleton variant="text" />
        <Skeleton variant="text" className="w-2/3" />
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton variant="text" className="w-1/3" />
      <Skeleton variant="text" lines={3} />
      <div className="flex justify-between">
        <Skeleton variant="text" className="w-20" />
        <Skeleton variant="text" className="w-16" />
      </div>
    </div>
  );
}

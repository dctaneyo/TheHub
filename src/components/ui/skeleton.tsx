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
    "bg-muted overflow-hidden",
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
            className="h-full bg-gradient-to-r from-muted via-muted-foreground/10 to-muted"
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

export function ConversationListSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton variant="text" className="h-5 w-24" />
          <Skeleton variant="text" className="h-3 w-16" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16 rounded-xl" />
          <Skeleton className="h-8 w-16 rounded-xl" />
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl p-2">
          <Skeleton variant="avatar" className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <Skeleton variant="text" className="h-3.5 w-2/5" />
            <Skeleton variant="text" className="h-3 w-3/4" />
          </div>
          <Skeleton variant="text" className="h-3 w-10" />
        </div>
      ))}
    </div>
  );
}

export function TaskListSkeleton() {
  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton variant="text" className="h-5 w-40" />
          <Skeleton variant="text" className="h-3 w-20" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28 rounded-xl" />
          <Skeleton className="h-8 w-24 rounded-xl" />
          <Skeleton className="h-8 w-20 rounded-xl" />
        </div>
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton variant="text" className="h-4 w-1/3" />
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-5 w-10 rounded-full" />
            </div>
            <Skeleton variant="text" className="h-3 w-2/3" />
            <div className="flex gap-3">
              <Skeleton variant="text" className="h-3 w-16" />
              <Skeleton variant="text" className="h-3 w-12" />
              <Skeleton variant="text" className="h-3 w-20" />
            </div>
          </div>
          <div className="flex gap-1">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

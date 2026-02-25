"use client";

import { Loader2, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  refreshing: boolean;
  isPullingEnough: boolean;
}

export function PullToRefreshIndicator({ pullDistance, refreshing, isPullingEnough }: PullToRefreshIndicatorProps) {
  if (pullDistance <= 0 && !refreshing) return null;

  return (
    <div
      className="flex items-center justify-center overflow-hidden transition-all duration-200"
      style={{ height: `${pullDistance}px` }}
    >
      <div className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full transition-all",
        isPullingEnough || refreshing ? "bg-primary text-primary-foreground scale-100" : "bg-muted text-muted-foreground scale-75"
      )}>
        {refreshing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowDown className={cn("h-4 w-4 transition-transform", isPullingEnough && "rotate-180")} />
        )}
      </div>
    </div>
  );
}

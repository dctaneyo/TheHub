import { cn } from "@/lib/utils";

// One canonical status-dot size (h-2 w-2 — the size already dominant
// across the console) and color set, so it stops drifting per file
// (DESIGN.md §15 — found at h-1.5/h-2/h-2.5 across messaging.tsx,
// locations-manager.tsx, emergency-broadcast.tsx, and others). Pairs with
// a plain-weight label per Section 10 — this is the dot, not the label.

const COLORS = {
  emerald: "bg-emerald-400",
  red: "bg-red-500",
  amber: "bg-amber-400",
  muted: "bg-muted-foreground",
  // The org's branding color (tenant-context.tsx), not the fixed semantic
  // red — used for "this is live/active" indicators tied to the brand
  // identity rather than a generic urgent/offline status.
  brand: "bg-[var(--hub-red)]",
} as const;

export function StatusDot({
  color,
  pulse = false,
  className,
}: {
  color: keyof typeof COLORS;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("h-2 w-2 shrink-0 rounded-full", COLORS[color], pulse && "animate-pulse", className)}
    />
  );
}

"use client";

import { cn } from "@/lib/utils";
import { IconTip } from "@/components/ui/icon-tip";

// The icon-only delete/destroy button (no visible text label) had drifted
// to a different size and red shade per file (ticker-push.tsx was h-7 w-7
// bg-red-50, forms-repository.tsx was h-7/h-8 bg-red-500/10) — one
// canonical size and color here. swipeable-convo-row.tsx's delete button
// is a deliberate exception, not consolidated here: it's smaller and uses
// a group-hover reveal mechanism specific to that row's cramped layout.

export function DestructiveIconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <IconTip label={label}>
      <button
        onClick={onClick}
        disabled={disabled}
        title={label}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground active:bg-red-500/10 active:text-red-600 dark:active:text-red-400 transition-colors disabled:opacity-50",
          className
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
    </IconTip>
  );
}

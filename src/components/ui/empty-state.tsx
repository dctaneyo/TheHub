import { cn } from "@/lib/utils";

// The "nothing here yet" block had drifted per file: icon size (h-8 vs
// h-10), text size (text-xs vs text-sm for the same job), and container
// treatment (plain centered box vs dashed border vs bare paragraph) across
// messaging.tsx, forms-repository.tsx, scheduled-meetings.tsx,
// remote-viewer.tsx, user-management.tsx, and others. One shape here:
// icon (optional) + title + optional subtext, centered, with an optional
// dashed-border treatment for the cases that used one.

export function EmptyState({
  icon: Icon,
  title,
  subtext,
  bordered = false,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  subtext?: string;
  bordered?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-10 text-center",
        bordered && "rounded-2xl border border-dashed border-border",
        className
      )}
    >
      {Icon && <Icon className="h-8 w-8 text-muted-foreground" />}
      <p className={cn("text-sm text-muted-foreground", Icon && "mt-2")}>{title}</p>
      {subtext && <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>}
    </div>
  );
}

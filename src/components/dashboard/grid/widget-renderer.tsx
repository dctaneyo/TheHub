"use client";

import { memo } from "react";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { CompletedMissed } from "@/components/dashboard/completed-missed";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { MessageCircle, FileText } from "@/lib/icons";
import { StatsWidget } from "./stats-widget";
import { GridTasksWidget } from "./grid-tasks";
import type { Widget } from "./grid-engine";
import type { WidgetData } from "./widget-data";

/** Full-bleed launcher tile for components that open as their own overlay. */
function LauncherTile({
  icon: Icon,
  label,
  hint,
  badge,
  onClick,
}: {
  icon: typeof MessageCircle;
  label: string;
  hint: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center transition-colors hover:bg-muted/40"
    >
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
        <Icon className="h-6 w-6 text-primary" />
        {badge != null && badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </button>
  );
}

// Memoized so that re-rendering the grid during drag/resize (which changes the
// grid context value) does NOT re-render the heavy widget bodies of widgets
// that didn't actually change. `widget` objects keep a stable reference for
// untouched widgets, and `data` is stable during in-grid interactions.
export const WidgetRenderer = memo(function WidgetRenderer({
  widget,
  data,
}: {
  widget: Widget;
  data: WidgetData;
}) {
  switch (widget.type) {
    case "tasks":
      return <GridTasksWidget tasks={data.tasks} onComplete={data.onComplete} />;

    case "calendar":
      return (
        <MiniCalendar
          upcomingTasks={data.upcomingTasks}
          onEarlyComplete={data.onEarlyComplete}
        />
      );

    case "completed":
      return (
        <CompletedMissed
          completedToday={data.completedToday}
          missedYesterday={data.missedYesterday}
          pointsToday={data.pointsToday}
          totalToday={data.totalToday}
        />
      );

    case "leaderboard":
      return (
        <Leaderboard currentLocationId={data.currentLocationId} compact />
      );

    case "stats":
      return (
        <StatsWidget
          completed={data.completedToday.length}
          total={data.totalToday}
          points={data.pointsToday}
          missed={data.missedYesterday.length}
        />
      );

    case "messages":
      return (
        <LauncherTile
          icon={MessageCircle}
          label="Messages"
          hint="Open chat"
          badge={data.chatUnread}
          onClick={data.onOpenChat}
        />
      );

    case "forms":
      return (
        <LauncherTile
          icon={FileText}
          label="Forms"
          hint="Browse documents"
          onClick={data.onOpenForms}
        />
      );

    default:
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Unknown widget
        </div>
      );
  }
});

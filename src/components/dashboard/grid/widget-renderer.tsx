"use client";

import { memo } from "react";
import { CompletedMissed } from "@/components/dashboard/completed-missed";
import { FileText } from "@/lib/icons";
import { StatsWidget } from "./stats-widget";
import { GridTasksWidget } from "./grid-tasks";
import { GridMessagesWidget } from "./grid-messages";
import { GridUpcomingWidget } from "./grid-upcoming";
import type { Widget } from "./grid-engine";
import type { WidgetData } from "./widget-data";

/** Full-bleed launcher tile for components that open as their own overlay. */
function LauncherTile({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: typeof FileText;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center transition-colors active:bg-muted/60"
    >
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Icon className="h-7 w-7 text-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
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
      return (
        <GridTasksWidget
          tasks={data.tasks}
          onComplete={data.onComplete}
          onUncomplete={data.onUncomplete}
        />
      );

    case "calendar":
      return (
        <GridUpcomingWidget
          upcomingTasks={data.upcomingTasks}
          onEarlyComplete={data.onEarlyComplete}
          onEarlyUncomplete={data.onEarlyUncomplete}
        />
      );

    case "completed":
      return (
        <CompletedMissed
          completedToday={data.completedToday}
          missedYesterday={data.missedYesterday}
          totalToday={data.totalToday}
        />
      );

    case "stats":
      return (
        <StatsWidget
          completed={data.completedToday.length}
          total={data.totalToday}
          missed={data.missedYesterday.length}
        />
      );

    case "messages":
      return <GridMessagesWidget onOpen={data.onOpenChat} />;

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

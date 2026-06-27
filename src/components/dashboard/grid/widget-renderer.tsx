"use client";

import { memo } from "react";
import { FileText } from "@/lib/icons";
import { ClockWidget } from "./grid-clock";
import { GridCalendarWidget } from "./grid-calendar";
import { GridTasksWidget } from "./grid-tasks";
import { GridMessagesWidget } from "./grid-messages";
import { GridUpcomingWidget } from "./grid-upcoming";
import { GridQuoteWidget } from "./grid-quote";
import type { Widget } from "./grid-engine";
import type { WidgetData } from "./widget-data";

/** Launcher tile for components that open as their own overlay — same
 *  icon+title header every other data widget has (Messages, Upcoming,
 *  Calendar, Tasks), with the tap target as the body underneath rather than
 *  the whole tile being one button. The title lives in the header now, so
 *  the body only needs the icon and the hint — repeating the label in both
 *  places would be the redundant-header the rest of the dashboard was
 *  cleaned up to avoid. */
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
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-3">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">{label}</h2>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 p-4 text-center transition-colors active:bg-muted/60"
      >
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Icon className="h-7 w-7 text-primary" />
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </button>
    </div>
  );
}

// Memoized so that re-rendering the grid during drag/resize (which changes the
// grid context value) does NOT re-render the heavy widget bodies of widgets
// that didn't actually change. `widget` objects keep a stable reference for
// untouched widgets, and `data` is stable during in-grid interactions.
export const WidgetRenderer = memo(function WidgetRenderer({
  widget,
  data,
  tasksModalOpen,
  onTasksModalClose,
}: {
  widget: Widget;
  data: WidgetData;
  /** Controlled open state for the tasks fullscreen modal (driven by the expand button). */
  tasksModalOpen?: boolean;
  onTasksModalClose?: () => void;
}) {
  switch (widget.type) {
    case "tasks":
      return (
        <GridTasksWidget
          tasks={data.tasks}
          missedYesterday={data.missedYesterday}
          onComplete={data.onComplete}
          onUncomplete={data.onUncomplete}
          externalModalOpen={tasksModalOpen}
          onExternalModalClose={onTasksModalClose}
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

    case "month":
      return <GridCalendarWidget />;

    case "clock":
      return <ClockWidget />;

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

    case "quote":
      return <GridQuoteWidget />;

    default:
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Unknown widget
        </div>
      );
  }
});

"use client";

import { useRouter } from "next/navigation";
import {
  CheckSquare,
  CalendarDays,
  Calendar,
  MessageCircle,
  FileText,
  ChevronRight,
  LayoutGrid,
} from "@/lib/icons";
import { isAmbientWidget, type Widget, type WidgetType } from "./grid-engine";
import { WidgetRenderer } from "./widget-renderer";
import type { WidgetData } from "./widget-data";

/**
 * MobileDashboard — the single-direction stack the video this was sourced
 * from argues for: a desktop/kiosk dashboard lays out in two directions at
 * once (the 12x12 grid), but mobile can only commit to one. Below the
 * mobile breakpoint (see useDeviceType, <640px) this replaces GridSurface
 * entirely rather than rendering a shrunk copy of the same grid — shrinking
 * a 2D layout doesn't make it readable, it just clips it.
 *
 * Ambient widgets (clock, quote) render full-width inline, same as their
 * borderless desktop treatment. Everything else is a tappable summary row
 * that opens that widget's full version — a real route for tasks/calendar
 * (/tasks, /calendar), the existing overlay launchers for messages/forms.
 * Same mechanism as the desktop Expand button, just reached by tapping the
 * whole row instead of a corner icon, since there's no room to spare for a
 * separate affordance here.
 *
 * View + act only: this app's edit mode (drag position, resize footprint)
 * doesn't mean anything once everything is forced full-width in one column,
 * so customizing is intentionally not available here — see SettingsPanel's
 * mobile branch, which points back to a larger screen instead of trying to
 * build a parallel reorder/show-hide editor for v1.
 */

const ROW_ICON: Partial<Record<WidgetType, typeof CheckSquare>> = {
  tasks: CheckSquare,
  calendar: CalendarDays,
  month: Calendar,
  messages: MessageCircle,
  forms: FileText,
};

function WidgetBadge({ widget, data }: { widget: Widget; data: WidgetData }) {
  if (widget.type === "tasks") {
    const total = data.tasks.length;
    if (total === 0) return null;
    const done = data.tasks.filter((t) => t.isCompleted).length;
    return (
      <span className="text-xs font-semibold text-muted-foreground">
        {done}/{total}
      </span>
    );
  }
  if (widget.type === "messages" && data.chatUnread > 0) {
    return (
      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-2 text-xs font-semibold text-destructive-foreground">
        {data.chatUnread}
      </span>
    );
  }
  return null;
}

export function MobileDashboard({
  widgets,
  data,
}: {
  widgets: Widget[];
  data: WidgetData;
}) {
  const router = useRouter();

  if (widgets.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <LayoutGrid className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No widgets yet</p>
      </div>
    );
  }

  const handleOpen = (widget: Widget) => {
    if (widget.type === "tasks") router.push("/tasks");
    else if (widget.type === "calendar" || widget.type === "month") router.push("/calendar");
    else if (widget.type === "messages") data.onOpenChat();
    else if (widget.type === "forms") data.onOpenForms();
  };

  // Quote always renders last in the stack — it's the lowest-priority,
  // most-glanceable item (a daily motivational line), so it belongs at the
  // very bottom rather than wherever its grid position happened to put it
  // on desktop. Everything else keeps its existing relative order.
  const orderedWidgets = [
    ...widgets.filter((w) => w.type !== "quote"),
    ...widgets.filter((w) => w.type === "quote"),
  ];

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {orderedWidgets.map((widget) => {
        if (isAmbientWidget(widget.type)) {
          return (
            <div key={widget.id} className="shrink-0">
              <WidgetRenderer widget={widget} data={data} />
            </div>
          );
        }
        const Icon = ROW_ICON[widget.type];
        return (
          <button
            key={widget.id}
            type="button"
            onClick={() => handleOpen(widget)}
            className="flex shrink-0 items-center gap-3 rounded-3xl border border-border bg-card px-4 py-4 text-left transition-colors active:bg-muted"
          >
            {Icon && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
            )}
            <span className="flex-1 truncate text-sm font-semibold text-foreground">
              {widget.title}
            </span>
            <WidgetBadge widget={widget} data={data} />
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
          </button>
        );
      })}
    </div>
  );
}

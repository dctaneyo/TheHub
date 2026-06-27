"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckSquare,
  CalendarDays,
  Calendar,
  MessageCircle,
  FileText,
  ChevronRight,
  X,
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
 * that opens the widget's existing fullscreen presentation — reusing
 * whatever each widget type already has (tasks' own internal modal,
 * messages'/forms' existing overlay launchers) rather than inventing a
 * second "mobile" version of each widget's content.
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
      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
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
  // Generic fullscreen for widget types with no fullscreen of their own
  // (calendar/month) — mirrors the desktop WidgetContainer's default
  // `expanded` treatment, just without any drag/resize affordances.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Tasks has its own internal modal (grid-tasks.tsx) controlled via this
  // same external-trigger contract the desktop expand button already uses.
  const [tasksModalOpen, setTasksModalOpen] = useState(false);

  if (widgets.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <LayoutGrid className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No widgets yet</p>
      </div>
    );
  }

  const tasksWidget = widgets.find((w) => w.type === "tasks");
  const expandedWidget = widgets.find((w) => w.id === expandedId) ?? null;

  const handleOpen = (widget: Widget) => {
    if (widget.type === "tasks") setTasksModalOpen(true);
    else if (widget.type === "messages") data.onOpenChat();
    else if (widget.type === "forms") data.onOpenForms();
    else setExpandedId(widget.id);
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      {widgets.map((widget) => {
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
            className="flex shrink-0 items-center gap-3 rounded-3xl border border-border bg-card px-4 py-3.5 text-left transition-colors active:bg-muted"
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

      {/* Hidden host for the tasks widget's own internal modal — zero
          footprint (not display:none, which would unmount its fixed-
          position modal along with it), triggered by the row above. */}
      {tasksWidget && (
        <div className="absolute h-0 w-0 overflow-hidden">
          <WidgetRenderer
            widget={tasksWidget}
            data={data}
            tasksModalOpen={tasksModalOpen}
            onTasksModalClose={() => setTasksModalOpen(false)}
          />
        </div>
      )}

      {/* Generic fullscreen overlay for calendar/month-type widgets */}
      <AnimatePresence>
        {expandedWidget && (
          <motion.div
            key="mobile-expand-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-background/80 backdrop-blur-sm"
            onClick={() => setExpandedId(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {expandedWidget && (
          <motion.div
            key="mobile-expand-sheet"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-4 z-[151] flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
          >
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
              <span className="text-sm font-semibold text-foreground">
                {expandedWidget.title}
              </span>
              <button
                type="button"
                onClick={() => setExpandedId(null)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors active:bg-muted active:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative min-h-0 flex-1 overflow-auto">
              <WidgetRenderer widget={expandedWidget} data={data} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

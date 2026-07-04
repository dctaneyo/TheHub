"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutGrid } from "@/lib/icons";
import { useSocket } from "@/lib/socket-context";
import {
  GridProvider,
  GridSurface,
  GridSync,
  SettingsPanel,
  DEFAULT_LAYOUT,
  useGrid,
  type GridLayout,
  type WidgetData,
} from "@/components/dashboard/grid";

/**
 * ARL Console — Dashboard Layout. The one place the tenant-wide dashboard
 * grid layout (shared by every location, see DESIGN.md's 2026-07-01
 * customization decision) gets edited. Admin/superadmin ARLs only — the API
 * enforces this on save; anyone else can view but a save attempt is rejected.
 */

// The editor only needs to preview widget shapes/footprints — widget bodies
// are dimmed and non-interactive while editing anyway (widget-container.tsx),
// so real task/message data isn't needed here.
const PREVIEW_DATA: WidgetData = {
  tasks: [],
  onComplete: async () => false,
  onUncomplete: () => {},
  upcomingTasks: {},
  onEarlyComplete: () => {},
  onEarlyUncomplete: () => {},
  missedYesterday: [],
  chatUnread: 0,
  onOpenChat: () => {},
  onOpenForms: () => {},
};

// Puts the shared grid editor into edit mode the moment this page mounts —
// there's no "browsing" state here, the whole page's job is editing.
function AutoEditMode() {
  const { beginEdit, setEditMode } = useGrid();
  useEffect(() => {
    beginEdit();
    setEditMode(true);
  }, [beginEdit, setEditMode]);
  return null;
}

export function DashboardLayoutSettings() {
  const { socket } = useSocket();
  const [initialLayout, setInitialLayout] = useState<GridLayout | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard-layout");
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setInitialLayout(json?.layout ?? DEFAULT_LAYOUT);
        } else if (!cancelled) {
          setLoadError(true);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Always persists the layout as it currently stands — Reset (in
  // SettingsPanel) only changes the in-progress edit locally, same as any
  // other edit, so it still goes through this one Save path rather than
  // saving itself immediately.
  const handleSave = useCallback(async (layout: GridLayout) => {
    const res = await fetch("/api/dashboard-layout", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout }),
    });
    if (!res.ok) throw new Error(`Save failed: ${res.status}`);
  }, []);

  if (loadError) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Couldn&apos;t load the dashboard layout. Try refreshing.
      </div>
    );
  }

  if (!initialLayout) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <GridProvider initialLayout={initialLayout}>
      <AutoEditMode />
      <GridSync socket={socket} />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <LayoutGrid className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Dashboard Layout</h2>
              <p className="text-xs text-muted-foreground">Shared by every location in this tenant</p>
            </div>
          </div>
          <SettingsPanel onSave={handleSave} />
        </div>
        <div className="h-[720px] overflow-hidden rounded-2xl border border-border bg-muted/30">
          <GridSurface data={PREVIEW_DATA} />
        </div>
      </div>
    </GridProvider>
  );
}

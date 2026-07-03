"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  Plus,
  RefreshCw,
  Save,
  X,
  Loader2,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useGrid } from "./grid-context";
import { WidgetContainer } from "./widget-container";
import { WidgetRenderer } from "./widget-renderer";
import { MobileDashboard } from "./grid-mobile-stack";
import { GRID_COLS, GRID_ROWS, type GridLayout } from "./grid-engine";
import { DEFAULT_LAYOUT, WIDGET_CATALOG } from "./layouts";
import type { WidgetData } from "./widget-data";
import { useDeviceType } from "@/hooks/use-device-type";

// ── Shared pill class ─────────────────────────────────────────────────────────
// Layout/typography via Tailwind; glass surface via .pill in globals.css
const PILL = "pill flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-muted-foreground active:text-foreground";

/**
 * SettingsPanel — the dashboard layout editor toolbar, used only on the ARL
 * Console's Dashboard Layout page (src/components/arl/dashboard-layout-settings.tsx).
 * The dashboard layout is tenant-wide (DESIGN.md, 2026-07-01 decision) —
 * kiosks never edit it, so this component no longer has a "browsing" cog/
 * popover mode at all; it's always in edit mode from the moment it mounts.
 * Add/Cancel/Save/Reset stay inline and fully visible, since editing is the
 * entire point of the page this renders on, not a mode someone opts into.
 *
 * Must be rendered inside <GridProvider>, after calling beginEdit()+
 * setEditMode(true) once on mount (the ARL Console page does this).
 */
export function SettingsPanel({
  onSave,
}: {
  onSave?: (layout: GridLayout) => Promise<void> | void;
}) {
  const {
    layout,
    widgets,
    addWidget,
    replaceLayout,
    beginEdit,
    cancelEdit,
  } = useGrid();

  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const usedTypes = new Set(widgets.map((w) => w.type));

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave?.(layout);
      beginEdit(); // re-snapshot so a later Cancel reverts to what was just saved
      setShowAdd(false);
    } catch {
      // stay in edit mode, nothing saved
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    cancelEdit();
    setShowAdd(false);
  };

  const handleReset = () => {
    replaceLayout(DEFAULT_LAYOUT);
    setShowAdd(false);
  };

  // Panel items reveal together as one group — no per-item stagger/spring/
  // scale choreography. This is a settings toolbar, not a moment to perform.
  const pillVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.12 } },
    exit: { opacity: 0, transition: { duration: 0.1 } },
  };

  const panelItems: { key: string; node: React.ReactNode }[] = [
    {
      key: "add",
      node: (
        <div className="relative">
          <button type="button" onClick={() => setShowAdd((v) => !v)} className={PILL}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add</span>
          </button>
          <AnimatePresence>
            {showAdd && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="absolute right-0 top-full z-[60] mt-1 w-52 rounded-2xl border border-border bg-card p-2 shadow-lg"
              >
                {WIDGET_CATALOG.map((item) => {
                  const used = usedTypes.has(item.type);
                  return (
                    <button
                      key={item.type}
                      type="button"
                      disabled={used}
                      onClick={() => { addWidget({ id: `${item.type}-${Date.now()}`, type: item.type, title: item.title, w: item.defaultW, h: item.defaultH }); setShowAdd(false); }}
                      className={cn("flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm transition-colors", used ? "cursor-not-allowed text-muted-foreground/50" : "active:bg-muted")}
                    >
                      {item.title}
                      {used && <span className="text-xs">added</span>}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ),
    },
    {
      key: "reset",
      node: (
        <button type="button" onClick={handleReset} disabled={saving} className={cn(PILL, "disabled:opacity-50")}>
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      ),
    },
    {
      key: "cancel",
      node: (
        <button type="button" onClick={handleCancel} disabled={saving} className={cn(PILL, "disabled:opacity-50")}>
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      ),
    },
    {
      key: "save",
      node: (
        <button type="button" onClick={handleSave} disabled={saving} className="flex h-9 items-center gap-1 rounded-full bg-primary px-3 shadow-sm text-xs font-semibold text-primary-foreground transition-colors active:bg-primary/90 disabled:opacity-60">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? "Saving…" : "Save"}
        </button>
      ),
    },
  ];

  return (
    <div className="flex items-center gap-2">
      <AnimatePresence initial={false}>
        {panelItems.map(({ key, node }) => (
          <motion.div key={key} variants={pillVariants} initial="hidden" animate="visible" exit="exit">
            {node}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// NOTE: GridControls (a near-duplicate of SettingsPanel's layout/add/tidy/
// reset/save/cancel controls) was removed here — it had zero consumers
// anywhere in the app, confirmed via grep before deletion.

/**
 * Listens for the tenant-wide dashboard layout changing (an ARL saved a new
 * one via the ARL Console) and applies it live, so every kiosk updates
 * without a manual refresh. Never clobbers an in-progress edit — only
 * relevant on the ARL Console page itself, where an admin could be mid-edit
 * in one tab while another admin saves from a different one. Must be
 * rendered inside a <GridProvider>.
 */
export function GridSync({ socket }: { socket: Socket | null }) {
  const { replaceLayout, editMode } = useGrid();
  const editingRef = useRef(editMode);
  editingRef.current = editMode;

  useEffect(() => {
    if (!socket) return;
    const handler = (payload: { layout: GridLayout | null }) => {
      if (editingRef.current) return; // don't overwrite an active edit session
      if (payload.layout && Array.isArray(payload.layout.widgets)) {
        replaceLayout(payload.layout);
      }
    };
    socket.on("dashboard-layout:updated", handler);
    return () => {
      socket.off("dashboard-layout:updated", handler);
    };
  }, [socket, replaceLayout]);

  return null;
}

/** The grid surface (widgets + edit affordances). Must be rendered inside a
 *  <GridProvider>. */
export function GridSurface({ data }: { data: WidgetData }) {
  const { widgets, editMode } = useGrid();
  const gridRef = useRef<HTMLDivElement>(null);
  const deviceType = useDeviceType();

  // Below the mobile breakpoint, the 12x12 free-form grid is replaced
  // entirely rather than shrunk — a two-directional layout doesn't become
  // readable by scaling it down, see DESIGN.md's User Flow / mobile notes.
  // Tablet and desktop keep the free-form grid unchanged (still not
  // editable here on the kiosk — layout editing lives in the ARL Console).
  if (deviceType === "mobile") {
    return <MobileDashboard widgets={widgets} data={data} />;
  }

  const gridTemplate: React.CSSProperties = {
    gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
  };

  return (
    <div className="relative h-full overflow-hidden p-4">
      {/* Cell guide background (aligned, behind widgets) */}
      {editMode && (
        <div
          className="pointer-events-none absolute inset-4 grid gap-4"
          style={gridTemplate}
        >
          {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, i) => (
            <div
              key={i}
              className="rounded-md border border-dashed border-border/30"
            />
          ))}
        </div>
      )}

      {/* Widget layer */}
      <div
        ref={gridRef}
        className="relative grid h-full w-full gap-4"
        style={gridTemplate}
      >
        <AnimatePresence>
          {widgets.map((widget) => (
            <WidgetContainer
              key={widget.id}
              widget={widget}
              gridRef={gridRef}
            >
              <WidgetRenderer widget={widget} data={data} />
            </WidgetContainer>
          ))}
        </AnimatePresence>
      </div>

      {widgets.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
          <LayoutGrid className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No widgets yet</p>
        </div>
      )}
    </div>
  );
}

/**
 * GridMirrorSync — bidirectional grid layout sync for the remote-view / mirror system.
 * Must be rendered inside a <GridProvider>.
 *
 * TARGET side (location being viewed):
 *   When remoteViewActive=true, broadcasts the current full GridLayout object via
 *   captureManagerRef.current.broadcastViewState({ gridLayout }) so the embed iframe
 *   can apply it. Re-broadcasts whenever the layout changes while being viewed.
 *   Accepts a React ref so it always reads the latest manager instance, not a stale
 *   snapshot captured at render time.
 *
 * EMBED side (ARL's iframe):
 *   When mirrorViewState.gridLayout arrives from the target, calls replaceLayout()
 *   to apply the exact widget arrangement inside this GridProvider instance.
 *
 * KNOWN DEAD PATH as of 2026-07-01: the "EMBED side: when ARL changes layout
 * locally" effect below (pushing an edit made inside the mirror embed back to
 * the target) can no longer fire — SettingsPanel no longer renders inside the
 * dashboard embed at all, so nothing edits `layout` from within an embed
 * anymore. Left in place rather than torn out in the same pass that removed
 * kiosk-side editing, since it's interleaved with the TARGET→EMBED view-sync
 * effects below (still needed, unrelated) in ways that deserve a careful,
 * separate look rather than a rushed cut.
 */
export function GridMirrorSync({
  isEmbed,
  isMirroring,
  remoteViewActive,
  mirrorViewState,
  captureManagerRef,
  sendViewChange,
}: {
  isEmbed: boolean;
  isMirroring: boolean;
  remoteViewActive: boolean;
  mirrorViewState: { gridLayout?: { id: string; name: string; description: string; widgets: unknown[]; isCustom?: boolean } | null } | null;
  /** Pass the ref itself (not .current) so we always read the latest manager. */
  captureManagerRef: React.RefObject<{ broadcastViewState: (state: Record<string, unknown>) => void } | null>;
  /** sendViewChange from useMirror() — used by embed side to push layout changes to the location. */
  sendViewChange?: (viewState: Record<string, unknown>) => void;
}) {
  const { layout, replaceLayout, editMode } = useGrid();
  const editingRef = useRef(editMode);
  editingRef.current = editMode;

  // TARGET side: broadcast current layout whenever remote view is active.
  // We read captureManagerRef.current inside the effect so we always get the
  // latest manager even if it was null when the component first rendered.
  // A short retry handles the race where remoteViewActive becomes true slightly
  // before RemoteViewBanner finishes creating the RemoteCaptureManager.
  useEffect(() => {
    if (!remoteViewActive || isMirroring) return;

    const broadcast = () => {
      const mgr = captureManagerRef.current;
      if (mgr) {
        mgr.broadcastViewState({ gridLayout: layout });
        return true;
      }
      return false;
    };

    if (broadcast()) return;

    // Manager not ready yet — retry up to 10 times at 200ms intervals
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (broadcast() || attempts >= 10) clearInterval(timer);
    }, 200);
    return () => clearInterval(timer);
  }, [layout, remoteViewActive, captureManagerRef, isMirroring]);

  // TARGET side: apply layout pushed from the ARL embed via DOM event.
  // The location's onReverseView dispatches "mirror:grid-layout-from-arl" when
  // the ARL changes the layout in the embed (via SettingsPanel).
  useEffect(() => {
    if (isMirroring || !remoteViewActive) return;
    const handler = (e: Event) => {
      const incoming = (e as CustomEvent).detail;
      if (!incoming || editingRef.current) return;
      replaceLayout(incoming as GridLayout);
    };
    window.addEventListener("mirror:grid-layout-from-arl", handler);
    return () => window.removeEventListener("mirror:grid-layout-from-arl", handler);
  }, [isMirroring, remoteViewActive, replaceLayout]);

  // EMBED side: apply the target's layout when it arrives via view state.
  // Guard against clobbering an in-progress edit session.
  const lastAppliedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!isEmbed || !isMirroring || !mirrorViewState?.gridLayout) return;
    if (editingRef.current) return; // never clobber an active edit

    const incoming = mirrorViewState.gridLayout;
    // Stable key: widget JSON for custom, layout ID for predefined.
    const key = incoming.isCustom
      ? JSON.stringify(incoming.widgets)
      : incoming.id;

    if (lastAppliedKey.current === key) return;
    lastAppliedKey.current = key;

    replaceLayout(incoming as GridLayout);
    // Also push the layout back to the location so its GridProvider stays in sync
    sendViewChange?.({ gridLayout: incoming });
  }, [isEmbed, isMirroring, mirrorViewState?.gridLayout, replaceLayout, sendViewChange]);

  // EMBED side: when ARL changes layout locally (e.g. via SettingsPanel), push it to location.
  // This runs whenever the layout changes in the embed and we're in mirror mode.
  const prevLayoutKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isEmbed || !isMirroring) return;
    const key = layout.isCustom ? JSON.stringify(layout.widgets) : layout.id;
    if (prevLayoutKeyRef.current === null) { prevLayoutKeyRef.current = key; return; } // skip init
    if (prevLayoutKeyRef.current === key) return;
    prevLayoutKeyRef.current = key;
    sendViewChange?.({ gridLayout: layout });
  }, [isEmbed, isMirroring, layout, sendViewChange]);

  return null;
}

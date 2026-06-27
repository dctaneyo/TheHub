"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  Plus,
  Settings,
  RefreshCw,
  Check,
  ChevronDown,
  Sparkles,
  Save,
  X,
  Loader2,
  Sun,
  Moon,
  Monitor,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useGrid } from "./grid-context";
import { WidgetContainer } from "./widget-container";
import { WidgetRenderer } from "./widget-renderer";
import { GRID_COLS, GRID_ROWS, type GridLayout } from "./grid-engine";
import { PREDEFINED_LAYOUTS, WIDGET_CATALOG } from "./layouts";
import type { WidgetData } from "./widget-data";

// ── Shared pill class ─────────────────────────────────────────────────────────
// Layout/typography via Tailwind; glass surface via .pill in globals.css
const PILL = "pill flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground active:text-foreground";

/**
 * SettingsPanel — a settings cog pill that, when clicked, slides left and
 * morphs out the layout picker, customize, and theme picker pills from itself.
 * Closing re-absorbs them back into the cog with the reverse animation.
 * Must be rendered inside <GridProvider>.
 */
export function SettingsPanel({
  onSave,
  theme,
  themeMounted,
  onCycleTheme,
}: {
  onSave?: (layout: GridLayout) => Promise<void> | void;
  theme: string | undefined;
  themeMounted: boolean;
  onCycleTheme: () => void;
}) {
  const {
    layout,
    widgets,
    editMode,
    setEditMode,
    addWidget,
    replaceLayout,
    selectCustom,
    beginEdit,
    commitEdit,
    cancelEdit,
    compact,
  } = useGrid();

  const [open, setOpen] = useState(false);
  const [showLayouts, setShowLayouts] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const isCustom = !!layout.isCustom;
  const usedTypes = new Set(widgets.map((w) => w.type));

  const startEditing = () => {
    beginEdit();
    setEditMode(true);
    setShowLayouts(false);
    setShowAdd(false);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave?.(layout);
      commitEdit();
      setEditMode(false);
      setShowAdd(false);
    } catch {
      // stay in edit mode
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    cancelEdit();
    setEditMode(false);
    setShowAdd(false);
    setOpen(false);
  };

  // Panel items reveal together as one group — no per-item stagger/spring/
  // scale choreography. This is a settings menu, not a moment to perform.
  const pillVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.12 } },
    exit: { opacity: 0, transition: { duration: 0.1 } },
  };

  // Build the ordered list of panel items
  const panelItems: { key: string; node: React.ReactNode }[] = [];

  if (!editMode) {
    panelItems.push({
      key: "layouts",
      node: (
        <div className="relative">
          <button type="button" onClick={() => { setShowLayouts((v) => !v); setShowAdd(false); }} className={PILL}>
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{layout.name}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          <AnimatePresence>
            {showLayouts && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="absolute right-0 top-full z-[60] mt-1 w-60 rounded-2xl border border-border bg-card/95 p-1.5 shadow-lg backdrop-blur-md"
              >
                {PREDEFINED_LAYOUTS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => { replaceLayout({ ...preset, isCustom: false }); setEditMode(false); setShowLayouts(false); }}
                    className={cn("flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition-colors active:bg-muted", !isCustom && layout.id === preset.id && "bg-primary/10")}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">{preset.name}</div>
                      <div className="text-xs text-muted-foreground">{preset.description}</div>
                    </div>
                    {!isCustom && layout.id === preset.id && <Check className="mt-0.5 h-3.5 w-3.5 text-primary" />}
                  </button>
                ))}
                <div className="my-1 h-px bg-border" />
                <button
                  type="button"
                  onClick={() => { selectCustom(); setShowLayouts(false); }}
                  className={cn("flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition-colors active:bg-muted", isCustom && "bg-primary/10")}
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">Custom</div>
                    <div className="text-xs text-muted-foreground">Build and arrange your own layout</div>
                  </div>
                  {isCustom && <Check className="mt-0.5 h-3.5 w-3.5 text-primary" />}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ),
    });

    if (isCustom) {
      panelItems.push({
        key: "customize",
        node: (
          <button type="button" onClick={startEditing} className={PILL}>
            <Settings className="h-3.5 w-3.5" />
            Customize
          </button>
        ),
      });
    }
  }

  if (editMode) {
    panelItems.push({
      key: "add",
      node: (
        <div className="relative">
          <button type="button" onClick={() => { setShowAdd((v) => !v); setShowLayouts(false); }} className={PILL}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add</span>
          </button>
          <AnimatePresence>
            {showAdd && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="absolute right-0 top-full z-[60] mt-1 w-52 rounded-2xl border border-border bg-card/95 p-1.5 shadow-lg backdrop-blur-md"
              >
                {WIDGET_CATALOG.map((item) => {
                  const used = usedTypes.has(item.type);
                  return (
                    <button
                      key={item.type}
                      type="button"
                      disabled={used}
                      onClick={() => { addWidget({ id: `${item.type}-${Date.now()}`, type: item.type, title: item.title, w: item.defaultW, h: item.defaultH }); setShowAdd(false); }}
                      className={cn("flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-sm transition-colors", used ? "cursor-not-allowed text-muted-foreground/50" : "active:bg-muted")}
                    >
                      {item.title}
                      {used && <span className="text-[10px]">added</span>}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ),
    });
    panelItems.push({
      key: "tidy",
      node: (
        <button type="button" onClick={() => compact()} className={PILL} title="Pull widgets up to close gaps">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Tidy</span>
        </button>
      ),
    });
    panelItems.push({
      key: "reset",
      node: (
        <button type="button" onClick={() => replaceLayout({ ...PREDEFINED_LAYOUTS[0], id: "custom", name: "Custom", description: "Your personalized layout", isCustom: true })} className={PILL} title="Reset custom layout">
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      ),
    });
    panelItems.push({
      key: "cancel",
      node: (
        <button type="button" onClick={handleCancel} disabled={saving} className={cn(PILL, "disabled:opacity-50")}>
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      ),
    });
    panelItems.push({
      key: "save",
      node: (
        <button type="button" onClick={handleSave} disabled={saving} className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 shadow-sm text-xs font-medium text-primary-foreground transition-colors active:bg-primary/90 disabled:opacity-60">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? "Saving…" : "Save"}
        </button>
      ),
    });
  }

  if (themeMounted) {
    panelItems.push({
      key: "theme",
      node: (
        <button onClick={onCycleTheme} title={`Theme: ${theme}`} className={PILL}>
          {theme === "dark" ? <Moon className="h-3.5 w-3.5" /> : theme === "light" ? <Sun className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
          <span className="capitalize">{theme}</span>
        </button>
      ),
    });
  }

  return (
    <div className="flex items-center gap-2">
      {/* Panel pills — reveal together as one group */}
      <AnimatePresence initial={false}>
        {open && panelItems.map(({ key, node }) => (
          <motion.div
            key={key}
            variants={pillVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {node}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Cog pill — plain button, only the icon rotates */}
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); if (open) { setShowLayouts(false); setShowAdd(false); } }}
        className={cn(PILL, open && "bg-card text-foreground")}
        title={open ? "Close settings" : "Settings"}
      >
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
          className="inline-flex"
        >
          <Settings className="h-3.5 w-3.5" />
        </motion.span>
      </button>
    </div>
  );
}

/**
 * Header controls: layout picker (presets + Custom) and — only while the
 * editable Custom layout is active — the customize/save/cancel affordances.
 * Editing uses explicit Save/Cancel (no auto-save) so that, when a location is
 * signed in on multiple devices, the others only refresh when a layout is
 * actually saved. Must be rendered inside a <GridProvider>.
 */
export function GridControls({
  onSave,
}: {
  onSave?: (layout: GridLayout) => Promise<void> | void;
}) {
  const {
    layout,
    widgets,
    editMode,
    setEditMode,
    addWidget,
    replaceLayout,
    selectCustom,
    beginEdit,
    commitEdit,
    cancelEdit,
    compact,
  } = useGrid();

  const [showLayouts, setShowLayouts] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const isCustom = !!layout.isCustom;
  const usedTypes = new Set(widgets.map((w) => w.type));

  const startEditing = () => {
    beginEdit();
    setEditMode(true);
    setShowLayouts(false);
    setShowAdd(false);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave?.(layout);
      commitEdit();
      setEditMode(false);
      setShowAdd(false);
    } catch (err) {
      console.error("Failed to save layout:", err);
      // Stay in edit mode so the user can retry.
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    cancelEdit();
    setEditMode(false);
    setShowAdd(false);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Layout picker — hidden while editing to avoid switching mid-edit */}
      {!editMode && (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowLayouts((v) => !v);
              setShowAdd(false);
            }}
            className="pill flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground active:text-foreground"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{layout.name}</span>
            <span className="sm:hidden">Layouts</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          <AnimatePresence>
            {showLayouts && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="absolute right-0 top-full z-[60] mt-1 w-60 rounded-lg border border-border bg-card p-1.5 shadow-lg"
              >
                {PREDEFINED_LAYOUTS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      replaceLayout({ ...preset, isCustom: false });
                      setEditMode(false);
                      setShowLayouts(false);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors active:bg-muted",
                      !isCustom && layout.id === preset.id && "bg-primary/10"
                    )}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">
                        {preset.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {preset.description}
                      </div>
                    </div>
                    {!isCustom && layout.id === preset.id && (
                      <Check className="mt-0.5 h-3.5 w-3.5 text-primary" />
                    )}
                  </button>
                ))}

                {/* Divider */}
                <div className="my-1 h-px bg-border" />

                {/* Custom (editable) layout */}
                <button
                  type="button"
                  onClick={() => {
                    selectCustom();
                    setShowLayouts(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors active:bg-muted",
                    isCustom && "bg-primary/10"
                  )}
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">
                      Custom
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Build and arrange your own layout
                    </div>
                  </div>
                  {isCustom && (
                    <Check className="mt-0.5 h-3.5 w-3.5 text-primary" />
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Add widget (editing only) */}
      {editMode && (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowAdd((v) => !v);
              setShowLayouts(false);
            }}
            className="pill flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground active:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add</span>
          </button>
          <AnimatePresence>
            {showAdd && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="absolute right-0 top-full z-[60] mt-1 w-52 rounded-lg border border-border bg-card p-1.5 shadow-lg"
              >
                {WIDGET_CATALOG.map((item) => {
                  const used = usedTypes.has(item.type);
                  return (
                    <button
                      key={item.type}
                      type="button"
                      disabled={used}
                      onClick={() => {
                        addWidget({
                          id: `${item.type}-${Date.now()}`,
                          type: item.type,
                          title: item.title,
                          w: item.defaultW,
                          h: item.defaultH,
                        });
                        setShowAdd(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                        used
                          ? "cursor-not-allowed text-muted-foreground/50"
                          : "active:bg-muted"
                      )}
                    >
                      {item.title}
                      {used && <span className="text-[10px]">added</span>}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Tidy up / compact (editing only) */}
      {editMode && (
        <button
          type="button"
          onClick={() => compact()}
          className="pill flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground active:text-foreground"
          title="Pull widgets up to close gaps"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Tidy up</span>
        </button>
      )}

      {/* Reset (editing only) — reseed the custom layout */}
      {editMode && (
        <button
          type="button"
          onClick={() => {
            const base = PREDEFINED_LAYOUTS[0];
            replaceLayout({
              ...base,
              id: "custom",
              name: "Custom",
              description: "Your personalized layout",
              isCustom: true,
            });
          }}
          className="pill flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground active:text-foreground"
          title="Reset custom layout"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      )}

      {/* Customize — only on the Custom layout, when not already editing */}
      {isCustom && !editMode && (
        <button
          type="button"
          onClick={startEditing}
          className="pill flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground active:text-foreground"
        >
          <Settings className="h-3.5 w-3.5" />
          Customize
        </button>
      )}

      {/* Save / Cancel — while editing */}
      {editMode && (
        <>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="pill flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground active:text-foreground disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 shadow-sm text-xs font-medium text-primary-foreground transition-colors active:bg-primary/90 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Listens for layout changes saved on other devices for the same account and
 * applies them live (so all of a location's screens stay in sync). Ignores
 * updates that originated from this device and never clobbers an in-progress
 * edit. Must be rendered inside a <GridProvider>.
 */
export function GridSync({
  socket,
  deviceId,
}: {
  socket: Socket | null;
  deviceId: string;
}) {
  const { replaceLayout, editMode } = useGrid();
  const editingRef = useRef(editMode);
  editingRef.current = editMode;

  useEffect(() => {
    if (!socket) return;
    const handler = (payload: {
      layout: GridLayout | null;
      sourceDeviceId?: string;
    }) => {
      if (payload.sourceDeviceId && payload.sourceDeviceId === deviceId) return;
      if (editingRef.current) return; // don't overwrite an active edit session
      if (payload.layout && Array.isArray(payload.layout.widgets)) {
        replaceLayout(payload.layout);
      }
    };
    socket.on("grid-layout:updated", handler);
    return () => {
      socket.off("grid-layout:updated", handler);
    };
  }, [socket, deviceId, replaceLayout]);

  return null;
}

/** The grid surface (widgets + edit affordances). Must be rendered inside a
 *  <GridProvider>. */
export function GridSurface({ data }: { data: WidgetData }) {
  const { widgets, editMode } = useGrid();
  const gridRef = useRef<HTMLDivElement>(null);
  const [tasksModalOpen, setTasksModalOpen] = useState(false);

  const gridTemplate: React.CSSProperties = {
    gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
  };

  return (
    <div className="relative h-full overflow-hidden p-3">
      {/* Cell guide background (aligned, behind widgets) */}
      {editMode && (
        <div
          className="pointer-events-none absolute inset-3 grid gap-3"
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
        className="relative grid h-full w-full gap-3"
        style={gridTemplate}
      >
        <AnimatePresence>
          {widgets.map((widget) => (
            <WidgetContainer
              key={widget.id}
              widget={widget}
              gridRef={gridRef}
              onExpand={
                widget.type === "tasks"
                  ? () => setTasksModalOpen(true)
                  : widget.type === "messages"
                  ? () => data.onOpenChat()
                  : undefined
              }
            >
              <WidgetRenderer
                widget={widget}
                data={data}
                tasksModalOpen={widget.type === "tasks" ? tasksModalOpen : undefined}
                onTasksModalClose={widget.type === "tasks" ? () => setTasksModalOpen(false) : undefined}
              />
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
  // the ARL changes the layout in the embed (SettingsPanel, selectCustom, etc.).
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

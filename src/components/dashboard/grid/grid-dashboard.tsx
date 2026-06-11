"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  Plus,
  Settings,
  RefreshCw,
  Check,
  ChevronDown,
  Sparkles,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { GridProvider, useGrid } from "./grid-context";
import { WidgetContainer } from "./widget-container";
import { WidgetRenderer } from "./widget-renderer";
import { GRID_COLS, GRID_ROWS, type GridLayout } from "./grid-engine";
import {
  PREDEFINED_LAYOUTS,
  WIDGET_CATALOG,
  getPredefinedLayout,
} from "./layouts";
import type { WidgetData } from "./widget-data";

interface GridDashboardProps {
  data: WidgetData;
  initialLayout: GridLayout;
  onPersist?: (layout: GridLayout) => void;
}

function Toolbar({ onPersist }: { onPersist?: (layout: GridLayout) => void }) {
  const {
    layout,
    widgets,
    editMode,
    setEditMode,
    addWidget,
    replaceLayout,
    compact,
  } = useGrid();

  const [showLayouts, setShowLayouts] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // Persist layout changes (debounced). The page decides whether a custom
  // layout is saved or a predefined selection clears the saved one.
  const persistRef = useRef(onPersist);
  persistRef.current = onPersist;
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return; // don't re-persist the layout we just loaded
    }
    const t = setTimeout(() => persistRef.current?.(layout), 600);
    return () => clearTimeout(t);
  }, [layout]);

  const usedTypes = new Set(widgets.map((w) => w.type));

  return (
    <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">{layout.name}</h2>
        {layout.isCustom && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            Custom
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Layout picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowLayouts((v) => !v);
              setShowAdd(false);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Layouts
            <ChevronDown className="h-3 w-3" />
          </button>
          <AnimatePresence>
            {showLayouts && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="absolute right-0 top-full z-50 mt-1 w-60 rounded-lg border border-border bg-card p-1.5 shadow-lg"
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
                      "flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted",
                      !layout.isCustom && layout.id === preset.id && "bg-primary/10"
                    )}
                  >
                    <div className="flex-1">
                      <div className="text-xs font-medium text-foreground">
                        {preset.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {preset.description}
                      </div>
                    </div>
                    {!layout.isCustom && layout.id === preset.id && (
                      <Check className="mt-0.5 h-3.5 w-3.5 text-primary" />
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Add widget (edit mode only) */}
        {editMode && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowAdd((v) => !v);
                setShowLayouts(false);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
            <AnimatePresence>
              {showAdd && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-border bg-card p-1.5 shadow-lg"
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
                          "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                          used
                            ? "cursor-not-allowed text-muted-foreground/50"
                            : "hover:bg-muted"
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

        {/* Tidy up / compact (edit mode only) */}
        {editMode && (
          <button
            type="button"
            onClick={() => compact()}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            title="Pull widgets up to close gaps"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Tidy up
          </button>
        )}

        {/* Reset (edit mode only) */}
        {editMode && (
          <button
            type="button"
            onClick={() => {
              const base = getPredefinedLayout(layout.id) ?? PREDEFINED_LAYOUTS[0];
              replaceLayout({ ...base, isCustom: false });
            }}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            title="Reset to preset"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset
          </button>
        )}

        {/* Edit toggle */}
        <button
          type="button"
          onClick={() => setEditMode(!editMode)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
            editMode
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card hover:bg-muted"
          )}
        >
          {editMode ? <Check className="h-3.5 w-3.5" /> : <Settings className="h-3.5 w-3.5" />}
          {editMode ? "Done" : "Customize"}
        </button>
      </div>
    </div>
  );
}

function GridArea({ data }: { data: WidgetData }) {
  const { widgets, editMode } = useGrid();
  const gridRef = useRef<HTMLDivElement>(null);

  const gridTemplate: React.CSSProperties = {
    gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
  };

  return (
    <div className="relative flex-1 overflow-hidden p-2">
      {/* Cell guide background (aligned, behind widgets) */}
      {editMode && (
        <div
          className="pointer-events-none absolute inset-2 grid gap-2"
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
        className="relative grid h-full w-full gap-2"
        style={gridTemplate}
      >
        <AnimatePresence>
          {widgets.map((widget) => (
            <WidgetContainer key={widget.id} widget={widget} gridRef={gridRef}>
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

export function GridDashboard({ data, initialLayout, onPersist }: GridDashboardProps) {
  return (
    <GridProvider initialLayout={initialLayout}>
      <div className="flex h-full flex-col">
        <Toolbar onPersist={onPersist} />
        <GridArea data={data} />
      </div>
    </GridProvider>
  );
}

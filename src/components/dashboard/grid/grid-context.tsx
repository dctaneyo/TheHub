"use client";

import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { setReloadBlocked } from "@/lib/reload-guard";
import {
  useGridLayout,
  type GridLayout,
  type Widget,
} from "./grid-engine";

interface GridContextValue {
  layout: GridLayout;
  widgets: Widget[];
  expandedWidget: string | null;
  isExpanded: (id: string) => boolean;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  moveWidget: (id: string, position: { x: number; y: number }) => void;
  resizeWidget: (id: string, w: number, h: number) => void;
  toggleExpand: (id: string) => void;
  addWidget: (widget: Omit<Widget, "position">) => void;
  removeWidget: (id: string) => void;
  replaceLayout: (layout: GridLayout) => void;
  selectCustom: () => void;
  beginEdit: () => void;
  commitEdit: () => void;
  cancelEdit: () => void;
  compact: () => void;
}

const GridContext = createContext<GridContextValue | null>(null);

export function GridProvider({
  children,
  initialLayout,
}: {
  children: ReactNode;
  initialLayout: GridLayout;
}) {
  const engine = useGridLayout(initialLayout);

  // While the layout is being edited, block the build-update auto-reload so an
  // unsaved customization is never wiped out. Any deferred reload runs once
  // editing ends (Save/Cancel).
  useEffect(() => {
    setReloadBlocked(engine.editMode);
    return () => setReloadBlocked(false);
  }, [engine.editMode]);

  return (
    <GridContext.Provider value={engine}>{children}</GridContext.Provider>
  );
}

export function useGrid(): GridContextValue {
  const ctx = useContext(GridContext);
  if (!ctx) throw new Error("useGrid must be used within a GridProvider");
  return ctx;
}

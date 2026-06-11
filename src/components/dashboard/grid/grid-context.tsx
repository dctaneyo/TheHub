"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
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
  const [editMode, setEditMode] = useState(false);

  return (
    <GridContext.Provider value={{ ...engine, editMode, setEditMode }}>
      {children}
    </GridContext.Provider>
  );
}

export function useGrid(): GridContextValue {
  const ctx = useContext(GridContext);
  if (!ctx) throw new Error("useGrid must be used within a GridProvider");
  return ctx;
}

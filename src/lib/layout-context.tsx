"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type DashboardLayout = "classic" | "command-center" | "focus" | "grid" | "split-hero";

export const LAYOUT_OPTIONS: { id: DashboardLayout; name: string; description: string }[] = [
  { id: "classic", name: "Classic", description: "Original 3-column layout" },
  { id: "command-center", name: "Command Center", description: "Hero stats strip with quick-access dock" },
  { id: "focus", name: "Focus Mode", description: "Task-centric single column" },
  { id: "grid", name: "Dashboard Grid", description: "Card-based modular grid" },
  { id: "split-hero", name: "Split Hero", description: "Two-panel action + status view" },
];

interface LayoutContextType {
  layout: DashboardLayout;
  setLayout: (layout: DashboardLayout) => void;
}

const LayoutContext = createContext<LayoutContextType>({
  layout: "classic",
  setLayout: () => {},
});

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayoutState] = useState<DashboardLayout>("classic");

  useEffect(() => {
    const saved = localStorage.getItem("hub-dashboard-layout");
    if (saved && LAYOUT_OPTIONS.some((o) => o.id === saved)) {
      setLayoutState(saved as DashboardLayout);
    }
  }, []);

  const setLayout = (l: DashboardLayout) => {
    setLayoutState(l);
    localStorage.setItem("hub-dashboard-layout", l);
  };

  return (
    <LayoutContext.Provider value={{ layout, setLayout }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  return useContext(LayoutContext);
}

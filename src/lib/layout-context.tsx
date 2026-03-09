"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type DashboardLayout = "classic" | "focus";

export const LAYOUT_OPTIONS: { id: DashboardLayout; name: string; description: string }[] = [
  { id: "classic", name: "Classic", description: "Original 3-column layout" },
  { id: "focus", name: "Focus", description: "Hero task card, up-next grid, collapsible sidebar" },
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

"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

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
  const { user } = useAuth();

  // Fetch layout preference from database on mount (cookie auth, no Bearer needed)
  useEffect(() => {
    if (!user) return;
    fetch("/api/preferences/layout")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.layout && LAYOUT_OPTIONS.some((o) => o.id === data.layout)) {
          setLayoutState(data.layout as DashboardLayout);
        }
      })
      .catch(() => {});
  }, [user]);

  const setLayout = (l: DashboardLayout) => {
    setLayoutState(l);
    // Persist to DB in background (cookie auth)
    fetch("/api/preferences/layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout: l }),
    }).catch(() => {});
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

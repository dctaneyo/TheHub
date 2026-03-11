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
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Fetch layout preference from database on mount
  useEffect(() => {
    const fetchLayout = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setLoading(false);
          return;
        }

        const res = await fetch("/api/preferences/layout", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.layout && LAYOUT_OPTIONS.some((o) => o.id === data.layout)) {
            setLayoutState(data.layout as DashboardLayout);
          }
        }
      } catch (error) {
        console.error("Failed to fetch layout preference:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLayout();
  }, [user]);

  const setLayout = async (l: DashboardLayout) => {
    setLayoutState(l);

    // Save to database
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      await fetch("/api/preferences/layout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ layout: l }),
      });
    } catch (error) {
      console.error("Failed to save layout preference:", error);
    }
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

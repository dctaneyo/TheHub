"use client";

import { motion } from "framer-motion";
import { ClipboardList, MessageCircle, Smile, CalendarDays, Menu } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useReducedMotion, ANIMATION } from "@/lib/animation-constants";

const TABS = [
  { id: "tasks", icon: ClipboardList, label: "Tasks" },
  { id: "chat", icon: MessageCircle, label: "Chat" },
  { id: "mood", icon: Smile, label: "Mood" },
  { id: "calendar", icon: CalendarDays, label: "Calendar" },
  { id: "menu", icon: Menu, label: "Menu" },
] as const;

export interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenChat: () => void;
  onOpenMood: () => void;
  onOpenCalendar: () => void;
  onOpenMenu: () => void;
}

export function BottomNav({
  activeTab,
  onTabChange,
  onOpenChat,
  onOpenMood,
  onOpenCalendar,
  onOpenMenu,
}: BottomNavProps) {
  const prefersReducedMotion = useReducedMotion();

  const handleTabPress = (tabId: string) => {
    switch (tabId) {
      case "chat":
        onOpenChat();
        break;
      case "mood":
        onOpenMood();
        break;
      case "calendar":
        onOpenCalendar();
        break;
      case "menu":
        // Dispatch the same event the header uses to open Hub Menu
        window.dispatchEvent(
          new CustomEvent("mirror:panel-change", {
            detail: { hubMenuOpen: true },
          })
        );
        onOpenMenu();
        break;
      default:
        onTabChange(tabId);
    }
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 h-16 bg-white/5 backdrop-blur-xl border-t border-white/10 flex items-center justify-around px-2 z-[100] sm:hidden"
      role="tablist"
      aria-label="Main navigation"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
            onClick={() => handleTabPress(tab.id)}
            className="flex flex-col items-center justify-center gap-0.5 h-10 w-10 min-w-[40px] min-h-[40px] rounded-lg transition-colors"
          >
            <Icon
              className={cn(
                "h-5 w-5 transition-colors",
                isActive
                  ? "text-foreground fill-current"
                  : "text-muted-foreground"
              )}
            />
            {isActive && (
              <motion.div
                layoutId="bottom-nav-dot"
                className="h-1 w-1 rounded-full bg-[var(--hub-red)]"
                transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
            <span
              className={cn(
                "text-[10px] leading-none",
                isActive
                  ? "text-foreground font-bold"
                  : "text-muted-foreground"
              )}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

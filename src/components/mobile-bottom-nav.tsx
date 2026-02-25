"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, MessageCircle, CalendarDays, Trophy, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface MobileBottomNavProps {
  activeView: string;
  onViewChange: (view: string) => void;
  unreadCount?: number;
  userType: "location" | "arl";
}

const locationTabs = [
  { id: "tasks", label: "Tasks", icon: CheckCircle2 },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "leaderboard", label: "Board", icon: Trophy },
];

const arlTabs = [
  { id: "overview", label: "Home", icon: CheckCircle2 },
  { id: "messages", label: "Chat", icon: MessageCircle },
  { id: "tasks", label: "Tasks", icon: CalendarDays },
  { id: "leaderboard", label: "Board", icon: Trophy },
  { id: "more", label: "More", icon: MoreHorizontal },
];

export function MobileBottomNav({ activeView, onViewChange, unreadCount = 0, userType }: MobileBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const tabs = userType === "arl" ? arlTabs : locationTabs;

  return (
    <>
      {/* More menu overlay for ARL */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[140] bg-black/20"
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-[calc(env(safe-area-inset-bottom)+64px)] left-2 right-2 z-[141] rounded-2xl border border-border bg-card p-2 shadow-xl"
            >
              {[
                { id: "locations", label: "Locations" },
                { id: "meetings", label: "Meetings" },
                { id: "forms", label: "Forms" },
                { id: "analytics", label: "Analytics" },
                { id: "data-management", label: "Data Mgmt" },
                { id: "users", label: "Users" },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => { onViewChange(item.id); setMoreOpen(false); }}
                  className={cn(
                    "w-full rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-colors",
                    activeView === item.id ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-[130] border-t border-border bg-card/95 backdrop-blur-lg md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex h-16 items-center justify-around px-2">
          {tabs.map(tab => {
            const isActive = tab.id === "more" ? moreOpen : activeView === tab.id;
            const badge = tab.id === "chat" || tab.id === "messages" ? unreadCount : 0;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === "more") {
                    setMoreOpen(!moreOpen);
                  } else {
                    setMoreOpen(false);
                    onViewChange(tab.id);
                  }
                }}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-colors min-w-[56px]",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div className="relative">
                  <tab.icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
                  {badge > 0 && (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </div>
                <span className={cn("text-[10px] font-medium", isActive && "font-semibold")}>{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute -top-0.5 left-3 right-3 h-0.5 rounded-full bg-primary"
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

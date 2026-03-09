"use client";

import { format } from "date-fns";
import {
  LogOut,
  MessageCircle,
  CalendarDays,
  FileText,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { ConnectionStatus } from "@/components/connection-status";
import { NotificationBell } from "@/components/notification-bell";
import { DashboardSettings } from "@/components/dashboard/dashboard-settings";
import { type TaskItem } from "@/components/dashboard/timeline";
import { GamificationHub } from "@/components/dashboard/gamification-hub";

interface MinimalHeaderProps {
  user: { id?: string; name?: string; storeNumber?: string } | null;
  displayTime: string;
  allTasks: TaskItem[];
  currentTime: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  screensaverEnabled: boolean;
  onToggleScreensaver: () => void;
  onShowScreensaver: () => void;
  chatOpen: boolean;
  onToggleChat: () => void;
  chatUnread: number;
  onOpenForms: () => void;
  onOpenCalendar: () => void;
  onLogout: () => void;
}

export function MinimalHeader({
  user,
  displayTime,
  allTasks,
  currentTime,
  soundEnabled,
  onToggleSound,
  screensaverEnabled,
  onToggleScreensaver,
  onShowScreensaver,
  chatOpen,
  onToggleChat,
  chatUnread,
  onOpenForms,
  onOpenCalendar,
  onLogout,
}: MinimalHeaderProps) {
  return (
    <header className="sticky top-0 flex h-12 shrink-0 items-center border-b border-border bg-card/80 backdrop-blur-md px-4 z-[100]">
      {/* Left: Logo + Store */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--hub-red)] shadow-sm">
          <span className="text-xs font-black text-white">H</span>
        </div>
        <div className="hidden md:block">
          <p className="text-xs font-bold text-foreground leading-none">
            {user?.name}
          </p>
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
            #{user?.storeNumber}
          </p>
        </div>
      </div>

      {/* Center: Time */}
      <div className="flex-1 flex justify-center">
        <div className="text-center">
          <p className="text-lg font-black tabular-nums tracking-tight text-foreground leading-none">
            {displayTime}
          </p>
          <p className="text-[9px] font-medium text-muted-foreground leading-none mt-0.5">
            {format(new Date(), "EEE, MMM d")}
          </p>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="hidden sm:block">
          <ConnectionStatus />
        </div>

        <button
          onClick={onOpenForms}
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Forms"
        >
          <FileText className="h-4 w-4" />
        </button>

        <button
          onClick={onOpenCalendar}
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Calendar"
        >
          <CalendarDays className="h-4 w-4" />
        </button>

        <button
          onClick={onToggleChat}
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Chat"
        >
          <MessageCircle className="h-4 w-4" />
          {chatUnread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--hub-red)] text-[8px] font-bold text-white">
              {chatUnread}
            </span>
          )}
        </button>

        <NotificationBell
          tasks={allTasks}
          currentTime={currentTime}
          soundEnabled={soundEnabled}
          locationId={user?.id}
        />

        <GamificationHub locationId={user?.id} />

        <div className="hidden sm:block">
          <DashboardSettings
            soundEnabled={soundEnabled}
            onToggleSound={onToggleSound}
            screensaverEnabled={screensaverEnabled}
            onToggleScreensaver={onToggleScreensaver}
            onShowScreensaver={onShowScreensaver}
          />
        </div>

        <button
          onClick={onLogout}
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

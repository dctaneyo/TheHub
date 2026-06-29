"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu as MenuIcon,
  Bell,
  BellOff,
  CheckCircle2,
  Wifi,
  WifiOff,
  Video,
  Moon,
  Sun,
  Monitor,
  MoreVertical,
  Settings,
} from "@/lib/icons";
import { useAuth } from "@/lib/auth-context";
import { OfflineIndicator } from "@/components/offline-indicator";
import { BroadcastStudio } from "@/components/arl/broadcast-studio";
import { StreamViewer } from "@/components/dashboard/stream-viewer";
import { MeetingRoomLiveKitCustom as MeetingRoom } from "@/components/meeting-room-livekit-custom";
import { cn } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";
import { useTheme } from "next-themes";
import { ArlSidebar, navItems } from "@/components/arl/arl-sidebar";
import { GlobalSearch } from "@/components/global-search";
import { NotificationBell } from "@/components/notification-bell";
import { NotificationSettingsPanel } from "@/components/arl/notification-settings-panel";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { PageIndicator } from "@/components/arl/page-indicator";
import {
  ArlDashboardProvider,
  useArlDashboard,
} from "@/lib/arl-dashboard-context";
import { useOnlineStatus } from "@/hooks/use-mobile-utils";
import type { ArlView } from "@/lib/arl-views";

export default function ArlLayout({ children }: { children: React.ReactNode }) {
  return (
    <ArlDashboardProvider>
      <ArlLayoutInner>{children}</ArlLayoutInner>
    </ArlDashboardProvider>
  );
}

function ArlLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const { theme } = useTheme();
  const isOnline = useOnlineStatus();
  const { isConnected: socketConnected } = useSocket();

  const {
    activeView,
    displayView,
    navigateToView,
    unreadCount,
    onlineCount,
    joiningMeeting,
    setJoiningMeeting,
    setLeftMeetingId,
    activeBroadcast,
    setActiveBroadcast,
    watchingBroadcast,
    setWatchingBroadcast,
    showBroadcastNotification,
    setShowBroadcastNotification,
    notificationPermission,
    pushSubscription,
    requestNotificationPermission,
    sidebarOpen,
    setSidebarOpen,
    isMobileOrTablet,
    cycleTheme,
    sessionCode,
    sessionCount,
    toasts,
    notifToast,
  } = useArlDashboard();

  // Opens NotificationSettingsPanel directly — the only entry point to it
  // used to be through NotificationBell's dropdown, which no longer renders
  // on desktop (Section 18: nothing the bell showed isn't already visible
  // elsewhere on desktop). This keeps the settings panel itself reachable
  // from either device, per the decided direction.
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);

  return (
    <div className="flex h-screen h-dvh w-screen overflow-hidden bg-[var(--background)]" style={{ overscrollBehavior: "none" }}>
      {/* Offline indicator with sync status */}
      <OfflineIndicator />

      {/* Sidebar - always visible on desktop, drawer on mobile/tablet */}
      {/* Hide sidebar on mobile when in a meeting */}
      {isMobileOrTablet && sidebarOpen && !joiningMeeting && activeView !== "broadcast" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[140] bg-black/30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {!joiningMeeting && activeView !== "broadcast" && (
        <ArlSidebar
          user={user}
          activeView={displayView}
          onViewChange={(view) => {
            navigateToView(view as ArlView);
          }}
          isMobileOrTablet={isMobileOrTablet}
          sidebarOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          unreadCount={unreadCount}
          onlineCount={onlineCount}
          onLogout={logout}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar - hide on mobile when in meeting */}
        {!joiningMeeting && activeView !== "broadcast" && (
          <header className={cn(
            "flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4",
            isMobileOrTablet ? "fixed top-0 left-0 right-0 z-[100]" : "sticky top-0 z-[100]"
          )}>
          <div className="flex items-center gap-3">
            {isMobileOrTablet && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground"
              >
                <MenuIcon className="h-4.5 w-4.5" />
              </button>
            )}
            <h2 className="text-lg font-semibold text-foreground hidden sm:block">
              {navItems.find((n) => n.id === displayView)?.label ?? ""}
            </h2>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <GlobalSearch onNavigate={(type) => {
              if (type === "task") navigateToView("tasks");
              else if (type === "message") navigateToView("messages");
              else if (type === "form") navigateToView("forms");
              else if (type === "location") navigateToView("locations");
            }} />
            {/* NotificationBell only earns its place on mobile/PWA, where
                the point of a bell (surfacing things you'd otherwise miss)
                is real. On desktop, everything it would show is already
                visible elsewhere in the app (Section 18). */}
            {isMobileOrTablet && <NotificationBell />}

            {/* Quick Settings — Connection Status (changes constantly) is a
                plain status row; Theme/Notifications (rarely touched) are
                grouped below a separator (Section 12 cadence grouping). */}
            <Menu>
              <MenuTrigger className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground active:bg-accent transition-colors outline-none">
                <MoreVertical className="h-4.5 w-4.5" />
                <div className={cn(
                  "absolute top-1 right-1 h-2 w-2 rounded-full border border-background",
                  isOnline && socketConnected ? "bg-emerald-500" : "bg-red-500"
                )} />
              </MenuTrigger>
              <MenuContent className="w-64">
                {/* Connection Status — informational, not an action */}
                <div className="px-3 py-2 mb-1 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg",
                      isOnline && socketConnected ? "bg-emerald-100 dark:bg-emerald-950/50" : "bg-red-100 dark:bg-red-950/50"
                    )}>
                      {isOnline && socketConnected ? (
                        <Wifi className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <WifiOff className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        {isOnline && socketConnected ? "Connected" : "Offline"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isOnline && socketConnected
                          ? sessionCode
                            ? <>
                                <span className="font-mono font-semibold tracking-wider">#{sessionCode}</span>
                                {sessionCount > 1 && <span> · +{sessionCount - 1} other{sessionCount > 2 ? "s" : ""}</span>}
                              </>
                            : "Server reachable"
                          : "Check your connection"}
                      </p>
                    </div>
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      isOnline && socketConnected ? "bg-emerald-500" : "bg-red-500"
                    )} />
                  </div>
                </div>

                <MenuItem value="theme" onClick={cycleTheme} className="py-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    {theme === "dark" ? (
                      <Moon className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                    ) : theme === "light" ? (
                      <Sun className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                      <Monitor className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-foreground">Theme</p>
                    <p className="font-normal text-muted-foreground capitalize">{theme || "system"}</p>
                  </div>
                  <span className="font-normal text-muted-foreground">Tap to cycle</span>
                </MenuItem>

                {pushSubscription ? (
                  <div className="px-3 py-2 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/50">
                      <Bell className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">Notifications</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">Enabled</p>
                    </div>
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  </div>
                ) : notificationPermission === "denied" ? (
                  <div className="px-3 py-2 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950/50">
                      <BellOff className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">Notifications</p>
                      <p className="text-xs text-red-600 dark:text-red-400">Blocked by browser</p>
                    </div>
                  </div>
                ) : (
                  <MenuItem value="enable-push" onClick={requestNotificationPermission} className="py-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                      <Bell className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-foreground">Notifications</p>
                      <p className="font-normal text-muted-foreground">Tap to enable</p>
                    </div>
                  </MenuItem>
                )}

                <MenuSeparator />

                <MenuItem value="notification-settings" onClick={() => setShowNotificationSettings(true)} className="py-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    <Settings className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <p className="text-foreground">Notification Settings</p>
                </MenuItem>
              </MenuContent>
            </Menu>

          </div>
          </header>
        )}

        {/* Spacer for fixed header on mobile */}
        {isMobileOrTablet && !joiningMeeting && activeView !== "broadcast" && (
          <div className="h-14 shrink-0" />
        )}

        {/* Content area */}
        <main className={cn(
          "flex-1 flex flex-col overflow-hidden relative",
          isMobileOrTablet ? "pb-16" : ""
        )}>
          <div className="flex flex-col flex-1 h-full min-h-0 relative">
            {/* Route loading skeleton — shows during navigation transitions */}
            {displayView !== activeView && (
              <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-[2px] flex flex-col p-6 gap-4 animate-in fade-in duration-150">
                <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
                <div className="flex gap-4 flex-1">
                  <div className="flex-1 flex flex-col gap-3">
                    <div className="h-24 rounded-xl bg-muted animate-pulse" />
                    <div className="h-24 rounded-xl bg-muted animate-pulse delay-75" />
                    <div className="h-24 rounded-xl bg-muted animate-pulse delay-150" />
                  </div>
                  <div className="hidden lg:flex flex-col gap-3 w-72">
                    <div className="h-32 rounded-xl bg-muted animate-pulse" />
                    <div className="h-32 rounded-xl bg-muted animate-pulse delay-75" />
                  </div>
                </div>
              </div>
            )}
            {children}
          </div>
        </main>

        {/* Mobile page indicator - sticky at bottom like iPhone */}
        {isMobileOrTablet && (
          <PageIndicator
            pages={navItems.map(item => ({ id: item.id, label: item.label }))}
            currentPageId={displayView}
            onPageChange={(view) => navigateToView(view as ArlView)}
            className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-50"
          />
        )}
      </div>

      <NotificationSettingsPanel
        open={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
      />

      {/* Broadcast Studio */}
      <BroadcastStudio
        isOpen={activeView === "broadcast"}
        onClose={(leftMeeting?: string) => {
          navigateToView("meetings");
          // If they left (not ended) a meeting, track it for rejoin
          if (leftMeeting) {
            setLeftMeetingId(leftMeeting);
            // Refresh active meetings list
            socket?.emit("meeting:list");
          }
        }}
      />

      {/* Direct join: ARL joining an existing meeting from active meetings list */}
      {joiningMeeting && (
        <MeetingRoom
          meetingId={joiningMeeting.meetingId}
          title={joiningMeeting.title}
          isHost={false}
          onLeave={() => {
            setJoiningMeeting(null);
            socket?.emit("meeting:list");
          }}
        />
      )}

      {/* Task completion toasts — suppressed on Overview, since the merged
          Live Feed there already shows the identical event live with
          history; everywhere else this is the only cross-page awareness
          mechanism for it (Section 18). */}
      {displayView !== "overview" && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          <AnimatePresence>
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 24, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-card px-4 py-3 shadow-xl"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{toast.locationName}</p>
                  <p className="text-xs text-muted-foreground truncate">Completed: {toast.taskTitle}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Notification permission toast */}
      <AnimatePresence>
        {notifToast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className={cn(
              "fixed bottom-4 left-1/2 -translate-x-1/2 z-[999] rounded-2xl border px-5 py-3 shadow-xl text-sm font-semibold",
              notifToast.type === "success"
                ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                : "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
            )}
          >
            {notifToast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Broadcast Notification Popup for other ARLs */}
      <AnimatePresence>
        {showBroadcastNotification && activeBroadcast && !watchingBroadcast && activeView !== "broadcast" && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-card rounded-2xl shadow-xl border border-red-200 dark:border-red-900 p-5 max-w-sm w-full">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
                  <Video className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-semibold text-red-600 uppercase">Live Now</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate">{activeBroadcast.title}</p>
                  <p className="text-xs text-muted-foreground">by {activeBroadcast.arlName}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setWatchingBroadcast(true);
                    setShowBroadcastNotification(false);
                  }}
                  className="flex-1 bg-red-600 active:bg-red-700 text-white font-semibold text-sm py-2 px-4 rounded-xl transition-colors"
                >
                  Join Broadcast
                </button>
                <button
                  onClick={() => setShowBroadcastNotification(false)}
                  className="px-4 py-2 text-sm font-semibold text-muted-foreground active:text-foreground active:bg-muted rounded-xl transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ARL watching another ARL's broadcast */}
      {watchingBroadcast && activeBroadcast && (
        <StreamViewer
          broadcastId={activeBroadcast.broadcastId}
          arlName={activeBroadcast.arlName}
          title={activeBroadcast.title}
          onClose={() => {
            setWatchingBroadcast(false);
            setActiveBroadcast(null);
          }}
        />
      )}

    </div>
  );
}

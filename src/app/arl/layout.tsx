"use client";

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  Bell,
  BellOff,
  Zap,
  CheckCircle2,
  Wifi,
  WifiOff,
  Video,
  Moon,
  Sun,
  Monitor,
  MoreVertical,
} from "@/lib/icons";
import { useAuth } from "@/lib/auth-context";
import { OfflineIndicator } from "@/components/offline-indicator";
import { HighFiveAnimation } from "@/components/high-five-animation";
import { SocialActionsMenu } from "@/components/social-actions-menu";
import { BroadcastStudio } from "@/components/arl/broadcast-studio";
import { StreamViewer } from "@/components/dashboard/stream-viewer";
import { MeetingRoomLiveKitCustom as MeetingRoom } from "@/components/meeting-room-livekit-custom";
import { cn } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";
import { useTheme } from "next-themes";
import { ArlSidebar, navItems } from "@/components/arl/arl-sidebar";
import { GlobalSearch } from "@/components/global-search";
import { NotificationBell } from "@/components/notification-bell";
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

  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const quickSettingsRef = useRef<HTMLDivElement>(null);

  // Close quick settings on click outside
  useEffect(() => {
    if (!showQuickSettings) return;
    const handleClick = (e: MouseEvent) => {
      if (quickSettingsRef.current && !quickSettingsRef.current.contains(e.target as Node)) {
        setShowQuickSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showQuickSettings]);

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
                <Menu className="h-4.5 w-4.5" />
              </button>
            )}
            <h2 className="text-base font-bold text-foreground hidden sm:block">
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
            <NotificationBell />
            {/* Quick Settings — combines connection, theme, and push notification controls */}
            <div className="relative" ref={quickSettingsRef}>
              <button
                onClick={() => setShowQuickSettings((v) => !v)}
                className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-accent transition-colors"
                title="Settings"
              >
                <MoreVertical className="h-4.5 w-4.5" />
                {/* Connection status dot */}
                <div className={cn(
                  "absolute top-1 right-1 h-2 w-2 rounded-full border border-background",
                  isOnline && socketConnected ? "bg-emerald-500" : "bg-red-500"
                )} />
              </button>
              <AnimatePresence>
                {showQuickSettings && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 z-[200] w-56 rounded-xl border border-border bg-card shadow-lg overflow-hidden"
                  >
                    {/* Connection Status */}
                    <div className="px-3 py-2.5 border-b border-border">
                      <div className="flex items-center gap-2.5">
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
                          <p className="text-[10px] text-muted-foreground">
                            {isOnline && socketConnected
                              ? sessionCode
                                ? <>
                                    <span className="font-mono font-bold tracking-wider">#{sessionCode}</span>
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

                    {/* Theme Toggle */}
                    <button
                      onClick={cycleTheme}
                      className="w-full px-3 py-2.5 border-b border-border flex items-center gap-2.5 hover:bg-accent transition-colors"
                    >
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
                        <p className="text-xs font-semibold text-foreground">Theme</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{theme || "system"}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Tap to cycle</span>
                    </button>

                    {/* Push Notifications */}
                    {pushSubscription ? (
                      <div className="px-3 py-2.5 flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/50">
                          <Bell className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground">Notifications</p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Enabled</p>
                        </div>
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      </div>
                    ) : notificationPermission === "denied" ? (
                      <div className="px-3 py-2.5 flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950/50">
                          <BellOff className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground">Notifications</p>
                          <p className="text-[10px] text-red-600 dark:text-red-400">Blocked by browser</p>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { requestNotificationPermission(); setShowQuickSettings(false); }}
                        className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-accent transition-colors"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                          <Bell className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-xs font-semibold text-foreground">Notifications</p>
                          <p className="text-[10px] text-muted-foreground">Tap to enable</p>
                        </div>
                      </button>
                    )}

                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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
          <div className="flex flex-col flex-1 h-full min-h-0">
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

      {/* Task completion toasts */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
              className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-card px-4 py-3 shadow-xl shadow-emerald-100"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{toast.locationName}</p>
                <p className="text-xs text-muted-foreground truncate">Completed: {toast.taskTitle}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1">
                <Zap className="h-3 w-3 text-amber-500" />
                <span className="text-xs font-bold text-amber-700">+{toast.pointsEarned}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Notification permission toast */}
      <AnimatePresence>
        {notifToast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className={cn(
              "fixed bottom-4 left-1/2 -translate-x-1/2 z-[999] rounded-2xl border px-5 py-3 shadow-xl text-sm font-medium",
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
            <div className="bg-card rounded-2xl shadow-2xl border border-red-200 dark:border-red-900 p-5 max-w-sm w-full">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
                  <Video className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-bold text-red-600 uppercase">Live Now</span>
                  </div>
                  <p className="text-sm font-bold text-foreground truncate">{activeBroadcast.title}</p>
                  <p className="text-xs text-muted-foreground">by {activeBroadcast.arlName}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setWatchingBroadcast(true);
                    setShowBroadcastNotification(false);
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 px-4 rounded-xl transition-colors"
                >
                  Join Broadcast
                </button>
                <button
                  onClick={() => setShowBroadcastNotification(false)}
                  className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
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

      {/* High-Five Animation */}
      <HighFiveAnimation />

      {/* Social Actions Menu */}
      <SocialActionsMenu userType="arl" userId={user?.id} userName={user?.name} />
    </div>
  );
}

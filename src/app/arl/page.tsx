"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  LogOut,
  MessageCircle,
  ClipboardList,
  Users,
  Store,
  FileText,
  Settings,
  BarChart3,
  Menu,
  X,
  ChevronRight,
  CalendarDays,
  ChevronLeft,
  Clock,
  SprayCan,
  Repeat,
  Radio,
  Bell,
  BellOff,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { ConnectionStatus } from "@/components/connection-status";
import { TaskManager } from "@/components/arl/task-manager";
import { LocationsManager } from "@/components/arl/locations-manager";
import { Messaging } from "@/components/arl/messaging";
import { FormsRepository } from "@/components/arl/forms-repository";
import { UserManagement } from "@/components/arl/user-management";
import { EmergencyBroadcast } from "@/components/arl/emergency-broadcast";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { cn } from "@/lib/utils";

type DeviceType = "desktop" | "tablet" | "mobile";
type ArlView = "overview" | "messages" | "tasks" | "calendar" | "locations" | "forms" | "emergency" | "users";

function useDeviceType(): DeviceType {
  const [device, setDevice] = useState<DeviceType>("desktop");

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      if (w < 640) setDevice("mobile");
      else if (w < 1024) setDevice("tablet");
      else setDevice("desktop");
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return device;
}

const navItems = [
  { id: "overview" as const, label: "Overview", icon: BarChart3 },
  { id: "messages" as const, label: "Messages", icon: MessageCircle },
  { id: "tasks" as const, label: "Tasks & Reminders", icon: ClipboardList },
  { id: "calendar" as const, label: "Calendar", icon: CalendarDays },
  { id: "locations" as const, label: "Locations", icon: Store },
  { id: "forms" as const, label: "Forms", icon: FileText },
  { id: "emergency" as const, label: "Emergency Broadcast", icon: Radio },
  { id: "users" as const, label: "Users", icon: Users },
];

export default function ArlPage() {
  const { user, logout } = useAuth();
  const device = useDeviceType();
  const [activeView, setActiveView] = useState<ArlView>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);

  const isMobileOrTablet = device === "mobile" || device === "tablet";

  // Heartbeat to keep ARL session alive (every 2 minutes)
  useEffect(() => {
    const ping = () => fetch("/api/session/heartbeat", { method: "POST" }).catch(() => {});
    ping();
    const interval = setInterval(ping, 120000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/messages");
        if (res.ok) {
          const data = await res.json();
          const total = (data.conversations || []).reduce((s: number, c: { unreadCount: number }) => s + c.unreadCount, 0);
          setUnreadCount(total);
        }
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, []);

  // Request notification permission and subscribe to push
  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      alert("This browser doesn't support notifications");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      // Register service worker and subscribe
      if ("serviceWorker" in navigator && "PushManager" in window) {
        const registration = await navigator.serviceWorker.register("/sw.js");
        console.log("SW registered");

        try {
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
          });

          console.log("Push subscribed:", subscription);
          setPushSubscription(subscription);

          // Send subscription to server
          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(subscription),
          });

          alert("Notifications enabled! You'll receive alerts for new messages.");
        } catch (err) {
          console.error("Push subscription failed:", err);
          alert("Failed to enable push notifications. Check console for details.");
        }
      }
    } else {
      alert("Notification permission denied. You won't receive message alerts.");
    }
  };

  // Check notification permission and existing subscription
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }

    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        console.log("SW registered");

        // Check existing subscription
        registration.pushManager.getSubscription().then((subscription) => {
          if (subscription) {
            console.log("Existing push subscription found");
            setPushSubscription(subscription);
          } else if (Notification.permission === "granted") {
            // Try to subscribe if permission granted but no subscription
            registration.pushManager
              .subscribe({
                userVisibleOnly: true,
                applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
              })
              .then((sub) => {
                console.log("Push subscribed:", sub);
                setPushSubscription(sub);
                fetch("/api/push/subscribe", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(sub),
                }).catch(console.error);
              })
              .catch((err) => {
                console.log("Push subscription failed:", err);
              });
          }
        });
      });
    }
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--background)]">
      {/* Sidebar - always visible on desktop, drawer on mobile/tablet */}
      {isMobileOrTablet && sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <motion.aside
        className={cn(
          "z-50 flex flex-col border-r border-slate-200 bg-white",
          isMobileOrTablet
            ? "fixed inset-y-0 left-0 w-[280px] shadow-xl"
            : "relative w-[260px] shrink-0"
        )}
        initial={isMobileOrTablet ? { x: -280 } : false}
        animate={
          isMobileOrTablet
            ? { x: sidebarOpen ? 0 : -280 }
            : { x: 0 }
        }
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Sidebar header */}
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--hub-red)] shadow-sm">
              <span className="text-sm font-black text-white">H</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800">The Hub</h1>
              <p className="text-[10px] text-slate-400">ARL Dashboard</p>
            </div>
          </div>
          {isMobileOrTablet && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* User info */}
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
          <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            const badge = item.id === "messages" && unreadCount > 0 ? unreadCount : 0;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveView(item.id);
                  if (item.id === "messages") setUnreadCount(0);
                  if (isMobileOrTablet) setSidebarOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-[var(--hub-red)] text-white shadow-sm shadow-red-200"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <item.icon className="h-4.5 w-4.5 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {badge > 0 && (
                  <span className={cn(
                    "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                    isActive ? "bg-white text-[var(--hub-red)]" : "bg-[var(--hub-red)] text-white"
                  )}>
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-slate-200 p-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4.5 w-4.5" />
            Sign Out
          </button>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
          <div className="flex items-center gap-3">
            {isMobileOrTablet && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>
            )}
            <h2 className="text-base font-bold text-slate-800">
              {navItems.find((n) => n.id === activeView)?.label ?? ""}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Notification Status */}
            {pushSubscription ? (
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1">
                <Bell className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-700">On</span>
              </div>
            ) : notificationPermission === "denied" ? (
              <div className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1">
                <BellOff className="h-3.5 w-3.5 text-red-600" />
                <span className="text-xs font-medium text-red-700">Off</span>
              </div>
            ) : (
              <button
                onClick={requestNotificationPermission}
                className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 hover:bg-slate-200 transition-colors"
                title="Enable push notifications"
              >
                <Bell className="h-3.5 w-3.5 text-slate-600" />
                <span className="text-xs font-medium text-slate-700">Enable</span>
              </button>
            )}
            <ConnectionStatus />
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-5">
          {activeView === "overview" && <OverviewContent />}
          {activeView === "messages" && <Messaging />}
          {activeView === "tasks" && <TaskManager />}
          {activeView === "calendar" && <ArlCalendar />}
          {activeView === "locations" && <LocationsManager />}
          {activeView === "forms" && <FormsRepository />}
          {activeView === "emergency" && <EmergencyBroadcast />}
          {activeView === "users" && <UserManagement />}
        </main>
      </div>
    </div>
  );
}

function OverviewContent() {
  const [locations, setLocations] = useState<Array<{ id: string; name: string; storeNumber: string; isOnline: boolean; lastSeen: string | null; sessionCode: string | null }>>([]);
  const [arls, setArls] = useState<Array<{ id: string; name: string; role: string; isOnline: boolean; lastSeen: string | null; sessionCode: string | null }>>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [formCount, setFormCount] = useState(0);

  useEffect(() => {
    const load = () => Promise.all([
      fetch("/api/locations").then((r) => r.ok ? r.json() : { locations: [], arls: [] }),
      fetch("/api/tasks").then((r) => r.ok ? r.json() : { tasks: [] }),
      fetch("/api/messages").then((r) => r.ok ? r.json() : { conversations: [] }),
      fetch("/api/forms").then((r) => r.ok ? r.json() : { forms: [] }),
    ]).then(([locData, taskData, msgData, formData]) => {
      setLocations(locData.locations || []);
      setArls(locData.arls || []);
      setTaskCount((taskData.tasks || []).length);
      setUnreadCount((msgData.conversations || []).reduce((s: number, c: { unreadCount: number }) => s + c.unreadCount, 0));
      setFormCount((formData.forms || []).length);
    });
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const onlineLocations = locations.filter((l) => l.isOnline);
  const onlineArls = arls.filter((a) => a.isOnline);

  const stats = [
    { label: "Locations Online", value: `${onlineLocations.length}/${locations.length}`, color: "bg-emerald-50 text-emerald-700", icon: Store },
    { label: "ARLs Online", value: `${onlineArls.length}/${arls.length}`, color: "bg-sky-50 text-sky-700", icon: Users },
    { label: "Tasks Today", value: String(taskCount), color: "bg-blue-50 text-blue-700", icon: ClipboardList },
    { label: "Unread Messages", value: String(unreadCount), color: "bg-purple-50 text-purple-700", icon: MessageCircle },
    { label: "Forms Available", value: String(formCount), color: "bg-amber-50 text-amber-700", icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">{stat.value}</p>
              </div>
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", stat.color)}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-slate-800">Active Sessions</h3>
          <span className="text-[10px] text-slate-400">{onlineLocations.length + onlineArls.length} online</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">Only showing currently connected sessions</p>

        {onlineArls.length === 0 && onlineLocations.length === 0 && (
          <p className="text-xs text-slate-400 py-4 text-center">No active sessions right now</p>
        )}

        {onlineArls.length > 0 && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">ARLs</p>
            <div className="space-y-2 mb-4">
              {onlineArls.map((arl) => (
                <div key={arl.id} className="flex items-center justify-between rounded-xl bg-sky-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                    <div>
                      <span className="text-sm font-medium text-slate-700">{arl.name}</span>
                      <span className="ml-2 text-[10px] text-slate-400">ARL</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {arl.sessionCode && (
                      <span className="font-mono text-xs font-bold tracking-widest text-sky-700 bg-sky-100 rounded-lg px-2 py-0.5">
                        #{arl.sessionCode}
                      </span>
                    )}
                    <span className="text-xs font-medium text-sky-600">Online</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {onlineLocations.length > 0 && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Restaurants</p>
            <div className="space-y-2">
              {onlineLocations.map((loc) => (
                <div key={loc.id} className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <div>
                      <span className="text-sm font-medium text-slate-700">{loc.name}</span>
                      <span className="ml-2 text-[10px] text-slate-400">#{loc.storeNumber}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {loc.sessionCode && (
                      <span className="font-mono text-xs font-bold tracking-widest text-emerald-700 bg-emerald-100 rounded-lg px-2 py-0.5">
                        #{loc.sessionCode}
                      </span>
                    )}
                    <span className="text-xs font-medium text-emerald-600">Online</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Weekly Leaderboard */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Leaderboard />
      </div>
    </div>
  );
}

interface CalTask {
  id: string; title: string; type: string; priority: string;
  dueTime: string; dueDate: string | null; isRecurring: boolean;
  recurringType: string | null; recurringDays: string | null; locationId: string | null;
}

const CAL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CAL_DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const calTypeIcons: Record<string, typeof ClipboardList> = { task: ClipboardList, cleaning: SprayCan, reminder: Clock };

function calTaskApplies(task: CalTask, date: Date): boolean {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayKey = CAL_DAY_KEYS[date.getDay()];
  if (!task.isRecurring) return task.dueDate === dateStr;
  const rType = task.recurringType || "weekly";
  if (rType === "daily") return true;
  if (rType === "weekly") { try { return (JSON.parse(task.recurringDays!) as string[]).includes(dayKey); } catch { return false; } }
  if (rType === "biweekly") { try { const days = JSON.parse(task.recurringDays!) as string[]; if (!days.includes(dayKey)) return false; const anchorDate = (task as any).createdAt ? new Date((task as any).createdAt) : new Date(0); const anchorDay = anchorDate.getDay(); const anchorMon = new Date(anchorDate); anchorMon.setDate(anchorDate.getDate() + (anchorDay === 0 ? -6 : 1 - anchorDay)); anchorMon.setHours(0,0,0,0); const targetDay = date.getDay(); const targetMon = new Date(date); targetMon.setDate(date.getDate() + (targetDay === 0 ? -6 : 1 - targetDay)); targetMon.setHours(0,0,0,0); const weeksDiff = Math.round((targetMon.getTime() - anchorMon.getTime()) / (7 * 86400000)); const isEven = weeksDiff % 2 === 0; return (task as any).biweeklyStart === "next" ? !isEven : isEven; } catch { return false; } }
  if (rType === "monthly") { try { return (JSON.parse(task.recurringDays!) as number[]).includes(date.getDate()); } catch { return false; } }
  return false;
}

function calTime12(t: string) { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; }

function ArlCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState<CalTask[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string; storeNumber: string }>>([]);
  const [filterLocationId, setFilterLocationId] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetch("/api/tasks"), fetch("/api/locations")]).then(async ([tr, lr]) => {
      if (tr.ok) { const d = await tr.json(); setTasks(d.tasks || []); }
      if (lr.ok) { const d = await lr.json(); setLocations(d.locations || []); }
      setLoading(false);
    });
  }, []);

  const filteredTasks = filterLocationId === "all"
    ? tasks
    : tasks.filter((t) => t.locationId === null || t.locationId === filterLocationId);

  const getTasksForDate = (date: Date) =>
    filteredTasks.filter((t) => (t as any).showInCalendar !== false && calTaskApplies(t, date)).sort((a, b) => a.dueTime.localeCompare(b.dueTime));

  const monthStart = startOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(endOfMonth(currentMonth));
  const weeks: Date[][] = [];
  let day = gridStart;
  while (day <= gridEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) { week.push(day); day = addDays(day, 1); }
    weeks.push(week);
  }

  const selectedTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Location filter */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-slate-600 shrink-0">Filter by location:</label>
        <select
          value={filterLocationId}
          onChange={(e) => setFilterLocationId(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm"
        >
          <option value="all">All Locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name} (#{l.storeNumber})</option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Calendar grid */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
            <h2 className="text-sm font-bold text-slate-800">{format(currentMonth, "MMMM yyyy")}</h2>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 border-b border-slate-100">
            {CAL_DAYS.map((d) => <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">{d}</div>)}
          </div>
          <div className="flex flex-1 flex-col overflow-hidden">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid flex-1 grid-cols-7 border-b border-slate-100 last:border-0" style={{ minHeight: 0 }}>
                {week.map((date) => {
                  const dayTasks = getTasksForDate(date);
                  const isSelected = selectedDate && isSameDay(date, selectedDate);
                  const inMonth = isSameMonth(date, currentMonth);
                  return (
                    <div key={date.toISOString()} role="button" tabIndex={0}
                      onClick={() => setSelectedDate(date)}
                      onKeyDown={(e) => e.key === "Enter" && setSelectedDate(date)}
                      className={cn("flex flex-col items-start justify-start border-r border-slate-100 p-1.5 text-left transition-colors last:border-0 cursor-pointer overflow-hidden",
                        !inMonth && "bg-slate-50/50",
                        isSelected && "bg-[var(--hub-red)]/5 ring-1 ring-inset ring-[var(--hub-red)]/20",
                        inMonth && !isSelected && "hover:bg-slate-50"
                      )}>
                      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                        isToday(date) ? "bg-[var(--hub-red)] text-white" : inMonth ? "text-slate-700" : "text-slate-300"
                      )}>{format(date, "d")}</span>
                      <div className="mt-0.5 space-y-0.5 overflow-hidden">
                        {dayTasks.slice(0, 2).map((task) => {
                          const Icon = calTypeIcons[task.type] || ClipboardList;
                          return (
                            <div key={task.id} className={cn("flex items-center gap-1 rounded px-1 py-0.5 text-[9px] font-medium truncate",
                              task.priority === "urgent" ? "bg-red-100 text-red-700" : task.priority === "high" ? "bg-orange-100 text-orange-700" :
                              task.type === "cleaning" ? "bg-purple-100 text-purple-700" : task.type === "reminder" ? "bg-sky-100 text-sky-700" : "bg-blue-100 text-blue-700"
                            )}>
                              <Icon className="h-2 w-2 shrink-0" /><span className="truncate">{task.title}</span>
                            </div>
                          );
                        })}
                        {dayTasks.length > 2 && <p className="pl-0.5 text-[9px] text-slate-400">+{dayTasks.length - 2}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Day detail */}
        <div className="w-[260px] shrink-0 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-800">{selectedDate ? format(selectedDate, "EEE, MMM d") : "Select a day"}</h3>
            <p className="text-[10px] text-slate-400">{selectedTasks.length} task{selectedTasks.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading && <div className="flex h-20 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--hub-red)]" /></div>}
            {!loading && selectedTasks.length === 0 && <p className="py-8 text-center text-xs text-slate-400">No tasks this day</p>}
            {selectedTasks.map((task) => {
              const Icon = calTypeIcons[task.type] || ClipboardList;
              const loc = locations.find((l) => l.id === task.locationId);
              return (
                <div key={task.id} className={cn("rounded-xl border p-3",
                  task.priority === "urgent" ? "border-red-200 bg-red-50" : task.priority === "high" ? "border-orange-200 bg-orange-50" : "border-slate-200 bg-slate-50"
                )}>
                  <div className="flex items-start gap-2">
                    <div className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg",
                      task.type === "cleaning" ? "bg-purple-100 text-purple-600" : task.type === "reminder" ? "bg-sky-100 text-sky-600" : "bg-blue-100 text-blue-600"
                    )}><Icon className="h-3 w-3" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{task.title}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                        <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{calTime12(task.dueTime)}</span>
                        {task.isRecurring && <span className="flex items-center gap-0.5"><Repeat className="h-2.5 w-2.5" />Recurring</span>}
                        <span className="text-slate-400">{loc ? loc.name : "All locations"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

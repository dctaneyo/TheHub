"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSocket } from "@/lib/socket-context";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday } from "date-fns";
import {
  LogOut,
  MessageCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  ClipboardList,
  SprayCan,
  Repeat,
  FileText,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Circle,
  Settings,
  Volume2,
  VolumeX,
  MonitorOff,
  Monitor,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { ConnectionStatus } from "@/components/connection-status";
import { Timeline, type TaskItem } from "@/components/dashboard/timeline";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { CompletedMissed } from "@/components/dashboard/completed-missed";
import { RestaurantChat } from "@/components/dashboard/restaurant-chat";
import { NotificationSystem } from "@/components/dashboard/notification-system";
import { FormsViewer } from "@/components/dashboard/forms-viewer";
import { EmergencyOverlay } from "@/components/dashboard/emergency-overlay";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { GamificationBar } from "@/components/dashboard/gamification-bar";
import { ConfettiBurst, CoinRain, Fireworks, useConfettiSound } from "@/components/dashboard/celebrations";
import { IdleScreensaver, useIdleTimer } from "@/components/dashboard/idle-screensaver";

interface TasksResponse {
  tasks: TaskItem[];
  completedToday: number;
  totalToday: number;
  missedYesterday: TaskItem[];
  pointsToday: number;
}

export default function DashboardPage() {
  const [screensaverEnabled, setScreensaverEnabled] = useState(true);
  const [forceIdle, setForceIdle] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const { idle: autoIdle, reset: resetIdle } = useIdleTimer(2 * 60 * 1000);
  const idle = screensaverEnabled && (autoIdle || forceIdle);

  // Load sound state from server on mount; listen for ARL-driven toggle
  const { socket: socketForSound } = useSocket();
  useEffect(() => {
    fetch('/api/locations/sound')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSoundEnabled(!d.muted); })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!socketForSound) return;
    const handler = (data: { muted: boolean }) => setSoundEnabled(!data.muted);
    socketForSound.on('location:sound-toggle', handler);
    return () => { socketForSound.off('location:sound-toggle', handler); };
  }, [socketForSound]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    fetch('/api/locations/sound', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ muted: !next }),
    }).catch(() => {});
  };

  // Close settings popover on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [settingsOpen]);

  const { user, logout } = useAuth();
  const [data, setData] = useState<TasksResponse | null>(null);
  const [upcomingTasks, setUpcomingTasks] = useState<Record<string, Array<{ id: string; title: string; dueTime: string; type: string; priority: string }>>>({});
  const [currentTime, setCurrentTime] = useState("");
  const [displayTime, setDisplayTime] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiPoints, setConfettiPoints] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [calOpen, setCalOpen] = useState(false);
  const [formsOpen, setFormsOpen] = useState(false);
  const [showCoinRain, setShowCoinRain] = useState(false);
  const [coinRainAmount, setCoinRainAmount] = useState(0);
  const [showFireworks, setShowFireworks] = useState(false);
  const playConfettiSound = useConfettiSound();

  const localTimeParams = () => {
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const localTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const localDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][now.getDay()];
    return `localDate=${localDate}&localTime=${localTime}&localDay=${localDay}`;
  };

  // Timestamp of last completion — suppresses socket-triggered fetchTasks
  // for 3s after a completion to prevent the optimistic update being overwritten.
  const completingRef = useRef(0);

  const fetchTasks = useCallback(async () => {
    if (Date.now() - completingRef.current < 3000) return;
    try {
      const [todayRes, upcomingRes] = await Promise.all([
        fetch(`/api/tasks/today?${localTimeParams()}`),
        fetch(`/api/tasks/upcoming?${localTimeParams()}`),
      ]);
      if (todayRes.ok) {
        const json = await todayRes.json();
        setData(json);
      }
      if (upcomingRes.ok) {
        const json = await upcomingRes.json();
        setUpcomingTasks(json.upcoming);
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    }
  }, []);

  // Hoist socket so it's available in the clock effect below
  const { socket, updateActivity } = useSocket();

  // Update current time every second for display; task logic still uses HH:mm.
  // Also detects midnight rollover and immediately re-fetches tasks for the new day.
  const currentDateRef = useRef<string>("");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      setCurrentTime(hhmm);
      const h = now.getHours();
      const m = now.getMinutes();
      const s = now.getSeconds();
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      setDisplayTime(`${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} ${ampm}`);
      // Detect date rollover (midnight) — emit to server so it reschedules timers;
      // server responds with task:updated which triggers fetchTasks via socket listener.
      if (currentDateRef.current && currentDateRef.current !== dateStr) {
        completingRef.current = 0;
        socket?.emit("client:day-reset");
        fetchTasks(); // immediate local re-fetch in case socket is momentarily slow
      }
      currentDateRef.current = dateStr;
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [fetchTasks, socket]);

  // Fetch tasks on mount + listen for instant WebSocket updates (no polling needed)
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!socket) return;
    const handleTaskUpdate = () => fetchTasks();
    socket.on("task:updated", handleTaskUpdate);
    socket.on("task:completed", handleTaskUpdate);
    return () => {
      socket.off("task:updated", handleTaskUpdate);
      socket.off("task:completed", handleTaskUpdate);
    };
  }, [socket, fetchTasks]);

  // Activity tracking — report which section the location is viewing
  useEffect(() => {
    const page = chatOpen ? "Chat" : calOpen ? "Calendar" : formsOpen ? "Forms" : "Dashboard";
    updateActivity(page);
  }, [chatOpen, calOpen, formsOpen, updateActivity]);

  const handleEarlyComplete = async (taskId: string, dateStr: string) => {
    try {
      const res = await fetch("/api/tasks/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, completedDate: dateStr }),
      });
      if (res.ok) {
        const result = await res.json();
        setConfettiPoints(result.pointsEarned || 0);
        if (result.bonusPoints > 0) {
          setCoinRainAmount(result.bonusPoints);
          setShowCoinRain(true);
          setTimeout(() => setShowCoinRain(false), 3000);
        } else {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 2800);
        }
        playConfettiSound();
        await fetchTasks();
      }
    } catch (err) {
      console.error("Failed to early-complete task:", err);
    }
  };

  const handleUncompleteTask = async (taskId: string) => {
    try {
      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      await fetch("/api/tasks/uncomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, localDate }),
      });
      // Reset the completion lock so fetchTasks isn't suppressed
      completingRef.current = 0;
      await fetchTasks();
    } catch (err) {
      console.error("Failed to uncomplete task:", err);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    // Record completion time — suppresses socket-triggered fetchTasks for 3s
    completingRef.current = Date.now();

    // Optimistic update — immediately mark completed so the UI never reverts
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, isCompleted: true, isOverdue: false, isDueSoon: false } : t
        ),
        completedToday: prev.completedToday + 1,
      };
    });

    try {
      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const res = await fetch("/api/tasks/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, localDate }),
      });

      if (res.ok) {
        const result = await res.json();
        setConfettiPoints(result.pointsEarned || 0);
        playConfettiSound();
        // Fetch confirmed state to check all-done and update points
        const updatedRes = await fetch(`/api/tasks/today?${localTimeParams()}`);
        if (updatedRes.ok) {
          const updated = await updatedRes.json();
          const allDone = (updated.tasks || []).length > 0 && (updated.tasks || []).every((t: any) => t.isCompleted);
          if (allDone) {
            setShowFireworks(true);
            setTimeout(() => setShowFireworks(false), 3500);
          } else {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 2800);
          }
          setData(updated);
        } else {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 2800);
        }
      } else {
        // Revert optimistic update on failure — bypass the lock
        completingRef.current = 0;
        await fetchTasks();
      }
    } catch (err) {
      console.error("Failed to complete task:", err);
      completingRef.current = 0;
      await fetchTasks();
    }
  };

  const completedTasks = data?.tasks.filter((t) => t.isCompleted) || [];
  const allTasks = data?.tasks || [];

  return (
    <div className="flex h-dvh w-screen flex-col overflow-hidden bg-[var(--background)]">
      {/* Top Bar */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--hub-red)] shadow-sm">
            <span className="text-base font-black text-white">H</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">The Hub</h1>
            <p className="text-[11px] text-slate-400">
              {user?.name} &middot; Store #{user?.storeNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Gamification */}
          <GamificationBar />

          {/* Connection status */}
          <ConnectionStatus />

          {/* Clock */}
          <div className="mx-1 text-right">
            <p className="text-2xl font-black tabular-nums tracking-tight text-slate-800">
              {displayTime}
            </p>
            <p className="text-[11px] font-medium text-slate-400">
              {format(new Date(), "EEE, MMM d yyyy")}
            </p>
          </div>

          {/* Action buttons */}
          <button
            onClick={() => setFormsOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
            title="Forms"
          >
            <FileText className="h-[18px] w-[18px]" />
          </button>

          <button
            onClick={() => setCalOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
          >
            <CalendarDays className="h-[18px] w-[18px]" />
          </button>

          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
          >
            <MessageCircle className="h-[18px] w-[18px]" />
            {chatUnread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--hub-red)] text-[10px] font-bold text-white">
                {chatUnread}
              </span>
            )}
          </button>

          <NotificationSystem
            tasks={allTasks}
            currentTime={currentTime}
            soundEnabled={soundEnabled}
            onToggleSound={toggleSound}
          />

          {/* Settings cog */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                settingsOpen ? "bg-slate-200 text-slate-800" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
              title="Settings"
            >
              <Settings className="h-[18px] w-[18px]" />
            </button>

            <AnimatePresence>
              {settingsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 z-50 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Dashboard Settings</p>
                  </div>

                  <div className="p-2 space-y-1">
                    {/* Sound toggle */}
                    <button
                      onClick={toggleSound}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        soundEnabled ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-400"
                      )}>
                        {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">Notification Sound</p>
                        <p className="text-[11px] text-slate-400">{soundEnabled ? "Sounds on" : "Muted"}</p>
                      </div>
                      <div className={cn(
                        "h-5 w-9 rounded-full transition-colors relative",
                        soundEnabled ? "bg-emerald-500" : "bg-slate-200"
                      )}>
                        <div className={cn(
                          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                          soundEnabled ? "translate-x-4" : "translate-x-0.5"
                        )} />
                      </div>
                    </button>

                    {/* Screensaver toggle */}
                    <button
                      onClick={() => setScreensaverEnabled((v) => !v)}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        screensaverEnabled ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"
                      )}>
                        {screensaverEnabled ? <Monitor className="h-4 w-4" /> : <MonitorOff className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">Screensaver</p>
                        <p className="text-[11px] text-slate-400">{screensaverEnabled ? "Auto after 2 min" : "Disabled"}</p>
                      </div>
                      <div className={cn(
                        "h-5 w-9 rounded-full transition-colors relative",
                        screensaverEnabled ? "bg-blue-500" : "bg-slate-200"
                      )}>
                        <div className={cn(
                          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                          screensaverEnabled ? "translate-x-4" : "translate-x-0.5"
                        )} />
                      </div>
                    </button>

                    {/* Manual invoke */}
                    <button
                      onClick={() => { setForceIdle(true); setSettingsOpen(false); }}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                        <Play className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">Show Screensaver</p>
                        <p className="text-[11px] text-slate-400">Preview now</p>
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={logout}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      {/* Main Content - 3 column layout, no scrolling */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column - Completed/Missed + Points (hidden on small screens) */}
        <div className="hidden md:block w-[280px] shrink-0 border-r border-slate-200 bg-white p-4">
          <CompletedMissed
            completedToday={completedTasks}
            missedYesterday={data?.missedYesterday || []}
            pointsToday={data?.pointsToday || 0}
            totalToday={data?.totalToday || 0}
          />
        </div>

        {/* Center Column - Main Timeline */}
        <div className="flex-1 p-5">
          {currentTime && (
            <Timeline
              tasks={allTasks}
              onComplete={handleCompleteTask}
              onUncomplete={handleUncompleteTask}
              currentTime={currentTime}
            />
          )}
        </div>

        {/* Right Column - Mini Calendar + Leaderboard tabs (hidden on small screens) */}
        <div className="hidden lg:flex lg:flex-col w-[300px] shrink-0 border-l border-slate-200 bg-white overflow-hidden">
          <RightPanel upcomingTasks={upcomingTasks} onEarlyComplete={handleEarlyComplete} currentLocationId={user?.id} />
        </div>
      </div>

      {/* Celebrations */}
      <ConfettiBurst active={showConfetti} points={confettiPoints} onComplete={() => setShowConfetti(false)} />
      <CoinRain active={showCoinRain} amount={coinRainAmount} onComplete={() => setShowCoinRain(false)} />
      <Fireworks active={showFireworks} onComplete={() => setShowFireworks(false)} />

      {/* Full Calendar Modal */}
      {calOpen && <CalendarModal onClose={() => setCalOpen(false)} locationId={user?.id} />}

      {/* Forms Viewer Modal */}
      {formsOpen && <FormsViewer onClose={() => setFormsOpen(false)} />}

      {/* Idle Screensaver */}
      <AnimatePresence>
        {idle && <IdleScreensaver onActivity={resetIdle} />}
      </AnimatePresence>

      {/* Emergency Broadcast Overlay */}
      <EmergencyOverlay />

      {/* Restaurant Chat Drawer */}
      <RestaurantChat
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        unreadCount={chatUnread}
        onUnreadChange={setChatUnread}
      />
    </div>
  );
}

function RightPanel({
  upcomingTasks,
  onEarlyComplete,
  currentLocationId,
}: {
  upcomingTasks: Record<string, Array<{ id: string; title: string; dueTime: string; type: string; priority: string; allowEarlyComplete?: boolean; isCompleted?: boolean }>>;
  onEarlyComplete: (taskId: string, dateStr: string) => void;
  currentLocationId?: string;
}) {
  const [tab, setTab] = useState<"calendar" | "leaderboard">("calendar");
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex shrink-0 border-b border-slate-100">
        <button
          onClick={() => setTab("calendar")}
          className={`flex-1 py-2.5 text-[11px] font-semibold transition-colors ${tab === "calendar" ? "border-b-2 border-[var(--hub-red)] text-[var(--hub-red)]" : "text-slate-400 hover:text-slate-600"}`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setTab("leaderboard")}
          className={`flex-1 py-2.5 text-[11px] font-semibold transition-colors ${tab === "leaderboard" ? "border-b-2 border-[var(--hub-red)] text-[var(--hub-red)]" : "text-slate-400 hover:text-slate-600"}`}
        >
          🏆 Leaderboard
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {tab === "calendar" ? (
          <MiniCalendar upcomingTasks={upcomingTasks} onEarlyComplete={onEarlyComplete} />
        ) : (
          <Leaderboard currentLocationId={currentLocationId} compact />
        )}
      </div>
    </div>
  );
}

interface CalModalTask {
  id: string; title: string; type: string; priority: string;
  dueTime: string; dueDate: string | null; isRecurring: boolean;
  recurringType: string | null; recurringDays: string | null; locationId: string | null;
  createdByType?: string; createdBy?: string; allowEarlyComplete?: boolean;
}
interface CalCompletion { taskId: string; completedDate: string; }
const CAL_DAYS_H = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const CAL_DAY_KEYS_H = ["sun","mon","tue","wed","thu","fri","sat"];
const calModalTypeIcons: Record<string, typeof ClipboardList> = { task: ClipboardList, cleaning: SprayCan, reminder: Clock };

function calModalTaskApplies(task: CalModalTask, date: Date): boolean {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayKey = CAL_DAY_KEYS_H[date.getDay()];
  if (!task.isRecurring) return task.dueDate === dateStr;
  const rType = task.recurringType || "weekly";
  if (rType === "daily") return true;
  if (rType === "weekly") { try { return (JSON.parse(task.recurringDays!) as string[]).includes(dayKey); } catch { return false; } }
  if (rType === "biweekly") { try { const days = JSON.parse(task.recurringDays!) as string[]; if (!days.includes(dayKey)) return false; const s = new Date(date.getFullYear(),0,1); const w = Math.ceil(((date.getTime()-s.getTime())/86400000+s.getDay()+1)/7); return w%2===0; } catch { return false; } }
  if (rType === "monthly") { try { return (JSON.parse(task.recurringDays!) as number[]).includes(date.getDate()); } catch { return false; } }
  return false;
}
function calModalTime12(t: string) { const [h,m] = t.split(":").map(Number); return `${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`; }

interface NewTaskForm {
  title: string;
  type: string;
  dueTime: string;
  dueDate: string;
  isRecurring: boolean;
  recurringType: string;
}
const EMPTY_TASK_FORM: NewTaskForm = { title: "", type: "task", dueTime: "09:00", dueDate: "", isRecurring: false, recurringType: "daily" };

function CalendarModal({ onClose, locationId }: { onClose: () => void; locationId?: string }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState<CalModalTask[]>([]);
  const [completions, setCompletions] = useState<CalCompletion[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState<NewTaskForm>(EMPTY_TASK_FORM);
  const [savingTask, setSavingTask] = useState(false);
  const [taskError, setTaskError] = useState("");
  const [completing, setCompleting] = useState<string | null>(null);

  const fetchTasks = () => {
    Promise.all([
      fetch("/api/tasks"),
      fetch("/api/tasks/completions"),
    ]).then(async ([tr, cr]) => {
      if (tr.ok) { const d = await tr.json(); setTasks(d.tasks || []); }
      if (cr.ok) { const d = await cr.json(); setCompletions(d.completions || []); }
      setLoading(false);
    });
  };

  useEffect(() => { fetchTasks(); }, []);

  const isTaskCompleted = (taskId: string, dateStr: string) =>
    completions.some((c) => c.taskId === taskId && c.completedDate === dateStr);

  const handleCalComplete = async (taskId: string, dateStr: string) => {
    setCompleting(taskId + dateStr);
    try {
      const res = await fetch("/api/tasks/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, completedDate: dateStr }),
      });
      if (res.ok) fetchTasks();
    } catch {}
    setCompleting(null);
  };

  const handleCalUncomplete = async (taskId: string, dateStr: string) => {
    setCompleting(taskId + dateStr);
    try {
      const res = await fetch("/api/tasks/uncomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, completedDate: dateStr }),
      });
      if (res.ok) fetchTasks();
    } catch {}
    setCompleting(null);
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim() || !newTask.dueTime) { setTaskError("Title and time are required"); return; }
    if (!newTask.isRecurring && !newTask.dueDate) { setTaskError("Date is required for one-time tasks"); return; }
    setSavingTask(true); setTaskError("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTask.title.trim(),
          type: newTask.type,
          dueTime: newTask.dueTime,
          dueDate: newTask.isRecurring ? null : newTask.dueDate,
          isRecurring: newTask.isRecurring,
          recurringType: newTask.isRecurring ? newTask.recurringType : null,
        }),
      });
      if (res.ok) {
        setShowAddTask(false);
        setNewTask({ ...EMPTY_TASK_FORM, dueDate: selectedDate ? format(selectedDate, "yyyy-MM-dd") : "" });
        fetchTasks();
      } else {
        const d = await res.json();
        setTaskError(d.error || "Failed to save");
      }
    } catch { setTaskError("Network error"); }
    setSavingTask(false);
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks?id=${taskId}`, { method: "DELETE" });
      fetchTasks();
    } catch {}
  };

  const getTasksForDate = (date: Date) =>
    tasks.filter((t) => (!t.locationId || t.locationId === locationId) && (t as any).showInCalendar !== false && calModalTaskApplies(t, date))
      .sort((a, b) => a.dueTime.localeCompare(b.dueTime));

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <h2 className="text-sm font-bold text-slate-800">Full Calendar</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          {/* Calendar grid */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth,1))} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-sm font-bold text-slate-800">{format(currentMonth,"MMMM yyyy")}</span>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth,1))} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-7 border-b border-slate-100">
              {CAL_DAYS_H.map((d) => <div key={d} className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">{d}</div>)}
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              {weeks.map((week, wi) => (
                <div key={wi} className="grid flex-1 grid-cols-7 border-b border-slate-100 last:border-0" style={{minHeight:0}}>
                  {week.map((date) => {
                    const dayTasks = getTasksForDate(date);
                    const isSelected = selectedDate && isSameDay(date, selectedDate);
                    const inMonth = isSameMonth(date, currentMonth);
                    return (
                      <div key={date.toISOString()} role="button" tabIndex={0} onClick={() => setSelectedDate(date)} onKeyDown={(e) => e.key === "Enter" && setSelectedDate(date)}
                        className={`flex flex-col items-start justify-start border-r border-slate-100 p-1.5 text-left transition-colors last:border-0 cursor-pointer ${!inMonth?"bg-slate-50/50":""} ${isSelected?"bg-[var(--hub-red)]/5 ring-1 ring-inset ring-[var(--hub-red)]/20":""} ${inMonth&&!isSelected?"hover:bg-slate-50":""}`}>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${isToday(date)?"bg-[var(--hub-red)] text-white":inMonth?"text-slate-700":"text-slate-300"}`}>{format(date,"d")}</span>
                        <div className="mt-0.5 w-full space-y-0.5">
                          {dayTasks.slice(0,2).map((task) => {
                            const Icon = calModalTypeIcons[task.type]||ClipboardList;
                            return (
                              <div key={task.id} className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-[9px] font-medium ${task.priority==="urgent"?"bg-red-100 text-red-700":task.priority==="high"?"bg-orange-100 text-orange-700":task.type==="cleaning"?"bg-purple-100 text-purple-700":task.type==="reminder"?"bg-sky-100 text-sky-700":"bg-blue-100 text-blue-700"}`}>
                                <Icon className="h-2 w-2 shrink-0" /><span className="truncate">{task.title}</span>
                              </div>
                            );
                          })}
                          {dayTasks.length>2 && <p className="pl-0.5 text-[9px] text-slate-400">+{dayTasks.length-2}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          {/* Day detail */}
          <div className="w-[280px] shrink-0 flex flex-col overflow-hidden border-l border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">{selectedDate?format(selectedDate,"EEE, MMMM d"):"Select a day"}</h3>
                <p className="text-[10px] text-slate-400">{selectedTasks.length} task{selectedTasks.length!==1?"s":""}</p>
              </div>
              {selectedDate && (
                <button
                  onClick={() => {
                    setShowAddTask((v) => !v);
                    setNewTask({ ...EMPTY_TASK_FORM, dueDate: format(selectedDate, "yyyy-MM-dd") });
                    setTaskError("");
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--hub-red)] text-white hover:bg-[#c4001f] transition-colors"
                  title="Add task"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Add task form */}
            {showAddTask && selectedDate && (
              <div className="border-b border-slate-100 bg-slate-50 p-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">New Task / Reminder</p>
                <input
                  value={newTask.title}
                  onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Title..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 outline-none focus:border-[var(--hub-red)]"
                />
                <div className="flex gap-2">
                  <select
                    value={newTask.type}
                    onChange={(e) => setNewTask((p) => ({ ...p, type: e.target.value }))}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none"
                  >
                    <option value="task">Task</option>
                    <option value="reminder">Reminder</option>
                    <option value="cleaning">Cleaning</option>
                  </select>
                  <input
                    type="time"
                    value={newTask.dueTime}
                    onChange={(e) => setNewTask((p) => ({ ...p, dueTime: e.target.value }))}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={newTask.isRecurring} onChange={(e) => setNewTask((p) => ({ ...p, isRecurring: e.target.checked }))} className="rounded" />
                  Recurring daily
                </label>
                {taskError && (
                  <div className="flex items-center gap-1 text-[10px] text-red-600">
                    <AlertCircle className="h-3 w-3 shrink-0" />{taskError}
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setShowAddTask(false); setTaskError(""); }} className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs text-slate-500 hover:bg-slate-100">Cancel</button>
                  <button onClick={handleAddTask} disabled={savingTask} className="flex-1 rounded-lg bg-[var(--hub-red)] py-1.5 text-xs font-semibold text-white hover:bg-[#c4001f] disabled:opacity-50">
                    {savingTask ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading && <div className="flex h-20 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--hub-red)]" /></div>}
              {!loading && selectedTasks.length===0 && <p className="py-8 text-center text-xs text-slate-400">No tasks this day</p>}
              {selectedTasks.map((task) => {
                const Icon = calModalTypeIcons[task.type]||ClipboardList;
                const isOwned = (task as CalModalTask & { createdByType?: string }).createdByType === "location";
                const selDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
                const todayStr = format(new Date(), "yyyy-MM-dd");
                const completed = isTaskCompleted(task.id, selDateStr);
                const isFuture = selDateStr > todayStr;
                const canComplete = !isFuture || task.allowEarlyComplete;
                const isProcessing = completing === task.id + selDateStr;
                return (
                  <div key={task.id} className={`rounded-xl border p-3 transition-all ${completed ? "border-emerald-200 bg-emerald-50/50" : task.priority==="urgent"?"border-red-200 bg-red-50":task.priority==="high"?"border-orange-200 bg-orange-50":"border-slate-200 bg-slate-50"}`}>
                    <div className="flex items-start gap-2">
                      {canComplete ? (
                        <button
                          onClick={() => completed ? handleCalUncomplete(task.id, selDateStr) : handleCalComplete(task.id, selDateStr)}
                          className="mt-0.5 shrink-0"
                          title={completed ? "Undo completion" : (isFuture ? "Complete early" : "Mark complete")}
                          disabled={isProcessing}
                        >
                          {completed ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <Circle className={`h-5 w-5 transition-colors ${isProcessing ? "text-emerald-400 animate-pulse" : "text-slate-300 hover:text-emerald-400"}`} />
                          )}
                        </button>
                      ) : (
                        <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${task.type==="cleaning"?"bg-purple-100 text-purple-600":task.type==="reminder"?"bg-sky-100 text-sky-600":"bg-blue-100 text-blue-600"}`}><Icon className="h-3 w-3" /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${completed ? "text-slate-400 line-through" : "text-slate-800"}`}>{task.title}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                          <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{calModalTime12(task.dueTime)}</span>
                          {task.isRecurring && <span className="flex items-center gap-0.5"><Repeat className="h-2.5 w-2.5" />Recurring</span>}
                          {isOwned && <span className="rounded bg-emerald-100 px-1 text-[9px] font-medium text-emerald-700">Mine</span>}
                          {completed && isFuture && <span className="rounded bg-amber-100 px-1 text-[9px] font-medium text-amber-700">Early +25%</span>}
                          {completed && <span className="rounded bg-emerald-100 px-1 text-[9px] font-medium text-emerald-700">Done</span>}
                        </div>
                      </div>
                      {isOwned && !completed && (
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                          title="Delete task"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

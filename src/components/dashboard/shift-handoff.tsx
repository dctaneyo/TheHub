"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { SmartSummary } from "./smart-summary";
import { useReducedMotion, ANIMATION } from "@/lib/animation-constants";

// ── Types ──

interface ShiftHandoffData {
  completedTaskCount: number;
  remainingTaskCount: number;
  remainingTasks: { id: string; title: string; dueTime: string }[];
  arlMessages: { senderName: string; content: string; sentAt: string }[];
  moodScoreAvg: number | null;
  shiftPeriod: "morning" | "afternoon" | "evening";
}

interface ShiftHandoffOverlayProps {
  data: ShiftHandoffData;
  onDismiss: () => void;
  showSmartSummary?: boolean;
}

// ── Helpers ──

export function getShiftPeriod(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

// Muted shift-period gradients (Warm Industrial palette)
const PHASE_GRADIENTS: Record<string, string> = {
  morning: "from-amber-900/40 via-orange-900/30 to-yellow-900/20",
  afternoon: "from-orange-900/40 via-amber-900/30 to-rose-900/20",
  evening: "from-indigo-900/40 via-purple-900/30 to-blue-900/20",
};

const MOOD_EMOJIS: Record<number, string> = {
  1: "😫",
  2: "😕",
  3: "😐",
  4: "🙂",
  5: "🤩",
};

function getMoodEmoji(score: number | null): string {
  if (score === null) return "—";
  const rounded = Math.round(score);
  return MOOD_EMOJIS[Math.max(1, Math.min(5, rounded))] ?? "😐";
}

// ── Card definitions ──

type CardId = "title" | "counters" | "tasks" | "messages" | "mood";

const CARD_ORDER: CardId[] = ["title", "counters", "tasks", "messages", "mood"];

const SWIPE_THRESHOLD = 80; // px to trigger card change

// ── Animated Counter ──

function AnimatedCounter({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    let raf: number;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      setValue(Math.round(progress * target));
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return <span>{value}</span>;
}

// ── Frosted Glass Card Wrapper ──

function FrostedCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg ${className}`}>
      {children}
    </div>
  );
}

// ── Dot Indicators ──

function DotIndicators({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-2" role="tablist" aria-label="Card navigation">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          role="tab"
          aria-selected={i === current}
          aria-label={`Card ${i + 1} of ${total}`}
          className={`rounded-full transition-all duration-300 ${
            i === current
              ? "h-2 w-6 bg-white/80"
              : "h-2 w-2 bg-white/30"
          }`}
        />
      ))}
    </div>
  );
}

// ── Main Overlay ──

export function ShiftHandoffOverlay({ data, onDismiss, showSmartSummary = true }: ShiftHandoffOverlayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  const goNext = useCallback(() => {
    if (currentIndex < CARD_ORDER.length - 1) {
      setDirection(1);
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "Escape") {
        onDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev, onDismiss]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    // Swipe left (next) or right (prev)
    if (Math.abs(offset.x) > SWIPE_THRESHOLD || Math.abs(velocity.x) > 500) {
      if (offset.x < 0) {
        goNext();
      } else {
        goPrev();
      }
    }
  };

  const gradient = PHASE_GRADIENTS[data.shiftPeriod] ?? PHASE_GRADIENTS.morning;
  const currentCard = CARD_ORDER[currentIndex];

  const motionDuration = prefersReducedMotion ? 0 : 0.35;

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -300 : 300,
      opacity: 0,
    }),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
      className={`fixed inset-0 z-40 flex flex-col bg-gradient-to-br ${gradient} text-foreground`}
      style={{ backgroundColor: "hsl(var(--bg-base-h, 220), var(--bg-base-s, 15%), var(--bg-base-l, 10%))" }}
    >
      {/* Dot indicators at top */}
      <div className="pt-6 pb-2 px-6">
        <DotIndicators total={CARD_ORDER.length} current={currentIndex} />
      </div>

      {/* Swipeable card area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-6">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentCard}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30, duration: motionDuration },
              opacity: { duration: motionDuration * 0.6 },
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="w-full max-w-lg cursor-grab active:cursor-grabbing"
          >
            {/* Title Card */}
            {currentCard === "title" && (
              <FrostedCard className="p-8 text-center space-y-3">
                <h1 className="text-4xl font-black text-white">
                  Shift Complete
                </h1>
                <p className="text-lg text-white/70 capitalize">
                  {data.shiftPeriod} shift summary
                </p>
                <p className="text-sm text-white/40 mt-4">
                  Swipe to review →
                </p>
              </FrostedCard>
            )}

            {/* Counters Card */}
            {currentCard === "counters" && (
              <FrostedCard className="p-6 space-y-6">
                <h2 className="text-2xl font-bold text-white text-center">Your Shift Numbers</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-white/5 border border-white/10 p-5 text-center">
                    <p className="text-4xl font-black text-emerald-400">
                      <AnimatedCounter target={data.completedTaskCount} />
                    </p>
                    <p className="text-sm text-white/60 mt-1">Tasks Completed</p>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-5 text-center">
                    <p className="text-4xl font-black text-amber-400">
                      <AnimatedCounter target={data.remainingTaskCount} />
                    </p>
                    <p className="text-sm text-white/60 mt-1">Tasks Remaining</p>
                  </div>
                </div>
                {showSmartSummary && (
                  <div className="mt-4">
                    <SmartSummary shiftPeriod={data.shiftPeriod} />
                  </div>
                )}
              </FrostedCard>
            )}

            {/* Remaining Tasks Card */}
            {currentCard === "tasks" && (
              <FrostedCard className="p-6 space-y-4">
                <h2 className="text-2xl font-bold text-white text-center">Remaining Tasks</h2>
                {data.remainingTasks.length === 0 ? (
                  <p className="text-lg text-emerald-400 font-semibold text-center py-4">
                    All tasks completed! 🎉
                  </p>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-2">
                    {data.remainingTasks.slice(0, 8).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-left"
                      >
                        <span className="text-sm font-medium text-white/90 truncate flex-1">
                          {task.title}
                        </span>
                        <span className="text-xs text-white/40 ml-2 shrink-0">
                          {task.dueTime}
                        </span>
                      </div>
                    ))}
                    {data.remainingTasks.length > 8 && (
                      <p className="text-xs text-white/40 text-center">
                        +{data.remainingTasks.length - 8} more
                      </p>
                    )}
                  </div>
                )}
              </FrostedCard>
            )}

            {/* ARL Messages Card */}
            {currentCard === "messages" && (
              <FrostedCard className="p-6 space-y-4">
                <h2 className="text-2xl font-bold text-white text-center">ARL Messages</h2>
                {data.arlMessages.length === 0 ? (
                  <p className="text-white/60 text-center py-4">No messages this shift</p>
                ) : (
                  <div className="space-y-3 max-h-56 overflow-y-auto">
                    {data.arlMessages.slice(0, 5).map((msg, i) => (
                      <div
                        key={i}
                        className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-left"
                      >
                        <p className="text-xs font-bold text-white/50 mb-1">
                          {msg.senderName}
                        </p>
                        <p className="text-sm text-white/90">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </FrostedCard>
            )}

            {/* Mood Card */}
            {currentCard === "mood" && (
              <FrostedCard className="p-8 text-center space-y-4">
                <h2 className="text-2xl font-bold text-white">Shift Mood</h2>
                <p className="text-7xl">
                  {getMoodEmoji(data.moodScoreAvg)}
                </p>
                {data.moodScoreAvg !== null && (
                  <p className="text-lg text-white/60">
                    Average: {data.moodScoreAvg.toFixed(1)} / 5
                  </p>
                )}
              </FrostedCard>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Got It button — always visible at bottom, ≥ 64px touch target */}
      <div className="pb-8 pt-4 px-6 flex justify-center">
        <button
          onClick={onDismiss}
          aria-label="Got it, dismiss shift handoff"
          className="min-h-[64px] min-w-[160px] px-8 py-4 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-base font-bold text-white shadow-lg hover:bg-white/20 active:scale-[0.98] transition-all"
        >
          Got It ✓
        </button>
      </div>
    </motion.div>
  );
}

// ── Shift Briefing Card ──

interface ShiftBriefingData {
  shiftPeriod: string;
  completedTaskCount: number;
  remainingTaskCount: number;
  moodScoreAvg: number | null;
  handedOffAt: string;
}

interface ShiftBriefingCardProps {
  data: ShiftBriefingData;
  onDismiss: () => void;
}

export function ShiftBriefingCard({ data, onDismiss }: ShiftBriefingCardProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -20 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -20 }}
      className="mx-4 mt-2 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-4 shadow-lg"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">
            📋 Shift Briefing
          </h3>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">
            Previous {data.shiftPeriod} shift
          </p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss shift briefing"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 min-h-[44px] rounded-lg hover:bg-white/10"
        >
          Dismiss
        </button>
      </div>
      <div className="flex gap-4 mt-3 text-center">
        <div className="flex-1">
          <p className="text-lg font-bold text-emerald-400">{data.completedTaskCount}</p>
          <p className="text-[10px] text-muted-foreground">Completed</p>
        </div>
        <div className="flex-1">
          <p className="text-lg font-bold text-amber-400">{data.remainingTaskCount}</p>
          <p className="text-[10px] text-muted-foreground">Remaining</p>
        </div>
        <div className="flex-1">
          <p className="text-lg">{getMoodEmoji(data.moodScoreAvg)}</p>
          <p className="text-[10px] text-muted-foreground">Mood</p>
        </div>
      </div>
    </motion.div>
  );
}

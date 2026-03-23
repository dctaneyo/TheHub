"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

// ── Phase types & config ──────────────────────────────────────────

export type DayPhase =
  | "dawn"
  | "morning"
  | "midday"
  | "afternoon"
  | "evening"
  | "night";

export interface PhaseColors {
  gradient: string;
  particleColor: string;
}

export const PHASE_CONFIG: Record<
  DayPhase,
  { hours: [number, number]; gradient: string; particleColor: string }
> = {
  dawn: {
    hours: [5, 8],
    gradient: "from-rose-200 via-orange-100 to-amber-50",
    particleColor: "#fbbf24",
  },
  morning: {
    hours: [8, 11],
    gradient: "from-sky-200 via-blue-50 to-white",
    particleColor: "#38bdf8",
  },
  midday: {
    hours: [11, 14],
    gradient: "from-amber-100 via-yellow-50 to-white",
    particleColor: "#fcd34d",
  },
  afternoon: {
    hours: [14, 17],
    gradient: "from-amber-200 via-orange-100 to-rose-50",
    particleColor: "#fb923c",
  },
  evening: {
    hours: [17, 20],
    gradient: "from-indigo-400 via-purple-300 to-blue-200",
    particleColor: "#a78bfa",
  },
  night: {
    hours: [20, 5],
    gradient: "from-slate-900 via-indigo-950 to-slate-800",
    particleColor: "#475569",
  },
};

// ── Phase detection ───────────────────────────────────────────────

/** Determine the current day phase from an hour (0-23). */
export function getPhaseForHour(hour: number): DayPhase {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 11) return "morning";
  if (hour >= 11 && hour < 14) return "midday";
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "evening";
  return "night"; // 20-4
}

/** Get the current local hour. Uses browser local time. */
function getCurrentHour(): number {
  return new Date().getHours();
}

// ── Context ───────────────────────────────────────────────────────

interface DayPhaseContextValue {
  phase: DayPhase;
  colors: PhaseColors;
  isTransitioning: boolean;
}

const DayPhaseContext = createContext<DayPhaseContextValue>({
  phase: "morning",
  colors: {
    gradient: PHASE_CONFIG.morning.gradient,
    particleColor: PHASE_CONFIG.morning.particleColor,
  },
  isTransitioning: false,
});

// ── Provider ──────────────────────────────────────────────────────

export function DayPhaseProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<DayPhase>(() =>
    getPhaseForHour(getCurrentHour())
  );
  const [isTransitioning, setIsTransitioning] = useState(false);

  const checkPhase = useCallback(() => {
    const newPhase = getPhaseForHour(getCurrentHour());
    if (newPhase !== phase) {
      setIsTransitioning(true);
      setPhase(newPhase);
      // Match the 3-second CSS transition duration
      const timer = setTimeout(() => setIsTransitioning(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  useEffect(() => {
    // Check every 60 seconds for phase changes
    const interval = setInterval(checkPhase, 60_000);
    return () => clearInterval(interval);
  }, [checkPhase]);

  const colors: PhaseColors = {
    gradient: PHASE_CONFIG[phase].gradient,
    particleColor: PHASE_CONFIG[phase].particleColor,
  };

  return (
    <DayPhaseContext.Provider value={{ phase, colors, isTransitioning }}>
      {children}
    </DayPhaseContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────

export function useDayPhase() {
  return useContext(DayPhaseContext);
}

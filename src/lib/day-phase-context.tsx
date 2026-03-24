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
    gradient: "from-rose-400 via-orange-300 to-amber-200",
    particleColor: "#fbbf24",
  },
  morning: {
    hours: [8, 11],
    gradient: "from-sky-400 via-blue-200 to-sky-100",
    particleColor: "#38bdf8",
  },
  midday: {
    hours: [11, 14],
    gradient: "from-amber-300 via-yellow-200 to-orange-100",
    particleColor: "#fcd34d",
  },
  afternoon: {
    hours: [14, 17],
    gradient: "from-orange-400 via-amber-300 to-rose-200",
    particleColor: "#fb923c",
  },
  evening: {
    hours: [17, 20],
    gradient: "from-indigo-900 via-purple-800 to-slate-700",
    particleColor: "#a78bfa",
  },
  night: {
    hours: [20, 5],
    gradient: "from-slate-950 via-indigo-950 to-slate-900",
    particleColor: "#475569",
  },
};

// ── Phase HSL values for time-of-day background shift ─────────────

export const PHASE_HSL: Record<DayPhase, { h: number; s: number; l: number }> = {
  night:     { h: 220, s: 15, l: 10 },
  dawn:      { h: 35,  s: 10, l: 12 },
  morning:   { h: 200, s: 12, l: 11 },
  midday:    { h: 210, s: 10, l: 12 },
  afternoon: { h: 220, s: 12, l: 11 },
  evening:   { h: 240, s: 14, l: 11 },
};

/** Update CSS custom properties on the root element for the background hue shift. */
function updateBackgroundHue(phase: DayPhase): void {
  const target = PHASE_HSL[phase];
  const root = document.documentElement;
  root.style.setProperty("--bg-base-h", String(target.h));
  root.style.setProperty("--bg-base-s", `${target.s}%`);
  root.style.setProperty("--bg-base-l", `${target.l}%`);
}

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

  // Set background HSL on mount and whenever phase changes
  useEffect(() => {
    updateBackgroundHue(phase);
  }, [phase]);

  useEffect(() => {
    // Check every 60 seconds for phase changes and update background
    const interval = setInterval(() => {
      checkPhase();
      updateBackgroundHue(getPhaseForHour(getCurrentHour()));
    }, 60_000);
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

"use client";

import { useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { type DayPhase, PHASE_CONFIG } from "@/lib/day-phase-context";

interface HeartbeatProps {
  /** 0-100: operational health score */
  health: number;
  /** Number of overdue tasks */
  overdueCount: number;
  /** Number of due-soon tasks */
  dueSoonCount: number;
  /** Total points earned today */
  pointsToday: number;
  /** Current streak */
  streak: number;
  /** Whether to show the large version */
  large?: boolean;
  /** Optional day phase for tinting glow rings */
  dayPhase?: DayPhase;
  className?: string;
}

/**
 * A living, breathing heartbeat visualization that reflects the real-time
 * operational health of the restaurant. Green and calm when everything's
 * on track, warming to amber when tasks pile up, pulsing faster when
 * things are overdue.
 */
export function Heartbeat({
  health,
  overdueCount,
  dueSoonCount,
  pointsToday,
  streak,
  large = false,
  dayPhase,
  className,
}: HeartbeatProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const prefersReducedMotionRef = useRef(false);

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotionRef.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => { prefersReducedMotionRef.current = e.matches; };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Derive pulse speed and color from health
  const pulseSpeed = useMemo(() => {
    if (overdueCount > 3) return 2.5; // fast anxious pulse
    if (overdueCount > 0) return 1.8;
    if (dueSoonCount > 2) return 1.4;
    if (dueSoonCount > 0) return 1.1;
    return 0.7; // calm, steady breathing
  }, [overdueCount, dueSoonCount]);

  const colors = useMemo(() => {
    if (health >= 90) return { primary: "#10b981", glow: "rgba(16,185,129,0.3)", bg: "rgba(16,185,129,0.05)" };
    if (health >= 70) return { primary: "#22c55e", glow: "rgba(34,197,94,0.25)", bg: "rgba(34,197,94,0.04)" };
    if (health >= 50) return { primary: "#f59e0b", glow: "rgba(245,158,11,0.3)", bg: "rgba(245,158,11,0.05)" };
    if (health >= 30) return { primary: "#f97316", glow: "rgba(249,115,22,0.35)", bg: "rgba(249,115,22,0.06)" };
    return { primary: "#ef4444", glow: "rgba(239,68,68,0.4)", bg: "rgba(239,68,68,0.07)" };
  }, [health]);

  // Day-phase tint color for glow rings (optional overlay)
  const phaseGlowColor = useMemo(() => {
    if (!dayPhase) return null;
    return PHASE_CONFIG[dayPhase].particleColor;
  }, [dayPhase]);

  // Build aria-label for the canvas
  const ariaLabel = useMemo(() => {
    const parts = [`Location health: ${health}%.`];
    if (overdueCount > 0) parts.push(`${overdueCount} overdue task${overdueCount !== 1 ? "s" : ""}.`);
    if (dueSoonCount > 0) parts.push(`${dueSoonCount} due soon.`);
    if (overdueCount === 0 && dueSoonCount === 0) parts.push("All tasks on track.");
    return parts.join(" ");
  }, [health, overdueCount, dueSoonCount]);

  // Canvas animation for the organic pulse rings
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = large ? 280 : 160;
    canvas.width = size * 2; // retina
    canvas.height = size * 2;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(2, 2);

    const cx = size / 2;
    const cy = size / 2;
    const baseRadius = large ? 60 : 35;

    const animate = () => {
      timeRef.current += 0.016;
      const t = timeRef.current;
      ctx.clearRect(0, 0, size, size);

      // If reduced motion, draw static version
      if (prefersReducedMotionRef.current) {
        // Static outer ring
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius * 1.2, 0, Math.PI * 2);
        ctx.strokeStyle = colors.primary;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Static inner blob
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = colors.primary;
        ctx.fill();

        // Core circle
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius * 0.45, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * 0.45);
        gradient.addColorStop(0, colors.primary);
        gradient.addColorStop(1, colors.glow);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Center glow
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.fill();

        ctx.globalAlpha = 1;
        // No requestAnimationFrame — static render
        return;
      }

      // Breathing scale
      const breathe = Math.sin(t * pulseSpeed * Math.PI) * 0.15 + 1;

      // Outer glow rings (3 expanding rings)
      for (let i = 0; i < 3; i++) {
        const phase = (t * pulseSpeed + i * 0.8) % 3;
        const ringScale = 1 + phase * 0.6;
        const ringAlpha = Math.max(0, 1 - phase / 3) * 0.3;

        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius * ringScale, 0, Math.PI * 2);
        // Use phase glow color for outer rings if available, health color for inner
        ctx.strokeStyle = phaseGlowColor && i < 2 ? phaseGlowColor : colors.primary;
        ctx.globalAlpha = ringAlpha;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Inner organic blob (slightly wobbly circle)
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      for (let angle = 0; angle < Math.PI * 2; angle += 0.05) {
        const wobble = Math.sin(angle * 3 + t * 2) * 3 + Math.sin(angle * 5 + t * 1.5) * 2;
        const r = baseRadius * breathe * 0.7 + wobble;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (angle === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = colors.primary;
      ctx.fill();

      // Core circle
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * breathe * 0.45, 0, Math.PI * 2);
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * breathe * 0.45);
      gradient.addColorStop(0, colors.primary);
      gradient.addColorStop(1, colors.glow);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Center glow
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * breathe * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();

      ctx.globalAlpha = 1;
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [colors, pulseSpeed, large, phaseGlowColor]);

  const size = large ? 280 : 160;

  return (
    <div className={cn("relative flex flex-col items-center justify-center", className)}>
      <canvas ref={canvasRef} className="pointer-events-none" aria-label={ariaLabel} role="img" />

      {/* Health percentage overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <motion.span
          key={health}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            "font-black tabular-nums drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]",
            large ? "text-3xl" : "text-lg",
          )}
          style={{ color: colors.primary }}
        >
          {health}%
        </motion.span>
        {large && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] mt-1">
            Health
          </span>
        )}
      </div>

      {/* Stats ring around the heartbeat (large mode only) */}
      {large && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Top: Points */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 text-center">
            <span className="text-xs font-bold text-amber-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">{pointsToday} pts</span>
          </div>
          {/* Bottom: Streak */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center">
            <span className="text-xs font-bold text-orange-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">🔥 {streak} day streak</span>
          </div>
          {/* Left: Overdue */}
          {overdueCount > 0 && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 text-center">
              <span className="text-xs font-bold text-red-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">{overdueCount} overdue</span>
            </div>
          )}
          {/* Right: Due soon */}
          {dueSoonCount > 0 && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 text-center">
              <span className="text-xs font-bold text-amber-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">{dueSoonCount} due soon</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

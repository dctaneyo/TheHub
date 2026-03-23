"use client";

import { useMemo, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useDayPhase } from "@/lib/day-phase-context";

// ── Particle generation ───────────────────────────────────────────

interface Particle {
  id: number;
  x: number; // % from left
  y: number; // % from top
  size: number; // px
  duration: number; // seconds for float cycle
  delay: number; // animation delay
  opacity: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 4,
    duration: 6 + Math.random() * 8,
    delay: Math.random() * 5,
    opacity: 0.2 + Math.random() * 0.5,
  }));
}

// ── Component ─────────────────────────────────────────────────────

export function DayPhaseBackground() {
  const { colors } = useDayPhase();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const particles = useMemo(() => generateParticles(30), []);

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none"
      aria-hidden="true"
    >
      {/* Gradient background with 3s CSS transition */}
      <div
        className={`absolute inset-0 bg-gradient-to-b ${colors.gradient} ${
          prefersReducedMotion
            ? "transition-none"
            : "transition-all duration-[3000ms] ease-in-out"
        }`}
        style={{ willChange: "background" }}
      />

      {/* Floating particles — disabled when prefers-reduced-motion */}
      {!prefersReducedMotion &&
        particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              backgroundColor: colors.particleColor,
              opacity: p.opacity,
              willChange: "transform",
            }}
            animate={{
              y: [0, -20, 0],
              x: [0, 8, 0],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
    </div>
  );
}

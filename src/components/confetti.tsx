"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  velocityX: number;
  velocityY: number;
  shape: "circle" | "square" | "star";
}

const COLORS = [
  "#e4002b", // hub red
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#f97316", // orange
];

interface ConfettiProps {
  isActive: boolean;
  pointsEarned?: number;
}

export function Confetti({ isActive, pointsEarned = 0 }: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!isActive) {
      setParticles([]);
      return;
    }

    const count = Math.min(30 + pointsEarned * 2, 80);
    const newParticles: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 50 + (Math.random() - 0.5) * 40,
      y: 40 + (Math.random() - 0.5) * 20,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
      velocityX: (Math.random() - 0.5) * 60,
      velocityY: -(20 + Math.random() * 40),
      shape: (["circle", "square", "star"] as const)[Math.floor(Math.random() * 3)],
    }));

    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), 2500);
    return () => clearTimeout(timer);
  }, [isActive, pointsEarned]);

  return (
    <AnimatePresence>
      {particles.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                scale: 0,
                rotate: 0,
                opacity: 1,
              }}
              animate={{
                left: `${p.x + p.velocityX}%`,
                top: `${p.y - p.velocityY}%`,
                scale: [0, 1.2, 1, 0.8, 0],
                rotate: p.rotation + 720,
                opacity: [0, 1, 1, 0.8, 0],
              }}
              transition={{
                duration: 1.8 + Math.random() * 0.8,
                ease: "easeOut",
              }}
              className="absolute"
              style={{
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                borderRadius: p.shape === "circle" ? "50%" : p.shape === "star" ? "2px" : "2px",
                transform: `rotate(${p.rotation}deg)`,
              }}
            />
          ))}

          {/* Center celebration text */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 1] }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: "backOut" }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="flex flex-col items-center gap-2 rounded-3xl bg-white/95 px-10 py-6 shadow-2xl backdrop-blur-md">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-4xl"
              >
                🎉
              </motion.div>
              <span className="text-xl font-black text-slate-800">Task Complete!</span>
              {pointsEarned > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: "spring" }}
                  className="rounded-full bg-amber-100 px-4 py-1 text-sm font-bold text-amber-700"
                >
                  +{pointsEarned} points ✨
                </motion.span>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

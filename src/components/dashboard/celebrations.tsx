"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getRandomTaskCompletionPun } from "@/lib/funny-messages";

// ── Sound Effects ──
function useAudioCtx() {
  const ref = useRef<AudioContext | null>(null);
  const get = useCallback(() => {
    if (!ref.current) ref.current = new AudioContext();
    return ref.current;
  }, []);
  return get;
}

export function useConfettiSound() {
  const getCtx = useAudioCtx();
  return useCallback(() => {
    try {
      const ctx = getCtx();
      const t = ctx.currentTime;
      // Cheerful ascending chime
      [[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.12], [1047, 0.3, 0.2]].forEach(([f, d, dur]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.3, t + d);
        gain.gain.exponentialRampToValueAtTime(0.01, t + d + dur);
        osc.start(t + d); osc.stop(t + d + dur);
      });
    } catch {}
  }, [getCtx]);
}

export function useLevelUpSound() {
  const getCtx = useAudioCtx();
  return useCallback(() => {
    try {
      const ctx = getCtx();
      const t = ctx.currentTime;
      // Epic ascending fanfare
      [[440, 0, 0.15], [554, 0.12, 0.15], [659, 0.24, 0.15], [880, 0.36, 0.3], [1047, 0.55, 0.15], [1319, 0.65, 0.35]].forEach(([f, d, dur]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "triangle";
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.4, t + d);
        gain.gain.exponentialRampToValueAtTime(0.01, t + d + dur);
        osc.start(t + d); osc.stop(t + d + dur);
      });
    } catch {}
  }, [getCtx]);
}

export function useBadgeSound() {
  const getCtx = useAudioCtx();
  return useCallback(() => {
    try {
      const ctx = getCtx();
      const t = ctx.currentTime;
      // Sparkle sound
      [[880, 0, 0.1], [1320, 0.08, 0.1], [1760, 0.16, 0.15], [1320, 0.28, 0.2]].forEach(([f, d, dur]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.2, t + d);
        gain.gain.exponentialRampToValueAtTime(0.01, t + d + dur);
        osc.start(t + d); osc.stop(t + d + dur);
      });
    } catch {}
  }, [getCtx]);
}

export function useStreakSound() {
  const getCtx = useAudioCtx();
  return useCallback(() => {
    try {
      const ctx = getCtx();
      const t = ctx.currentTime;
      // Fire whoosh
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(800, t + 0.3);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
      osc.start(t); osc.stop(t + 0.4);
    } catch {}
  }, [getCtx]);
}

// ── Particle types ──
type ParticleType = "confetti" | "coin" | "star" | "firework";

interface Particle {
  id: number;
  x: number;
  y: number;
  type: ParticleType;
  color: string;
  size: number;
  rotation: number;
  velocityX: number;
  velocityY: number;
  delay: number;
}

const CONFETTI_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#FF9FF3", "#54A0FF", "#5F27CD"];
const COIN_COLORS = ["#FFD700", "#FFA500", "#FFE44D", "#DAA520"];
const STAR_COLORS = ["#FFD700", "#FF6B6B", "#4ECDC4", "#FF9FF3", "#54A0FF"];

function randomBetween(a: number, b: number) { return a + Math.random() * (b - a); }

function generateParticles(type: ParticleType, count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const colors = type === "coin" ? COIN_COLORS : type === "star" ? STAR_COLORS : CONFETTI_COLORS;
    particles.push({
      id: i,
      x: randomBetween(10, 90),
      y: randomBetween(-10, -30),
      type,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: type === "coin" ? randomBetween(16, 24) : type === "star" ? randomBetween(14, 22) : randomBetween(6, 12),
      rotation: randomBetween(0, 360),
      velocityX: randomBetween(-3, 3),
      velocityY: randomBetween(2, 6),
      delay: randomBetween(0, 0.5),
    });
  }
  return particles;
}

// ── Confetti Burst (enhanced) ──
export function ConfettiBurst({ active, points, onComplete }: { active: boolean; points?: number; onComplete?: () => void }) {
  const [particles] = useState(() => generateParticles("confetti", 60));

  useEffect(() => {
    if (active && onComplete) {
      const timer = setTimeout(onComplete, 2800);
      return () => clearTimeout(timer);
    }
  }, [active, onComplete]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
        >
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ x: `${p.x}vw`, y: "-5vh", rotate: 0, opacity: 1 }}
              animate={{
                x: `${p.x + p.velocityX * 15}vw`,
                y: "110vh",
                rotate: p.rotation + randomBetween(360, 720),
                opacity: [1, 1, 0.8, 0],
              }}
              transition={{ duration: randomBetween(2, 3.5), delay: p.delay, ease: "easeIn" }}
              style={{ position: "absolute", width: p.size, height: p.size * 0.6, backgroundColor: p.color, borderRadius: 2 }}
            />
          ))}
          {points !== undefined && points > 0 && (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: "40vh" }}
                animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1, 0.8], y: ["40vh", "35vh", "30vh", "25vh"] }}
                transition={{ duration: 2.5, times: [0, 0.2, 0.7, 1] }}
                className="fixed left-1/2 -translate-x-1/2 z-[101]"
              >
                <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 px-6 py-3 shadow-2xl">
                  <p className="text-center text-3xl font-black text-white">+{points} pts</p>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: [0, 1, 1, 0], y: [20, 0, 0, -10] }}
                transition={{ duration: 3, times: [0, 0.1, 0.8, 1] }}
                className="fixed top-24 left-1/2 -translate-x-1/2 z-[101]"
              >
                <div className="rounded-2xl bg-white border-2 border-green-400 px-6 py-3 shadow-2xl">
                  <p className="text-center text-lg font-bold text-slate-800">{getRandomTaskCompletionPun()}</p>
                </div>
              </motion.div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Coin Rain ──
export function CoinRain({ active, amount, onComplete }: { active: boolean; amount?: number; onComplete?: () => void }) {
  const [particles] = useState(() => generateParticles("coin", 35));

  useEffect(() => {
    if (active && onComplete) {
      const timer = setTimeout(onComplete, 3000);
      return () => clearTimeout(timer);
    }
  }, [active, onComplete]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ x: `${p.x}vw`, y: "-5vh", rotate: 0, opacity: 1, scale: 0 }}
              animate={{
                x: `${p.x + p.velocityX * 5}vw`,
                y: "110vh",
                rotate: p.rotation * 2,
                opacity: [0, 1, 1, 0],
                scale: [0, 1, 1, 0.5],
              }}
              transition={{ duration: randomBetween(2, 3), delay: p.delay, ease: "easeIn" }}
              className="absolute text-center"
              style={{ fontSize: p.size }}
            >
              🪙
            </motion.div>
          ))}
          {amount !== undefined && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: "45vh" }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.3, 1, 0.8], y: ["45vh", "38vh", "33vh", "28vh"] }}
              transition={{ duration: 2.5, times: [0, 0.2, 0.7, 1] }}
              className="fixed left-1/2 -translate-x-1/2 z-[101]"
            >
              <div className="rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 px-6 py-3 shadow-2xl">
                <p className="text-center text-2xl font-black text-white">+{amount} bonus</p>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Star Burst ──
export function StarBurst({ active, onComplete }: { active: boolean; onComplete?: () => void }) {
  const [particles] = useState(() => generateParticles("star", 25));

  useEffect(() => {
    if (active && onComplete) {
      const timer = setTimeout(onComplete, 2500);
      return () => clearTimeout(timer);
    }
  }, [active, onComplete]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ x: "50vw", y: "50vh", scale: 0, opacity: 0 }}
              animate={{
                x: `${p.x}vw`,
                y: `${randomBetween(10, 90)}vh`,
                scale: [0, 1.5, 1, 0],
                opacity: [0, 1, 1, 0],
                rotate: p.rotation,
              }}
              transition={{ duration: 2, delay: p.delay * 0.5, ease: "easeOut" }}
              className="absolute"
              style={{ fontSize: p.size }}
            >
              ⭐
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Fireworks ──
export function Fireworks({ active, onComplete }: { active: boolean; onComplete?: () => void }) {
  useEffect(() => {
    if (active && onComplete) {
      const timer = setTimeout(onComplete, 3500);
      return () => clearTimeout(timer);
    }
  }, [active, onComplete]);

  // Generate 3 bursts at different positions
  const bursts = [
    { cx: 30, cy: 30, color: "#FF6B6B", delay: 0 },
    { cx: 50, cy: 25, color: "#4ECDC4", delay: 0.4 },
    { cx: 70, cy: 35, color: "#FFD700", delay: 0.8 },
  ];

  return (
    <AnimatePresence>
      {active && (
        <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
          {bursts.map((burst, bi) => (
            <div key={bi}>
              {/* Rising trail */}
              <motion.div
                initial={{ x: `${burst.cx}vw`, y: "100vh", opacity: 1 }}
                animate={{ y: `${burst.cy}vh`, opacity: [1, 1, 0] }}
                transition={{ duration: 0.6, delay: burst.delay }}
                className="absolute w-1 h-4 rounded-full"
                style={{ backgroundColor: burst.color }}
              />
              {/* Explosion particles */}
              {Array.from({ length: 16 }).map((_, i) => {
                const angle = (i / 16) * Math.PI * 2;
                const dist = randomBetween(8, 18);
                return (
                  <motion.div
                    key={`${bi}-${i}`}
                    initial={{
                      x: `${burst.cx}vw`,
                      y: `${burst.cy}vh`,
                      scale: 0,
                      opacity: 0,
                    }}
                    animate={{
                      x: `${burst.cx + Math.cos(angle) * dist}vw`,
                      y: `${burst.cy + Math.sin(angle) * dist}vh`,
                      scale: [0, 1.5, 0],
                      opacity: [0, 1, 0],
                    }}
                    transition={{ duration: 1.2, delay: burst.delay + 0.6, ease: "easeOut" }}
                    className="absolute w-2 h-2 rounded-full"
                    style={{ backgroundColor: burst.color }}
                  />
                );
              })}
            </div>
          ))}

          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: "50vh" }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.3, 1.1, 0.8], y: ["50vh", "42vh", "38vh", "34vh"] }}
            transition={{ duration: 3, delay: 0.5, times: [0, 0.15, 0.6, 1] }}
            className="fixed left-1/2 -translate-x-1/2 z-[101]"
          >
            <div className="rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 px-8 py-4 shadow-2xl">
              <p className="text-center text-3xl font-black text-white">🎉 ALL DONE! 🎉</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Level-Up Celebration ──
export function LevelUpCelebration({ active, level, title, onComplete }: { active: boolean; level: number; title: string; onComplete?: () => void }) {
  useEffect(() => {
    if (active && onComplete) {
      const timer = setTimeout(onComplete, 4000);
      return () => clearTimeout(timer);
    }
  }, [active, onComplete]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center"
        >
          {/* Radial glow */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 3, 2.5], opacity: [0, 0.3, 0] }}
            transition={{ duration: 2 }}
            className="absolute w-40 h-40 rounded-full bg-gradient-radial from-purple-400 to-transparent"
          />

          {/* Stars around */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            return (
              <motion.span
                key={i}
                initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                animate={{
                  x: Math.cos(angle) * 200,
                  y: Math.sin(angle) * 200,
                  scale: [0, 1.5, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{ duration: 1.5, delay: 0.3 + i * 0.05 }}
                className="absolute text-2xl"
              >
                ✨
              </motion.span>
            );
          })}

          {/* Main card */}
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: [0, 1.2, 1], rotate: [-10, 5, 0] }}
            transition={{ duration: 0.8, delay: 0.2, ease: "backOut" }}
            className="relative rounded-3xl bg-gradient-to-br from-purple-600 to-blue-600 px-10 py-8 shadow-2xl"
          >
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <p className="text-center text-5xl">🎖️</p>
            </motion.div>
            <p className="mt-2 text-center text-sm font-bold uppercase tracking-widest text-white/60">Level Up!</p>
            <p className="text-center text-5xl font-black text-white">Level {level}</p>
            <p className="mt-1 text-center text-lg font-bold text-white/80">{title}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

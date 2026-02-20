"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Color time tag sequence (9 colors, 30-min slots, cycles) ──
const COLOR_SEQUENCE = [
  { name: "Red",    bg: "#ef4444", text: "#fff", glow: "rgba(239,68,68,0.6)" },
  { name: "Orange", bg: "#f97316", text: "#fff", glow: "rgba(249,115,22,0.6)" },
  { name: "Yellow", bg: "#eab308", text: "#000", glow: "rgba(234,179,8,0.6)" },
  { name: "Green",  bg: "#22c55e", text: "#fff", glow: "rgba(34,197,94,0.6)" },
  { name: "Blue",   bg: "#3b82f6", text: "#fff", glow: "rgba(59,130,246,0.6)" },
  { name: "Purple", bg: "#a855f7", text: "#fff", glow: "rgba(168,85,247,0.6)" },
  { name: "Brown",  bg: "#92400e", text: "#fff", glow: "rgba(146,64,14,0.6)" },
  { name: "Grey",   bg: "#9ca3af", text: "#fff", glow: "rgba(156,163,175,0.6)" },
  { name: "White",  bg: "#f8fafc", text: "#000", glow: "rgba(248,250,252,0.4)", border: true },
];

// Anchor: 10:00 AM = slot index 0 (expires at 10:30 AM = Red)
// Each slot = 30 min. Slot index tells you which color expires at that time.
// To get the color for a given expire time: slotIndex = minutes since 10:00 AM / 30
const ANCHOR_MINUTES = 10 * 60; // 10:00 AM in minutes from midnight

function minutesFromMidnight(h: number, m: number) {
  return h * 60 + m;
}

function getSlotIndex(now: Date): number {
  const mins = minutesFromMidnight(now.getHours(), now.getMinutes());
  // How many 30-min slots since anchor (10:00 AM)
  const delta = ((mins - ANCHOR_MINUTES) % (9 * 30) + 9 * 30) % (9 * 30);
  return Math.floor(delta / 30);
}

// Returns the color that expires at (now + offsetSlots * 30 min)
// offsetSlots=0 → current expiring color (the one whose tag you'd discard NOW)
// offsetSlots=1 → next to expire
// offsetSlots=-1 → last expired
function getColorAtOffset(now: Date, offsetSlots: number) {
  const slotIndex = getSlotIndex(now);
  const idx = ((slotIndex + offsetSlots) % 9 + 9) % 9;
  return COLOR_SEQUENCE[idx];
}

// Minutes remaining until next 30-min boundary
function minutesToNextSlot(now: Date): number {
  const mins = minutesFromMidnight(now.getHours(), now.getMinutes());
  const secs = now.getSeconds();
  const minsIntoSlot = mins % 30;
  return (30 - minsIntoSlot) * 60 - secs;
}

// Get expire time string for a given offset from current slot boundary
function getExpireTimeStr(now: Date, offsetSlots: number): string {
  const mins = minutesFromMidnight(now.getHours(), now.getMinutes());
  const minsIntoSlot = mins % 30;
  const slotBoundaryMins = mins - minsIntoSlot; // current slot start
  const targetMins = ((slotBoundaryMins + offsetSlots * 30) % (24 * 60) + 24 * 60) % (24 * 60);
  const h = Math.floor(targetMins / 60);
  const m = targetMins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Hold time columns
const HOLD_COLUMNS = [
  { label: "60 min", slots: 2, products: ["Nuggets", "XC Strips", "Chx Littles"] },
  { label: "90 min", slots: 3, products: ["Biscuits"] },
  { label: "2 hr",   slots: 4, products: ["8oz Gravy", "OR Chicken", "XC Chicken", "KG Chicken"] },
  { label: "3 hr",   slots: 6, products: ["Pot Pies", "Corn on Cob"] },
  { label: "4 hr",   slots: 8, products: ["XC Filets", "Bulk Corn", "Bulk Gravy", "Bulk Mac", "Mashed Pot."] },
];

// ── Animated clock digits ──
function ClockDigit({ value, label }: { value: string; label?: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={value}
            initial={{ y: -40, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="font-black tabular-nums leading-none"
            style={{
              fontSize: "clamp(4rem, 10vw, 8rem)",
              fontVariantNumeric: "tabular-nums",
              background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 20px rgba(255,255,255,0.4))",
            }}
          >
            {value}
          </motion.div>
        </AnimatePresence>
      </div>
      {label && (
        <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
          {label}
        </span>
      )}
    </div>
  );
}

function ColonSeparator({ pulse }: { pulse: boolean }) {
  return (
    <motion.div
      animate={{ opacity: pulse ? [1, 0.2, 1] : 1 }}
      transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
      className="font-black text-white/60 leading-none pb-4 select-none"
      style={{ fontSize: "clamp(3rem, 8vw, 6rem)" }}
    >
      :
    </motion.div>
  );
}

// ── Color tag card ──
function ColorCard({
  color,
  label,
  sublabel,
  size = "md",
  expired = false,
  upcoming = false,
  current = false,
}: {
  color: typeof COLOR_SEQUENCE[0];
  label: string;
  sublabel?: string;
  size?: "sm" | "md" | "lg";
  expired?: boolean;
  upcoming?: boolean;
  current?: boolean;
}) {
  const sizeClasses = {
    sm: "px-4 py-2 rounded-xl",
    md: "px-5 py-3 rounded-2xl",
    lg: "px-6 py-4 rounded-2xl",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex flex-col items-center gap-1 ${sizeClasses[size]}`}
      style={{
        background: expired
          ? "rgba(255,255,255,0.04)"
          : upcoming
          ? "rgba(255,255,255,0.08)"
          : "rgba(255,255,255,0.12)",
        border: `1px solid ${expired ? "rgba(255,255,255,0.08)" : upcoming ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.2)"}`,
      }}
    >
      <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">
        {label}
      </div>
      <motion.div
        className="rounded-lg flex items-center justify-center font-black"
        style={{
          background: color.bg,
          color: color.text,
          border: color.border ? "2px solid rgba(0,0,0,0.15)" : undefined,
          width: size === "sm" ? 56 : size === "md" ? 72 : 88,
          height: size === "sm" ? 28 : size === "md" ? 36 : 44,
          boxShadow: expired ? "none" : `0 0 ${current ? 24 : 12}px ${color.glow}`,
          opacity: expired ? 0.4 : 1,
          fontSize: size === "sm" ? 11 : 13,
        }}
        animate={current ? { boxShadow: [`0 0 16px ${color.glow}`, `0 0 36px ${color.glow}`, `0 0 16px ${color.glow}`] } : {}}
        transition={current ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
      >
        {color.name}
      </motion.div>
      {sublabel && (
        <div className="text-[10px] font-semibold text-white/50">{sublabel}</div>
      )}
    </motion.div>
  );
}

// ── Hold-time column color card ──
function HoldColumnCard({ col, now }: { col: typeof HOLD_COLUMNS[0]; now: Date }) {
  const color = getColorAtOffset(now, col.slots);
  const expireStr = getExpireTimeStr(now, col.slots);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-2 rounded-2xl px-4 py-3"
      style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
    >
      <div className="text-[11px] font-bold uppercase tracking-widest text-white/50">{col.label}</div>
      <motion.div
        className="rounded-xl flex items-center justify-center font-black text-sm"
        style={{
          background: color.bg,
          color: color.text,
          border: color.border ? "2px solid rgba(0,0,0,0.15)" : undefined,
          width: 80,
          height: 40,
          boxShadow: `0 0 18px ${color.glow}`,
        }}
        animate={{ boxShadow: [`0 0 12px ${color.glow}`, `0 0 28px ${color.glow}`, `0 0 12px ${color.glow}`] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      >
        {color.name}
      </motion.div>
      <div className="text-[10px] font-semibold text-white/60">exp {expireStr}</div>
      <div className="flex flex-col items-center gap-0.5">
        {col.products.map((p) => (
          <div key={p} className="text-[9px] text-white/35 font-medium">{p}</div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Floating particles background ──
function Particles() {
  const particles = Array.from({ length: 20 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 4 + 2,
            height: Math.random() * 4 + 2,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: `rgba(255,255,255,${Math.random() * 0.15 + 0.05})`,
          }}
          animate={{
            y: [0, -30 - Math.random() * 40, 0],
            x: [0, (Math.random() - 0.5) * 20, 0],
            opacity: [0.1, 0.4, 0.1],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 4 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 4,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ── Main screensaver ──
export function IdleScreensaver({ onActivity }: { onActivity: () => void }) {
  const [now, setNow] = useState(new Date());
  const [secondsPulse, setSecondsPulse] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      setSecondsPulse((p) => !p);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;

  const hStr = String(h12).padStart(2, "0");
  const mStr = String(m).padStart(2, "0");
  const sStr = String(s).padStart(2, "0");

  const currentColor = getColorAtOffset(now, 0);
  const expiredColor1 = getColorAtOffset(now, -1);
  const expiredColor2 = getColorAtOffset(now, -2);
  const upcomingColor = getColorAtOffset(now, 1);

  const secsToNext = minutesToNextSlot(now);
  const minsToNext = Math.floor(secsToNext / 60);
  const secsRemainder = secsToNext % 60;

  // Date string
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-between overflow-hidden cursor-pointer select-none"
      style={{
        background: "linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 30%, #0a1628 60%, #0f1a0a 100%)",
      }}
      onClick={onActivity}
      onMouseMove={onActivity}
      onKeyDown={onActivity}
      tabIndex={0}
    >
      <Particles />

      {/* Radial glow behind clock */}
      <motion.div
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: 600, height: 300, background: `radial-gradient(ellipse, ${currentColor.glow} 0%, transparent 70%)` }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Top: date */}
      <div className="pt-8 text-center">
        <motion.p
          className="text-sm font-semibold uppercase tracking-[0.3em] text-white/40"
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          {dateStr}
        </motion.p>
      </div>

      {/* Clock */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-end gap-2">
          <ClockDigit value={hStr} label="hr" />
          <ColonSeparator pulse={true} />
          <ClockDigit value={mStr} label="min" />
          <ColonSeparator pulse={false} />
          <ClockDigit value={sStr} label="sec" />
          <motion.div
            className="mb-5 ml-2 font-black text-white/60 leading-none"
            style={{ fontSize: "clamp(1.5rem, 3vw, 2.5rem)" }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {ampm}
          </motion.div>
        </div>

        {/* Next slot countdown */}
        <motion.div
          className="flex items-center gap-2 rounded-full px-4 py-1.5"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: currentColor.bg, boxShadow: `0 0 8px ${currentColor.glow}` }}
          />
          <span className="text-xs font-semibold text-white/60">
            Next color change in{" "}
            <span className="font-black text-white/90">
              {minsToNext}:{String(secsRemainder).padStart(2, "0")}
            </span>
          </span>
        </motion.div>
      </div>

      {/* Color time tags section */}
      <div className="w-full max-w-5xl px-6 flex flex-col items-center gap-4">

        {/* Expired / Current / Upcoming strip */}
        <div className="flex items-end gap-3 justify-center">
          <ColorCard color={expiredColor2} label="Expired" sublabel={getExpireTimeStr(now, -2)} size="sm" expired />
          <ColorCard color={expiredColor1} label="Expired" sublabel={getExpireTimeStr(now, -1)} size="sm" expired />

          {/* Current — larger, glowing */}
          <motion.div
            className="flex flex-col items-center gap-1 px-6 py-4 rounded-2xl"
            style={{
              background: "rgba(255,255,255,0.1)",
              border: `1px solid ${currentColor.bg}55`,
              boxShadow: `0 0 40px ${currentColor.glow}`,
            }}
          >
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/60">Discard Now</div>
            <motion.div
              className="rounded-xl flex items-center justify-center font-black text-base"
              style={{
                background: currentColor.bg,
                color: currentColor.text,
                border: currentColor.border ? "2px solid rgba(0,0,0,0.15)" : undefined,
                width: 100,
                height: 50,
              }}
              animate={{ boxShadow: [`0 0 20px ${currentColor.glow}`, `0 0 50px ${currentColor.glow}`, `0 0 20px ${currentColor.glow}`] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              {currentColor.name}
            </motion.div>
            <div className="text-[10px] font-semibold text-white/50">exp {getExpireTimeStr(now, 0)}</div>
          </motion.div>

          <ColorCard color={upcomingColor} label="Up Next" sublabel={getExpireTimeStr(now, 1)} size="sm" upcoming />
        </div>

        {/* Divider */}
        <div className="w-full h-px" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Hold time columns */}
        <div className="flex gap-3 justify-center flex-wrap pb-2">
          {HOLD_COLUMNS.map((col) => (
            <HoldColumnCard key={col.label} col={col} now={now} />
          ))}
        </div>
      </div>

      {/* Bottom hint */}
      <motion.p
        className="pb-6 text-[11px] font-medium uppercase tracking-widest text-white/20"
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        Tap or move to return to dashboard
      </motion.p>
    </motion.div>
  );
}

// ── Idle detector hook ──
export function useIdleTimer(timeoutMs: number) {
  const [idle, setIdle] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const reset = useCallback(() => {
    setIdle(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIdle(true), timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset(); // start timer on mount
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reset]);

  return { idle, reset };
}

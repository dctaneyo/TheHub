// Sound effect utilities for task completions and celebrations

export type SoundType = 'complete' | 'bonus' | 'streak' | 'achievement' | 'levelup';

export function playTaskSound(type: 'cleaning' | 'reminder' | 'task' = 'task') {
  try {
    const ctx = new AudioContext();
    ctx.resume();

    const frequencies: Record<string, number[]> = {
      cleaning: [523.25, 659.25], // C5 -> E5 (clean, bright)
      reminder: [440, 554.37], // A4 -> C#5 (attention-grabbing)
      task: [392, 523.25], // G4 -> C5 (satisfying)
    };

    const notes = frequencies[type] || frequencies.task;
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.3);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.3);
    });

    setTimeout(() => ctx.close(), 500);
  } catch {}
}

export function playBonusSound() {
  try {
    const ctx = new AudioContext();
    ctx.resume();

    // Ascending arpeggio for bonus
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 -> E5 -> G5 -> C6
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.25);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.25);
    });

    setTimeout(() => ctx.close(), 600);
  } catch {}
}

export function playStreakSound() {
  try {
    const ctx = new AudioContext();
    ctx.resume();

    // Fire sound - crackling effect
    const notes = [880, 932.33, 987.77]; // A5 -> A#5 -> B5
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.05 + 0.2);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + i * 0.05);
      osc.stop(ctx.currentTime + i * 0.05 + 0.2);
    });

    setTimeout(() => ctx.close(), 400);
  } catch {}
}

export function playAchievementSound() {
  try {
    const ctx = new AudioContext();
    ctx.resume();

    // Triumphant fanfare
    const notes = [
      { freq: 523.25, start: 0, dur: 0.15 }, // C5
      { freq: 659.25, start: 0.15, dur: 0.15 }, // E5
      { freq: 783.99, start: 0.3, dur: 0.15 }, // G5
      { freq: 1046.50, start: 0.45, dur: 0.4 }, // C6 (hold)
    ];
    
    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    });

    setTimeout(() => ctx.close(), 1000);
  } catch {}
}

export function playLevelUpSound() {
  try {
    const ctx = new AudioContext();
    ctx.resume();

    // Epic level up sound
    const notes = [
      { freq: 392, start: 0, dur: 0.1 }, // G4
      { freq: 523.25, start: 0.1, dur: 0.1 }, // C5
      { freq: 659.25, start: 0.2, dur: 0.1 }, // E5
      { freq: 783.99, start: 0.3, dur: 0.1 }, // G5
      { freq: 1046.50, start: 0.4, dur: 0.5 }, // C6 (hold)
    ];
    
    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0.2, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    });

    setTimeout(() => ctx.close(), 1000);
  } catch {}
}

// ── Soundscape System ─────────────────────────────────────────────

import type { DayPhase } from "@/lib/day-phase-context";

export type SoundscapeEvent = "task-due" | "task-completed" | "task-overdue";
export type SoundscapeIntensity = "off" | "subtle" | "normal";

const SOUNDSCAPE_INTENSITY_KEY = "hub-soundscape-intensity";

/** Get the current soundscape intensity from sessionStorage. */
export function getSoundscapeIntensity(): SoundscapeIntensity {
  if (typeof window === "undefined") return "normal";
  const val = sessionStorage.getItem(SOUNDSCAPE_INTENSITY_KEY);
  if (val === "off" || val === "subtle" || val === "normal") return val;
  return "normal";
}

/** Set the soundscape intensity in sessionStorage. */
export function setSoundscapeIntensity(intensity: SoundscapeIntensity): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SOUNDSCAPE_INTENSITY_KEY, intensity);
}

/** Check if current local time is within quiet hours (23:00–05:00). */
function isQuietHours(): boolean {
  const hour = new Date().getHours();
  return hour >= 23 || hour < 5;
}

/** Determine phase group for sound profile selection. */
function getPhaseGroup(phase: DayPhase): "warm" | "bright" | "soft" {
  if (phase === "dawn" || phase === "morning") return "warm";
  if (phase === "midday" || phase === "afternoon") return "bright";
  return "soft"; // evening, night
}

/**
 * Play a soundscape chime based on the current day phase and event type.
 * Respects quiet hours, mute state, and intensity settings.
 */
export function playSoundscapeChime(phase: DayPhase, event: SoundscapeEvent): void {
  // Quiet hours — no sounds at all
  if (isQuietHours()) return;

  const intensity = getSoundscapeIntensity();
  if (intensity === "off") return;

  // Subtle mode: only completion and overdue sounds
  if (intensity === "subtle" && event === "task-due") return;

  const gainMultiplier = intensity === "subtle" ? 0.5 : 1.0;

  try {
    switch (event) {
      case "task-due":
        playTaskDueChime(phase, gainMultiplier);
        break;
      case "task-completed":
        playTaskCompletedThunk(gainMultiplier);
        break;
      case "task-overdue":
        playTaskOverdueTone(phase, gainMultiplier);
        break;
    }
  } catch {
    // Silently fail — audio is non-critical
  }
}

/** Task due: gentle, phase-appropriate chime. */
function playTaskDueChime(phase: DayPhase, gainMul: number): void {
  const ctx = new AudioContext();
  ctx.resume();

  const group = getPhaseGroup(phase);

  // Dawn/Morning: Warm sine chime C4→E4
  // Midday/Afternoon: Bright triangle chime E5→G5
  // Evening/Night: Soft sine bell G3→B3
  const profiles: Record<"warm" | "bright" | "soft", { notes: number[]; type: OscillatorType; baseGain: number }> = {
    warm:   { notes: [261.63, 329.63], type: "sine",     baseGain: 0.12 },  // C4→E4
    bright: { notes: [659.25, 783.99], type: "triangle",  baseGain: 0.10 },  // E5→G5
    soft:   { notes: [196.00, 246.94], type: "sine",     baseGain: 0.08 },  // G3→B3
  };

  const { notes, type, baseGain } = profiles[group];
  const gain = baseGain * gainMul;

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime + i * 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(ctx.currentTime + i * 0.15);
    osc.stop(ctx.currentTime + i * 0.15 + 0.4);
  });

  setTimeout(() => ctx.close(), 700);
}

/** Task completed: low "thunk" — sine 80Hz, 200ms, consistent across all phases. */
function playTaskCompletedThunk(gainMul: number): void {
  const ctx = new AudioContext();
  ctx.resume();

  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 80;
  g.gain.setValueAtTime(0.15 * gainMul, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);

  setTimeout(() => ctx.close(), 400);
}

/** Task overdue: rising tone 200Hz→600Hz sweep over 2s. */
function playTaskOverdueTone(phase: DayPhase, gainMul: number): void {
  const ctx = new AudioContext();
  ctx.resume();

  const group = getPhaseGroup(phase);

  // Dawn/Morning: sine wave
  // Midday/Afternoon: triangle wave
  // Evening/Night: sine wave but quieter (gain 0.08)
  const waveType: OscillatorType = group === "bright" ? "triangle" : "sine";
  const baseGain = group === "soft" ? 0.08 : 0.12;

  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = waveType;
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 2);
  g.gain.setValueAtTime(baseGain * gainMul, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 2);

  setTimeout(() => ctx.close(), 2500);
}

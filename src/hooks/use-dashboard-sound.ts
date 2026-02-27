"use client";

import { useState, useEffect, useCallback } from "react";
import { useSocket } from "@/lib/socket-context";

/**
 * Manages sound state for the dashboard:
 * - Loads mute state from server
 * - Listens for ARL-driven mute toggle via socket
 * - Provides toggle function that syncs to server
 * - Provides playChime for color expiry announcements
 */
export function useDashboardSound() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const { socket } = useSocket();

  // Load sound state from server on mount
  useEffect(() => {
    fetch("/api/locations/sound")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setSoundEnabled(!d.muted);
      })
      .catch(() => {});
  }, []);

  // Listen for ARL-driven toggle
  useEffect(() => {
    if (!socket) return;
    const handler = (data: { muted: boolean }) => setSoundEnabled(!data.muted);
    socket.on("location:sound-toggle", handler);
    return () => {
      socket.off("location:sound-toggle", handler);
    };
  }, [socket]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      fetch("/api/locations/sound", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muted: !next }),
      }).catch(() => {});
      return next;
    });
  }, []);

  // Rising 3-note chime: C5 → E5 → G5 (for color expiry announcements)
  const playChime = useCallback((onDone: () => void) => {
    try {
      const ctx = new AudioContext();
      const go = () => {
        const notes = [
          { freq: 523.25, start: 0, dur: 0.55 },
          { freq: 659.25, start: 0.35, dur: 0.55 },
          { freq: 783.99, start: 0.7, dur: 0.9 },
        ];
        notes.forEach(({ freq, start, dur }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, ctx.currentTime + start);
          gain.gain.linearRampToValueAtTime(0.28, ctx.currentTime + start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + dur);
        });
        setTimeout(() => {
          onDone();
          ctx.close();
        }, 1800 + 150);
      };
      if (ctx.state === "suspended") {
        ctx.resume().then(go).catch(() => onDone());
      } else {
        go();
      }
    } catch {
      onDone();
    }
  }, []);

  return { soundEnabled, toggleSound, playChime };
}

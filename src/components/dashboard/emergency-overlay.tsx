"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";

interface EmergencyMessage {
  id: string;
  message: string;
  sentByName: string;
  createdAt: string;
}

export function EmergencyOverlay() {
  const [activeMessage, setActiveMessage] = useState<EmergencyMessage | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const alarmRef = useRef<NodeJS.Timeout | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const revealedRef = useRef(false);

  const stopAlarm = useCallback(() => {
    if (alarmRef.current) {
      clearInterval(alarmRef.current);
      alarmRef.current = null;
    }
  }, []);

  const playAlert = useCallback(() => {
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;

      const playTone = (freq: number, startTime: number, duration: number, vol = 0.3) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const t = ctx.currentTime;
      playTone(880, t, 0.15);
      playTone(880, t + 0.2, 0.15);
      playTone(880, t + 0.4, 0.15);
      playTone(660, t + 0.65, 0.3);
    } catch {}
  }, []);

  const startRepeatingAlarm = useCallback(() => {
    stopAlarm();
    playAlert();
    // Repeat every 4 seconds until revealed
    alarmRef.current = setInterval(() => {
      if (!revealedRef.current) {
        playAlert();
      } else {
        stopAlarm();
      }
    }, 4000);
  }, [playAlert, stopAlarm]);

  const fetchMessage = useCallback(async () => {
    try {
      const res = await fetch("/api/emergency", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const msg: EmergencyMessage | null = data.message;

      if (msg && msg.id !== lastIdRef.current && msg.id !== dismissed) {
        lastIdRef.current = msg.id;
        revealedRef.current = false;
        setActiveMessage(msg);
        setRevealed(false);
        startRepeatingAlarm();
      } else if (!msg) {
        stopAlarm();
        setActiveMessage(null);
        setRevealed(false);
        revealedRef.current = false;
        lastIdRef.current = null;
      }
    } catch {}
  }, [dismissed, startRepeatingAlarm, stopAlarm]);

  useEffect(() => {
    fetchMessage();
    pollRef.current = setInterval(fetchMessage, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      stopAlarm();
    };
  }, [fetchMessage, stopAlarm]);

  const handleReveal = async () => {
    revealedRef.current = true;
    setRevealed(true);
    stopAlarm();
    // Mark as viewed on the server
    if (activeMessage) {
      try {
        await fetch("/api/emergency", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: activeMessage.id }),
        });
      } catch {}
    }
    // Play a softer confirmation tone
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 440;
      gain.gain.value = 0.1;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  };

  const handleDismiss = async () => {
    if (activeMessage) {
      stopAlarm();
      // Mark viewed server-side so it doesn't re-appear after logout
      try {
        await fetch("/api/emergency", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: activeMessage.id }),
        });
      } catch {}
      setDismissed(activeMessage.id);
      setActiveMessage(null);
      setRevealed(false);
      revealedRef.current = false;
    }
  };

  return (
    <AnimatePresence>
      {activeMessage && (
        <motion.div
          key={activeMessage.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
        >
          {/* Pulsing red border */}
          <motion.div
            animate={{ boxShadow: ["0 0 0 0 rgba(220,38,38,0.7)", "0 0 0 20px rgba(220,38,38,0)", "0 0 0 0 rgba(220,38,38,0)"] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-full max-w-xl mx-4 rounded-3xl bg-white overflow-hidden"
          >
            {/* Red header */}
            <div className="bg-[var(--hub-red)] px-6 py-5 flex items-center gap-3">
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                <AlertTriangle className="h-8 w-8 text-white" />
              </motion.div>
              <div>
                <h2 className="text-xl font-black text-white tracking-wide">EMERGENCY MESSAGE</h2>
                <p className="text-[11px] text-red-100 mt-0.5">From {activeMessage.sentByName}</p>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-6">
              {!revealed ? (
                <div className="text-center">
                  <p className="text-sm text-slate-500 mb-4">An urgent message has been sent to your location.</p>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleReveal}
                    className="w-full rounded-2xl bg-[var(--hub-red)] py-4 text-base font-bold text-white shadow-lg hover:bg-[#c4001f] transition-colors"
                  >
                    Tap to View Message
                  </motion.button>
                </div>
              ) : (
                <div>
                  <p className="text-base font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {activeMessage.message}
                  </p>
                  <button
                    onClick={handleDismiss}
                    className="mt-5 w-full rounded-2xl border-2 border-slate-200 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

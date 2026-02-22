"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Volume2, VolumeX } from "lucide-react";
import { useSocket } from "@/lib/socket-context";

type MascotState = "idle" | "celebrating" | "cheering" | "worried" | "dancing" | "sleeping" | "waving";

interface MascotMessage {
  text: string;
  duration?: number;
}

const MASCOT_MESSAGES: Record<MascotState, string[]> = {
  idle: [
    "Looking good today! 🍗",
    "Ready to crush some tasks?",
    "You've got this!",
    "Keep up the great work!",
    "Finger lickin' good progress!",
  ],
  celebrating: [
    "Woohoo! Task complete! 🎉",
    "You're on fire! 🔥",
    "That's what I'm talkin' about!",
    "Crushed it! 💪",
    "Absolutely legendary!",
  ],
  cheering: [
    "Go go go! 📣",
    "You can do it!",
    "Almost there!",
    "Keep pushing!",
    "Don't give up!",
  ],
  worried: [
    "Uh oh, task overdue! ⏰",
    "Time to catch up!",
    "Let's get back on track!",
    "No worries, you got this!",
  ],
  dancing: [
    "Streak going strong! 🕺",
    "Look at you go!",
    "Can't stop won't stop!",
    "You're unstoppable!",
  ],
  sleeping: [
    "Zzz... 😴",
    "Quiet hours...",
    "Sweet dreams!",
  ],
  waving: [
    "Hey there! 👋",
    "Welcome back!",
    "Good to see you!",
    "Let's make today great!",
  ],
};

export function KFCMascot() {
  const [state, setState] = useState<MascotState>("idle");
  const [message, setMessage] = useState<MascotMessage | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const { socket } = useSocket();

  const showMessage = useCallback((newState: MascotState, duration = 3000) => {
    const messages = MASCOT_MESSAGES[newState];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    setState(newState);
    setMessage({ text: randomMessage, duration });

    setTimeout(() => {
      setState("idle");
      setMessage(null);
    }, duration);
  }, []);

  // Listen to events
  useEffect(() => {
    if (!socket) return;

    const handleTaskCompleted = () => {
      showMessage("celebrating", 4000);
    };

    const handleHighFive = () => {
      showMessage("dancing", 3000);
    };

    const handleShoutout = () => {
      showMessage("cheering", 3000);
    };

    socket.on("task:completed", handleTaskCompleted);
    socket.on("highfive:received", handleHighFive);
    socket.on("shoutout:new", handleShoutout);

    return () => {
      socket.off("task:completed", handleTaskCompleted);
      socket.off("highfive:received", handleHighFive);
      socket.off("shoutout:new", handleShoutout);
    };
  }, [socket, showMessage]);

  // Wave on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      showMessage("waving", 2000);
    }, 1000);
    return () => clearTimeout(timer);
  }, [showMessage]);

  // Idle animation cycle
  useEffect(() => {
    if (state !== "idle") return;

    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const messages = MASCOT_MESSAGES.idle;
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        setMessage({ text: randomMessage, duration: 2000 });
        setTimeout(() => setMessage(null), 2000);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [state]);

  if (!isVisible) return null;

  const getMascotAnimation = () => {
    switch (state) {
      case "celebrating":
        return {
          scale: [1, 1.2, 1, 1.1, 1],
          rotate: [0, -10, 10, -5, 0],
          y: [0, -20, 0, -10, 0],
        };
      case "dancing":
        return {
          rotate: [-5, 5, -5, 5, 0],
          x: [-5, 5, -5, 5, 0],
        };
      case "worried":
        return {
          x: [-3, 3, -3, 3, 0],
        };
      case "waving":
        return {
          rotate: [0, 15, -15, 15, 0],
        };
      case "cheering":
        return {
          y: [0, -10, 0, -5, 0],
          scale: [1, 1.1, 1, 1.05, 1],
        };
      default:
        return {
          y: [0, -5, 0],
        };
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {/* Message bubble */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            className="relative max-w-xs rounded-2xl bg-white border-2 border-orange-400 px-4 py-3 shadow-lg"
          >
            <p className="text-sm font-medium text-slate-700">{message.text}</p>
            <div className="absolute -bottom-2 right-8 h-4 w-4 rotate-45 border-b-2 border-r-2 border-orange-400 bg-white" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mascot container */}
      <div className="relative">
        {/* Controls */}
        <div className="absolute -top-2 -left-2 flex gap-1">
          <button
            onClick={() => setIsSoundEnabled(!isSoundEnabled)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors"
            title={isSoundEnabled ? "Mute mascot" : "Unmute mascot"}
          >
            {isSoundEnabled ? (
              <Volume2 className="h-3 w-3 text-slate-600" />
            ) : (
              <VolumeX className="h-3 w-3 text-slate-400" />
            )}
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors"
            title="Hide mascot"
          >
            <X className="h-3 w-3 text-slate-600" />
          </button>
        </div>

        {/* Mascot */}
        <motion.div
          animate={getMascotAnimation()}
          transition={{
            duration: state === "idle" ? 2 : 0.6,
            repeat: state === "idle" ? Infinity : 0,
            repeatType: "reverse",
          }}
          onClick={() => showMessage("idle", 2000)}
          className="relative cursor-pointer"
        >
          {/* Mascot character - using emoji for now, can be replaced with SVG */}
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 shadow-xl border-4 border-white">
            <span className="text-5xl">
              {state === "celebrating" && "🎉"}
              {state === "dancing" && "🕺"}
              {state === "worried" && "😰"}
              {state === "sleeping" && "😴"}
              {state === "waving" && "👋"}
              {state === "cheering" && "📣"}
              {state === "idle" && "🍗"}
            </span>
          </div>

          {/* Glow effect */}
          {(state === "celebrating" || state === "dancing") && (
            <motion.div
              className="absolute inset-0 rounded-full bg-orange-400 opacity-50 blur-xl"
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.3, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </motion.div>
      </div>

      {/* Show mascot button when hidden */}
      {!isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setIsVisible(true)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 shadow-lg hover:shadow-xl transition-shadow border-2 border-white"
          title="Show mascot"
        >
          <span className="text-2xl">🍗</span>
        </motion.button>
      )}
    </div>
  );
}

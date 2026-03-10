"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/lib/socket-context";

/**
 * Renders the ARL admin's cursor on the target user's dashboard
 * when the ARL has enabled cursor visibility in mirror mode.
 */
export function ArlCursorOverlay({ remoteViewActive }: { remoteViewActive: boolean }) {
  const { socket } = useSocket();
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!socket || !remoteViewActive) return;

    const onToggle = (data: { sessionId: string; visible: boolean }) => {
      setVisible(data.visible);
      if (!data.visible) setPos({ x: -1, y: -1 });
    };

    const onCursor = (data: { sessionId: string; x: number; y: number; visible: boolean }) => {
      if (!data.visible) {
        setVisible(false);
        return;
      }
      setVisible(true);
      setPos({ x: data.x, y: data.y });

      // Auto-hide after 3s of no movement
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
      hideTimeout.current = setTimeout(() => setVisible(false), 3000);
    };

    socket.on("mirror:arl-cursor-toggle", onToggle);
    socket.on("mirror:arl-cursor", onCursor);

    return () => {
      socket.off("mirror:arl-cursor-toggle", onToggle);
      socket.off("mirror:arl-cursor", onCursor);
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, [socket, remoteViewActive]);

  if (!remoteViewActive || !visible || pos.x < 0) return null;

  const left = pos.x * 100;
  const top = pos.y * 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0 }}
        data-remote-view-overlay="true"
        className="fixed z-[9997] pointer-events-none"
        style={{ left: `${left}%`, top: `${top}%` }}
      >
        {/* Cursor arrow */}
        <svg width="24" height="24" viewBox="0 0 24 24" className="drop-shadow-lg" style={{ transform: "translate(-2px, -2px)" }}>
          <path
            d="M5 3l14 8-6.5 2L9 19.5 5 3z"
            fill="rgba(99, 102, 241, 0.9)"
            stroke="white"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        {/* Label */}
        <div className="absolute left-5 top-4 whitespace-nowrap rounded-md bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md">
          Admin
        </div>
        {/* Ripple ring */}
        <div className="absolute -left-2 -top-2 h-8 w-8 rounded-full border-2 border-indigo-400/50 animate-ping" />
      </motion.div>
    </AnimatePresence>
  );
}

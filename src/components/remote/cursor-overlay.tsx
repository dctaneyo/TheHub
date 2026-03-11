"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/lib/socket-context";
import { useMirror } from "@/lib/mirror-context";

interface ClickRipple {
  id: number;
  x: number;
  y: number;
}

export function CursorOverlay() {
  const { isMirroring, remoteCursor, targetDevice, sessionId } = useMirror();
  const { socket } = useSocket();
  const [clicks, setClicks] = useState<ClickRipple[]>([]);
  const clickIdRef = useRef(0);

  // Listen for remote click events to show ripple
  useEffect(() => {
    if (!socket || !sessionId) return;
    const onRemoteClick = (data: { sessionId: string; x: number; y: number }) => {
      if (data.sessionId !== sessionId) return;
      const id = ++clickIdRef.current;
      setClicks(prev => [...prev, { id, x: data.x, y: data.y }]);
      setTimeout(() => {
        setClicks(prev => prev.filter(c => c.id !== id));
      }, 600);
    };
    socket.on("mirror:click", onRemoteClick);
    return () => { socket.off("mirror:click", onRemoteClick); };
  }, [socket, sessionId]);

  if (!isMirroring || !remoteCursor) return null;

  // Scale cursor position if target device differs from current viewport
  const scaleX = targetDevice ? window.innerWidth / targetDevice.width : 1;
  const scaleY = targetDevice ? window.innerHeight / targetDevice.height : 1;
  const cx = remoteCursor.x * scaleX;
  const cy = remoteCursor.y * scaleY;

  return (
    <div
      data-remote-view-overlay="true"
      className="fixed inset-0 z-[9999] pointer-events-none"
    >
      {/* Remote cursor indicator — arrow design matching ARL cursor */}
      <motion.div
        animate={{ x: cx, y: cy }}
        transition={{ type: "spring", stiffness: 500, damping: 30, mass: 0.5 }}
        className="absolute top-0 left-0"
      >
        {/* Cursor arrow */}
        <svg width="24" height="24" viewBox="0 0 24 24" className="drop-shadow-lg" style={{ transform: "translate(-2px, -2px)" }}>
          <path
            d="M5 3l14 8-6.5 2L9 19.5 5 3z"
            fill="rgba(239, 68, 68, 0.9)"
            stroke="white"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        {/* Label */}
        <div className="absolute left-5 top-4 whitespace-nowrap rounded-md bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md">
          Remote
        </div>
        {/* Ripple ring */}
        <div className="absolute -left-2 -top-2 h-8 w-8 rounded-full border-2 border-red-400/50 animate-ping" />
      </motion.div>

      {/* Click ripple effects */}
      <AnimatePresence>
        {clicks.map(click => (
          <motion.div
            key={click.id}
            initial={{ scale: 0.3, opacity: 0.8 }}
            animate={{ scale: 2.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute rounded-full border-2 border-red-400 bg-red-400/20"
            style={{
              left: click.x * scaleX - 20,
              top: click.y * scaleY - 20,
              width: 40,
              height: 40,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

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
      {/* Remote cursor indicator */}
      <motion.div
        animate={{ x: cx - 12, y: cy - 12 }}
        transition={{ type: "spring", stiffness: 500, damping: 30, mass: 0.5 }}
        className="absolute top-0 left-0"
        style={{ width: 24, height: 24 }}
      >
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-2 border-red-500 bg-red-500/10" />
        {/* Inner dot */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
        {/* Label */}
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-red-500 px-2 py-0.5 text-[8px] font-bold text-white shadow-lg">
          Remote
        </div>
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

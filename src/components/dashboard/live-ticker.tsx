"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/lib/socket-context";

interface TickerItem {
  id: string;
  text: string;
  icon: string;
  timestamp: number;
}

const MAX_ITEMS = 20;
const TICKER_SPEED_PX = 65; // px/s — matches GridTickerBar

export function LiveTicker({ currentLocationId }: { currentLocationId?: string }) {
  const [items, setItems] = useState<TickerItem[]>([]);
  const { socket } = useSocket();
  const containerRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const animRef = useRef<number>(0);
  const posRef = useRef<number | null>(null);

  // Hydrate from localStorage + ARL-pushed messages on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("dashboard-ticker");
      if (stored) setItems(JSON.parse(stored).slice(0, MAX_ITEMS));
    } catch {}

    fetch("/api/ticker")
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((data) => {
        const arlItems: TickerItem[] = (data.messages || []).map(
          (m: { id: string; icon: string; content: string; arlName: string; createdAt: string }) => ({
            id: `arl-${m.id}`,
            text: `${m.content} — ${m.arlName}`,
            icon: m.icon,
            timestamp: new Date(m.createdAt).getTime(),
          }),
        );
        if (arlItems.length > 0) setItems((prev) => [...arlItems, ...prev].slice(0, MAX_ITEMS));
      })
      .catch(() => {});
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (items.length > 0) localStorage.setItem("dashboard-ticker", JSON.stringify(items));
  }, [items]);

  // Socket events — task completions + ARL ticker messages only (no gamification)
  useEffect(() => {
    if (!socket) return;

    const add = (item: TickerItem) =>
      setItems((prev) => [item, ...prev].slice(0, MAX_ITEMS));

    const onTaskCompleted = (d: { locationId?: string; locationName?: string; taskTitle?: string; taskId?: string }) => {
      if (currentLocationId && d.locationId === currentLocationId) return;
      add({
        id: `task-${d.taskId}-${Date.now()}`,
        text: `${d.locationName || "A location"} completed "${d.taskTitle}"`,
        icon: "✅",
        timestamp: Date.now(),
      });
    };

    const onTaskUncompleted = (d: { taskId?: string }) => {
      if (d.taskId) setItems((prev) => prev.filter((i) => !i.id.startsWith(`task-${d.taskId}-`)));
    };

    const onTickerNew = (d: { id: string; icon: string; content: string; arlName: string }) => {
      add({
        id: `arl-${d.id}`,
        text: `${d.content} — ${d.arlName}`,
        icon: d.icon,
        timestamp: Date.now(),
      });
    };

    const onTickerDelete = (d: { id: string }) => {
      setItems((prev) => prev.filter((i) => i.id !== `arl-${d.id}`));
    };

    socket.on("task:completed", onTaskCompleted);
    socket.on("task:uncompleted", onTaskUncompleted);
    socket.on("ticker:new", onTickerNew);
    socket.on("ticker:delete", onTickerDelete);

    return () => {
      socket.off("task:completed", onTaskCompleted);
      socket.off("task:uncompleted", onTaskUncompleted);
      socket.off("ticker:new", onTickerNew);
      socket.off("ticker:delete", onTickerDelete);
    };
  }, [socket, currentLocationId]);

  // RAF scroll: single copy, starts at container right edge, exits left, loops.
  // Gated on `hasItems` only — never restarts when item list grows.
  const hasItems = items.length > 0;

  const fmt = (ts: number) =>
    new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  const tickerText = hasItems
    ? items.map((i) => `${i.icon}  ${i.text}  ·  ${fmt(i.timestamp)}`).join("          ")
    : "";

  useEffect(() => {
    if (!hasItems) return;

    if (posRef.current === null) posRef.current = 0;

    let last = performance.now();
    let running = true;

    const tick = (now: number) => {
      if (!running) return;
      const dt = (now - last) / 1000;
      last = now;

      const container = containerRef.current;
      const span = spanRef.current;
      if (container && span) {
        const cw = container.clientWidth;
        const sw = span.offsetWidth;

        if (posRef.current === null || posRef.current === 0) {
          posRef.current = cw;
        }

        posRef.current -= TICKER_SPEED_PX * dt;

        if (posRef.current < -sw) posRef.current = cw;

        span.style.transform = `translateX(${posRef.current}px)`;
      }

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      posRef.current = null;
    };
  }, [hasItems]);

  return (
    <AnimatePresence initial={false}>
      {hasItems && (
        <motion.div
          key="ticker"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
          className="mx-3 mb-3 flex h-9 shrink-0 items-center overflow-hidden rounded-full bg-card/80 shadow-sm"
        >
          {/* LIVE badge — rounded left, flat right */}
          <div className="flex h-full shrink-0 items-center gap-1.5 rounded-l-full bg-primary px-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-foreground" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
              Live
            </span>
          </div>

          {/* Scrolling text — single copy, RAF */}
          <div
            ref={containerRef}
            className="relative min-w-0 flex-1 overflow-hidden"
            style={{ height: "100%" }}
          >
            <span
              ref={spanRef}
              className="absolute inset-y-0 flex items-center whitespace-nowrap text-xs font-medium text-foreground/80"
              style={{
                paddingLeft: "1.5rem",
                paddingRight: "1.5rem",
                transform: "translateX(9999px)",
              }}
            >
              {tickerText}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

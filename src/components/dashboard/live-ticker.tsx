"use client";

import { useState, useEffect, useRef } from "react";
import { useSocket } from "@/lib/socket-context";
import { Zap } from "lucide-react";

interface TickerItem {
  id: string;
  text: string;
  icon: string;
  timestamp: number;
}

const MAX_ITEMS = 20;
const TICKER_SPEED = 60; // pixels per second

export function LiveTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const { socket } = useSocket();
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const posRef = useRef(0);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("dashboard-ticker");
      if (stored) setItems(JSON.parse(stored).slice(0, MAX_ITEMS));
    } catch {}
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (items.length > 0) {
      localStorage.setItem("dashboard-ticker", JSON.stringify(items));
    }
  }, [items]);

  // Listen for events
  useEffect(() => {
    if (!socket) return;

    const addItem = (item: TickerItem) => {
      setItems(prev => [item, ...prev].slice(0, MAX_ITEMS));
    };

    const handleTaskCompleted = (data: { locationName?: string; taskTitle?: string; taskId?: string }) => {
      addItem({
        id: `task-${data.taskId}-${Date.now()}`,
        text: `${data.locationName || "A location"} completed "${data.taskTitle}"`,
        icon: "✅",
        timestamp: Date.now(),
      });
    };

    const handleHighFive = (data: { from_user_name?: string; to_user_name?: string; id?: string }) => {
      addItem({
        id: `hf-${data.id}-${Date.now()}`,
        text: `${data.from_user_name} sent a high-five to ${data.to_user_name}!`,
        icon: "🙌",
        timestamp: Date.now(),
      });
    };

    const handleShoutout = (data: { from_user_name?: string; to_location_name?: string; id?: string; message?: string }) => {
      addItem({
        id: `shout-${data.id}-${Date.now()}`,
        text: `${data.from_user_name} gave a shoutout to ${data.to_location_name}: "${data.message}"`,
        icon: "📣",
        timestamp: Date.now(),
      });
    };

    socket.on("task:completed", handleTaskCompleted);
    socket.on("high-five:received", handleHighFive);
    socket.on("shoutout:new", handleShoutout);

    return () => {
      socket.off("task:completed", handleTaskCompleted);
      socket.off("high-five:received", handleHighFive);
      socket.off("shoutout:new", handleShoutout);
    };
  }, [socket]);

  // Scrolling animation
  useEffect(() => {
    if (items.length === 0) return;

    let lastTime = performance.now();
    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const content = contentRef.current;
      const container = containerRef.current;
      if (!content || !container) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }

      const contentWidth = content.scrollWidth / 2; // we duplicate content
      posRef.current -= TICKER_SPEED * dt;

      // Reset when first copy scrolls fully off
      if (Math.abs(posRef.current) >= contentWidth) {
        posRef.current += contentWidth;
      }

      content.style.transform = `translateX(${posRef.current}px)`;
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [items.length]);

  if (items.length === 0) return null;

  // Build ticker string with timestamps — duplicate for seamless loop
  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const tickerContent = items.map(item => `${item.icon} ${item.text}  ⏐  ${formatTime(item.timestamp)}`).join("     •     ");

  return (
    <div className="w-full bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 border-b border-slate-700/50 overflow-hidden shrink-0">
      <div className="flex items-center h-8">
        <div className="flex items-center gap-1.5 px-3 bg-red-600 h-full shrink-0 z-10">
          <Zap className="h-3 w-3 text-white" />
          <span className="text-[10px] font-bold text-white uppercase tracking-wider whitespace-nowrap">Live</span>
        </div>
        <div ref={containerRef} className="flex-1 overflow-hidden relative">
          <div ref={contentRef} className="flex whitespace-nowrap will-change-transform">
            <span className="text-xs text-slate-300 font-medium px-4">
              {tickerContent}
            </span>
            <span className="text-xs text-slate-300 font-medium px-4">
              {tickerContent}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

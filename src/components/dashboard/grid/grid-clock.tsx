"use client";

import { useEffect, useRef, useState } from "react";

export function ClockWidget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const [fontSize, setFontSize] = useState(48);

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Scale font to fill the widget — measure the container and derive a size
  // that makes the time string comfortably fill ~80% of the width.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      // Time string is ~7-8 characters in "H:MM:SS AM" format.
      // A monospace em is ~0.6× wide, so fontSize ≈ width / (chars * 0.6).
      // We also cap by height so it doesn't overflow vertically.
      // "12:00:00 PM" = 11 chars; monospace em ≈ 0.6× → need width / (11 * 0.6) ≈ /6.6
      const byWidth = Math.floor(width / 6.5);
      const byHeight = Math.floor(height / 2.4);
      setFontSize(Math.max(16, Math.min(byWidth, byHeight)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const time = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

  const date = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full select-none flex-col items-center justify-center gap-1 overflow-hidden p-3"
    >
      <span
        className="whitespace-nowrap font-mono font-black tabular-nums leading-none text-foreground"
        style={{ fontSize }}
      >
        {time}
      </span>
      <span
        className="font-medium text-muted-foreground"
        style={{ fontSize: Math.max(10, Math.floor(fontSize * 0.28)) }}
      >
        {date}
      </span>
    </div>
  );
}

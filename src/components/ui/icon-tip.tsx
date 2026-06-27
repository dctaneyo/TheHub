"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Touch-compatible label for icon-only controls. A bare `title` attribute is
 * hover-triggered and doesn't function on a touchscreen kiosk (Section 13/14
 * of DESIGN.md) — this shows the same label as a small bubble while the
 * control is actively pressed, so the explanation is reachable by touch.
 * Keep `title` on the wrapped element too; it still helps mouse/AT users.
 *
 * Wraps children in a `display: contents` element rather than cloning them
 * to merge handlers — `display: contents` is invisible to layout (so it
 * can't hijack the positioning context of a child that's itself
 * `absolute`-positioned relative to a further-out ancestor, e.g. the widget
 * card's floating expand/collapse buttons), but pointer events still bubble
 * through it normally, so the child's own handlers (e.g. the resize
 * handle's drag-start logic) keep firing untouched — no prop-merging needed.
 *
 * Positions the bubble itself via a measured fixed-position portal (same
 * technique as the onscreen keyboard's character-preview bubble).
 */
export function IconTip({
  label,
  side = "bottom",
  children,
}: {
  label: string;
  side?: "top" | "bottom";
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  const reveal = useCallback(() => {
    const timer = hideTimer.current;
    if (timer) clearTimeout(timer);
    const el = wrapperRef.current?.firstElementChild;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      x: rect.left + rect.width / 2,
      y: side === "top" ? rect.top : rect.bottom,
    });
  }, [side]);

  const conceal = useCallback(() => {
    hideTimer.current = setTimeout(() => setPos(null), 50);
  }, []);

  return (
    <span
      ref={wrapperRef}
      style={{ display: "contents" }}
      onPointerDown={reveal}
      onPointerUp={conceal}
      onPointerLeave={conceal}
    >
      {children}
      {pos &&
        createPortal(
          <span
            role="tooltip"
            className={cn(
              "pointer-events-none fixed z-[9999] -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-semibold text-background",
              side === "top" ? "-translate-y-full -mt-2" : "mt-2"
            )}
            style={{ left: pos.x, top: pos.y }}
          >
            {label}
          </span>,
          document.body
        )}
    </span>
  );
}

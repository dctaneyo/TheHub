"use client";

import { useRef, useCallback, useEffect } from "react";

interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  disabled?: boolean;
}

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
  disabled = false,
}: UseSwipeOptions) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled) return;
    startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, [disabled]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (disabled || !startRef.current) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - startRef.current.x;
    const dy = endY - startRef.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Determine dominant direction
    if (absDx > absDy && absDx > threshold) {
      if (dx > 0) onSwipeRight?.();
      else onSwipeLeft?.();
    } else if (absDy > absDx && absDy > threshold) {
      if (dy > 0) onSwipeDown?.();
      else onSwipeUp?.();
    }

    startRef.current = null;
  }, [disabled, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);

  return elementRef;
}

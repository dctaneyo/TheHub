"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * #15: Swipe gesture detection for navigating between views
 */
export function useSwipeNavigation(
  viewIds: string[],
  activeView: string,
  setActiveView: (view: string) => void,
  enabled = true
) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swiping = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      swiping.current = true;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!swiping.current) return;
      swiping.current = false;

      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;

      // Only trigger if horizontal swipe is dominant and > 80px
      if (Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx) * 0.6) return;

      const currentIndex = viewIds.indexOf(activeView);
      if (currentIndex === -1) return;

      if (dx < 0 && currentIndex < viewIds.length - 1) {
        // Swipe left → next view
        setActiveView(viewIds[currentIndex + 1]);
      } else if (dx > 0 && currentIndex > 0) {
        // Swipe right → previous view
        setActiveView(viewIds[currentIndex - 1]);
      }
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [viewIds, activeView, setActiveView, enabled]);
}

/**
 * #16: Pull-to-refresh detection
 */
export function usePullToRefresh(onRefresh: () => Promise<void> | void, enabled = true) {
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only activate if scrolled to top
      if (window.scrollY <= 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const handleTouchEnd = async (e: TouchEvent) => {
      if (!pulling.current) return;
      pulling.current = false;

      const dy = e.changedTouches[0].clientY - startY.current;
      if (dy > 100 && window.scrollY <= 0) {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      }
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onRefresh, enabled]);

  return refreshing;
}

/**
 * #18: Haptic feedback (vibration) for task completion
 */
export function useHapticFeedback() {
  return useCallback((pattern: number | number[] = 50) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  }, []);
}

/**
 * #20: Offline detection for showing banner
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const IDLE_MS = 90_000;
const WARNING_MS = 10_000;

/**
 * Kiosk-only "return to dashboard after inactivity" — the standard pattern
 * real kiosk software (POS systems, check-in kiosks, self-checkout) uses,
 * and the actual mitigation for the risk routed sub-pages introduce: a
 * kiosk walked away from mid-task on /tasks shouldn't sit there forever.
 *
 * Never silent — a countdown warning shows first and any interaction
 * cancels it, because an un-cancelable or silent redirect feels broken,
 * not helpful (DESIGN.md Section 16, User Flow: the user should always
 * know what's about to happen and have a way to stay).
 *
 * Caller is responsible for not mounting this on mobile (no idle-kiosk
 * risk on a personal phone) or in ARL (legitimately long idle periods
 * during real admin work) — see SubPageHeader, the only place this is
 * currently wired up.
 */
export function useInactivityRedirect(enabled: boolean, redirectTo = "/dashboard") {
  const router = useRouter();
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(WARNING_MS / 1000));
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAll = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
  }, []);

  const reset = useCallback(() => {
    clearAll();
    setWarning(false);
    setSecondsLeft(Math.ceil(WARNING_MS / 1000));
    if (!enabled) return;
    idleTimer.current = setTimeout(() => {
      setWarning(true);
      const startedAt = Date.now();
      tickTimer.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((WARNING_MS - (Date.now() - startedAt)) / 1000));
        setSecondsLeft(remaining);
      }, 250);
      warningTimer.current = setTimeout(() => {
        clearAll();
        router.push(redirectTo);
      }, WARNING_MS);
    }, IDLE_MS);
  }, [enabled, clearAll, router, redirectTo]);

  useEffect(() => {
    if (!enabled) {
      clearAll();
      setWarning(false);
      return;
    }
    reset();
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    const onActivity = () => reset();
    events.forEach((e) => window.addEventListener(e, onActivity));
    return () => {
      clearAll();
      events.forEach((e) => window.removeEventListener(e, onActivity));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { warning, secondsLeft, stay: reset };
}

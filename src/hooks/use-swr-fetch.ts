"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Lightweight SWR (stale-while-revalidate) fetch hook.
 * Shows cached data instantly, revalidates in background, updates UI when fresh data arrives.
 *
 * Usage:
 *   const { data, error, isLoading, mutate } = useSwrFetch<TaskItem[]>("/api/tasks/today");
 */

interface SwrState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  isValidating: boolean;
}

interface SwrOptions {
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
  revalidateInterval?: number; // ms, 0 = disabled
  dedupingInterval?: number;   // ms, prevent duplicate requests within this window
}

// Global in-memory cache shared across hook instances
const _cache = new Map<string, { data: any; timestamp: number }>();

const DEFAULT_OPTIONS: SwrOptions = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  revalidateInterval: 0,
  dedupingInterval: 2000,
};

export function useSwrFetch<T>(
  url: string | null,
  options: SwrOptions = {}
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [state, setState] = useState<SwrState<T>>(() => {
    const cached = url ? _cache.get(url) : null;
    return {
      data: cached ? cached.data : null,
      error: null,
      isLoading: !cached,
      isValidating: false,
    };
  });

  const lastFetchRef = useRef<number>(0);
  const mountedRef = useRef(true);

  const fetcher = useCallback(async (fetchUrl: string) => {
    const now = Date.now();
    // Deduping: skip if fetched recently
    if (now - lastFetchRef.current < (opts.dedupingInterval || 2000)) return;
    lastFetchRef.current = now;

    setState(prev => ({ ...prev, isValidating: true }));

    try {
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // Extract data from standardized response or use raw
      const data = json.data !== undefined ? json.data : json;

      _cache.set(fetchUrl, { data, timestamp: Date.now() });

      if (mountedRef.current) {
        setState({ data, error: null, isLoading: false, isValidating: false });
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: err.message || "Fetch failed",
          isLoading: false,
          isValidating: false,
        }));
      }
    }
  }, [opts.dedupingInterval]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    if (url) fetcher(url);
    return () => { mountedRef.current = false; };
  }, [url, fetcher]);

  // Revalidate on focus
  useEffect(() => {
    if (!opts.revalidateOnFocus || !url) return;
    const handler = () => fetcher(url);
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [url, opts.revalidateOnFocus, fetcher]);

  // Revalidate on reconnect
  useEffect(() => {
    if (!opts.revalidateOnReconnect || !url) return;
    const handler = () => fetcher(url);
    window.addEventListener("online", handler);
    return () => window.removeEventListener("online", handler);
  }, [url, opts.revalidateOnReconnect, fetcher]);

  // Periodic revalidation
  useEffect(() => {
    if (!opts.revalidateInterval || !url) return;
    const interval = setInterval(() => fetcher(url), opts.revalidateInterval);
    return () => clearInterval(interval);
  }, [url, opts.revalidateInterval, fetcher]);

  // Manual revalidation / optimistic update
  const mutate = useCallback((newData?: T) => {
    if (newData !== undefined && url) {
      _cache.set(url, { data: newData, timestamp: Date.now() });
      setState(prev => ({ ...prev, data: newData }));
    } else if (url) {
      fetcher(url);
    }
  }, [url, fetcher]);

  return { ...state, mutate };
}

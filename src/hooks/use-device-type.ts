"use client";

import { useState, useEffect, useRef } from "react";

export type DeviceType = "desktop" | "tablet" | "mobile";

/** Breakpoints match Tailwind's sm (640px) / lg (1024px) defaults. */
export function useDeviceType(): DeviceType {
  const getDevice = (w: number): DeviceType => {
    if (w < 640) return "mobile";
    if (w < 1024) return "tablet";
    return "desktop";
  };

  const [device, setDevice] = useState<DeviceType>("desktop");
  const lastWidthRef = useRef<number>(0);

  useEffect(() => {
    lastWidthRef.current = window.innerWidth;
    setDevice(getDevice(window.innerWidth));

    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const w = window.innerWidth;
      if (w === lastWidthRef.current) return;
      lastWidthRef.current = w;
      clearTimeout(timer);
      timer = setTimeout(() => setDevice(getDevice(w)), 100);
    };
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("resize", check);
      clearTimeout(timer);
    };
  }, []);

  return device;
}

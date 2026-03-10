"use client";

import { useMirror, type TargetDeviceInfo } from "@/lib/mirror-context";
import { cn } from "@/lib/utils";

interface DeviceFrameProps {
  children: React.ReactNode;
}

export function DeviceFrame({ children }: DeviceFrameProps) {
  const { isMirroring, targetDevice } = useMirror();

  // If not mirroring or target is desktop/kiosk, render children directly
  if (!isMirroring || !targetDevice || !targetDevice.isMobile) {
    return <>{children}</>;
  }

  // Determine device type for frame styling
  const isTablet = targetDevice.width >= 768;
  const frameWidth = isTablet ? 820 : 390;
  const frameHeight = isTablet ? 1180 : 844;

  // Scale the frame to fit within the available viewport
  const availableHeight = typeof window !== "undefined" ? window.innerHeight - 120 : 900;
  const availableWidth = typeof window !== "undefined" ? window.innerWidth - 80 : 1200;
  const scaleToFit = Math.min(
    availableWidth / (frameWidth + 40),
    availableHeight / (frameHeight + 40),
    1.2 // Allow slight upscale but not too much
  );

  return (
    <div className="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-950 overflow-hidden">
      <div
        className="relative shrink-0"
        style={{ transform: `scale(${scaleToFit})`, transformOrigin: "center center" }}
      >
        {/* Device chrome */}
        <div
          className={cn(
            "relative rounded-[3rem] bg-neutral-900 shadow-2xl",
            isTablet ? "p-4" : "p-3"
          )}
          style={{ width: frameWidth + (isTablet ? 32 : 24), height: frameHeight + (isTablet ? 32 : 24) }}
        >
          {/* Notch / Dynamic Island (phones only) */}
          {!isTablet && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-[120px] h-[34px] rounded-full bg-neutral-900" />
          )}

          {/* Screen */}
          <div
            className="relative rounded-[2.2rem] overflow-hidden bg-white dark:bg-slate-900"
            style={{ width: frameWidth, height: frameHeight }}
          >
            {/* Content scaled to match mobile viewport */}
            <div
              style={{
                width: targetDevice.width,
                height: targetDevice.height,
                transform: `scale(${frameWidth / targetDevice.width})`,
                transformOrigin: "top left",
              }}
            >
              {children}
            </div>
          </div>

          {/* Home indicator (bottom) */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[134px] h-[5px] rounded-full bg-neutral-600" />
        </div>

        {/* Device label */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-muted-foreground">
          {isTablet ? "📱 Tablet" : "📱 Mobile"} • {targetDevice.width}×{targetDevice.height}
        </div>
      </div>
    </div>
  );
}

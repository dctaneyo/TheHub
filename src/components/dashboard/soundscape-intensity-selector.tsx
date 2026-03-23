"use client";

import { useState, useEffect } from "react";
import { AudioLines } from "@/lib/icons";
import { cn } from "@/lib/utils";
import {
  getSoundscapeIntensity,
  setSoundscapeIntensity,
  type SoundscapeIntensity,
} from "@/lib/sound-effects";

const OPTIONS: { value: SoundscapeIntensity; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "subtle", label: "Subtle" },
  { value: "normal", label: "Normal" },
];

export function SoundscapeIntensitySelector() {
  const [intensity, setIntensity] = useState<SoundscapeIntensity>("normal");

  useEffect(() => {
    setIntensity(getSoundscapeIntensity());
  }, []);

  const handleChange = (val: SoundscapeIntensity) => {
    setIntensity(val);
    setSoundscapeIntensity(val);
  };

  return (
    <div className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
        <AudioLines className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Soundscape</p>
        <p className="text-[11px] text-muted-foreground">Ambient sound intensity</p>
      </div>
      <div className="flex gap-0.5 rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Soundscape intensity">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleChange(opt.value)}
            role="radio"
            aria-checked={intensity === opt.value}
            aria-label={`Soundscape intensity: ${opt.label}`}
            className={cn(
              "min-w-[64px] min-h-[64px] px-2 py-1 rounded-md text-[10px] font-bold transition-colors",
              intensity === opt.value
                ? "bg-violet-500 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

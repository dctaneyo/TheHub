"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "@/lib/icons";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="w-9 h-9" aria-label="Toggle theme">
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="w-9 h-9"
      onClick={cycleTheme}
      title={`Theme: ${theme}`}
      aria-label={`Toggle theme, current: ${theme}`}
    >
      {theme === "dark" ? (
        <Moon className="h-4 w-4" />
      ) : theme === "light" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Monitor className="h-4 w-4" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

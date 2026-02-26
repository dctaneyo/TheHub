"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

interface Season {
  id: string;
  name: string;
  emoji: string[];
  accent: string;
  banner: string;
  greeting?: string;
}

function getActiveSeason(month: number, day: number): Season | null {
  // Christmas: Dec 15 – Jan 1
  if ((month === 12 && day >= 15) || (month === 1 && day <= 1)) {
    return {
      id: "christmas",
      name: "Christmas",
      emoji: ["🎄", "❄️", "🎅", "⛄", "🎁"],
      accent: "#dc2626",
      banner: "bg-gradient-to-r from-red-600 via-green-700 to-red-600",
      greeting: "Merry Christmas! 🎄",
    };
  }
  // Halloween: Oct 25 – Nov 1
  if ((month === 10 && day >= 25) || (month === 11 && day === 1)) {
    return {
      id: "halloween",
      name: "Halloween",
      emoji: ["🎃", "👻", "🕷️", "🦇", "🕸️"],
      accent: "#f97316",
      banner: "bg-gradient-to-r from-orange-600 via-orange-900 to-purple-900",
      greeting: "Happy Halloween! 🎃",
    };
  }
  // New Year: Jan 1–7
  if (month === 1 && day <= 7) {
    return {
      id: "new-year",
      name: "New Year",
      emoji: ["🎆", "🥂", "🎉", "✨", "🎊"],
      accent: "#eab308",
      banner: "bg-gradient-to-r from-yellow-500 via-yellow-600 to-amber-700",
      greeting: "Happy New Year! 🎆",
    };
  }
  // Valentine's Day: Feb 10–14
  if (month === 2 && day >= 10 && day <= 14) {
    return {
      id: "valentines",
      name: "Valentine's Day",
      emoji: ["❤️", "💝", "🌹", "💘", "💕"],
      accent: "#ec4899",
      banner: "bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600",
      greeting: "Happy Valentine's Day! ❤️",
    };
  }
  // St. Patrick's Day: Mar 14–17
  if (month === 3 && day >= 14 && day <= 17) {
    return {
      id: "stpatricks",
      name: "St. Patrick's Day",
      emoji: ["☘️", "🍀", "🌈", "🪄", "✨"],
      accent: "#16a34a",
      banner: "bg-gradient-to-r from-green-600 via-emerald-600 to-green-700",
      greeting: "Happy St. Patrick's Day! ☘️",
    };
  }
  // Canada Day: Jul 1
  if (month === 7 && day === 1) {
    return {
      id: "canada-day",
      name: "Canada Day",
      emoji: ["🇨🇦", "🍁", "🎆", "🎉", "❤️"],
      accent: "#dc2626",
      banner: "bg-gradient-to-r from-red-600 via-red-700 to-red-600",
      greeting: "Happy Canada Day! 🍁",
    };
  }
  // Summer: Jun 21 – Sep 22
  if ((month === 6 && day >= 21) || month === 7 || month === 8 || (month === 9 && day <= 22)) {
    return {
      id: "summer",
      name: "Summer",
      emoji: ["☀️", "🌊", "🏖️", "🍦", "🌺"],
      accent: "#f59e0b",
      banner: "bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-500",
      greeting: "Enjoy the summer! ☀️",
    };
  }
  return null;
}

interface SeasonalThemeProps {
  showBanner?: boolean;
  showFloating?: boolean;
}

export function SeasonalTheme({ showBanner = true, showFloating = true }: SeasonalThemeProps) {
  const season = useMemo(() => {
    const now = new Date();
    return getActiveSeason(now.getMonth() + 1, now.getDate());
  }, []);

  if (!season) return null;

  return (
    <>
      {/* Seasonal greeting banner */}
      {showBanner && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className={`${season.banner} rounded-2xl px-4 py-2.5 text-white shadow-md`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{season.emoji[0]}</span>
              <span className="text-sm font-bold tracking-wide">
                {season.greeting || season.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {season.emoji.slice(1, 4).map((e, i) => (
                <motion.span
                  key={i}
                  className="text-base"
                  animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, delay: i * 0.3, repeat: Infinity, repeatDelay: 3 }}
                >
                  {e}
                </motion.span>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Floating emoji particles (subtle, in corner) */}
      {showFloating && (
        <div className="pointer-events-none fixed right-4 top-16 z-10 flex flex-col gap-2 opacity-60">
          {season.emoji.slice(0, 3).map((emoji, i) => (
            <motion.span
              key={i}
              className="text-xl select-none"
              initial={{ opacity: 0, x: 20 }}
              animate={{
                opacity: [0, 0.7, 0.7, 0],
                x: [20, 0, 0, -10],
                y: [0, -8, -16, -24],
              }}
              transition={{
                duration: 4,
                delay: i * 1.5 + 2,
                repeat: Infinity,
                repeatDelay: 8,
                ease: "easeOut",
              }}
            >
              {emoji}
            </motion.span>
          ))}
        </div>
      )}
    </>
  );
}

export function useSeasonalTheme() {
  return useMemo(() => {
    const now = new Date();
    return getActiveSeason(now.getMonth() + 1, now.getDate());
  }, []);
}

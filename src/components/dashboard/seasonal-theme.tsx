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
  // ── Priority holidays (checked first, override seasonal fallbacks) ──

  // New Year: Jan 1–3
  if (month === 1 && day <= 3) {
    return {
      id: "new-year",
      name: "New Year",
      emoji: ["🎆", "🥂", "🎉", "✨", "🎊"],
      accent: "#eab308",
      banner: "bg-gradient-to-r from-yellow-500 via-yellow-600 to-amber-700",
      greeting: "Happy New Year! 🎆",
    };
  }
  // Martin Luther King Jr. Day: 3rd Monday of Jan (approx Jan 15–21)
  if (month === 1 && day >= 15 && day <= 21) {
    return {
      id: "mlk-day",
      name: "MLK Day",
      emoji: ["✊", "🕊️", "💛", "🌟", "❤️"],
      accent: "#7c3aed",
      banner: "bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-700",
      greeting: "Honoring Dr. King's Legacy ✊🕊️",
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
  // Presidents' Day: 3rd Monday of Feb (approx Feb 15–21)
  if (month === 2 && day >= 15 && day <= 21) {
    return {
      id: "presidents-day",
      name: "Presidents' Day",
      emoji: ["🇺🇸", "🏛️", "⭐", "🦅", "🗽"],
      accent: "#1e40af",
      banner: "bg-gradient-to-r from-blue-700 via-red-600 to-blue-700",
      greeting: "Happy Presidents' Day! 🇺🇸",
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
  // Easter: approx late Mar / Apr (simplified: Apr 1–21)
  if ((month === 3 && day >= 28) || (month === 4 && day <= 21)) {
    return {
      id: "easter",
      name: "Easter",
      emoji: ["🐣", "🥚", "🌷", "🐰", "🌸"],
      accent: "#a855f7",
      banner: "bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-300",
      greeting: "Happy Easter! 🐣",
    };
  }
  // Cinco de Mayo: May 3–5
  if (month === 5 && day >= 3 && day <= 5) {
    return {
      id: "cinco-de-mayo",
      name: "Cinco de Mayo",
      emoji: ["🇲🇽", "🌮", "🎉", "💃", "🌶️"],
      accent: "#16a34a",
      banner: "bg-gradient-to-r from-green-600 via-red-600 to-green-600",
      greeting: "¡Feliz Cinco de Mayo! 🇲🇽",
    };
  }
  // Mother's Day: 2nd Sunday of May (approx May 8–14)
  if (month === 5 && day >= 8 && day <= 14) {
    return {
      id: "mothers-day",
      name: "Mother's Day",
      emoji: ["💐", "🌸", "❤️", "👩‍👧", "🌺"],
      accent: "#ec4899",
      banner: "bg-gradient-to-r from-pink-400 via-rose-400 to-pink-500",
      greeting: "Happy Mother's Day! 💐",
    };
  }
  // Memorial Day: last Monday of May (approx May 25–31)
  if (month === 5 && day >= 25) {
    return {
      id: "memorial-day",
      name: "Memorial Day",
      emoji: ["🇺🇸", "🎗️", "⭐", "🕊️", "🌺"],
      accent: "#1e40af",
      banner: "bg-gradient-to-r from-blue-800 via-red-700 to-blue-800",
      greeting: "Honoring Our Heroes 🇺🇸",
    };
  }
  // Father's Day: 3rd Sunday of Jun (approx Jun 15–21)
  if (month === 6 && day >= 15 && day <= 21) {
    return {
      id: "fathers-day",
      name: "Father's Day",
      emoji: ["👔", "🏆", "❤️", "👨‍👧", "⭐"],
      accent: "#1d4ed8",
      banner: "bg-gradient-to-r from-blue-500 via-sky-500 to-blue-600",
      greeting: "Happy Father's Day! 👔",
    };
  }
  // Independence Day: Jul 2–4
  if (month === 7 && day >= 2 && day <= 4) {
    return {
      id: "independence-day",
      name: "Independence Day",
      emoji: ["🇺🇸", "🎆", "🦅", "🗽", "⭐"],
      accent: "#dc2626",
      banner: "bg-gradient-to-r from-red-600 via-blue-700 to-red-600",
      greeting: "Happy 4th of July! 🇺🇸🎆",
    };
  }
  // Labor Day: 1st Monday of Sep (approx Sep 1–7)
  if (month === 9 && day >= 1 && day <= 7) {
    return {
      id: "labor-day",
      name: "Labor Day",
      emoji: ["🔧", "💪", "🇺🇸", "🏖️", "⭐"],
      accent: "#1e40af",
      banner: "bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800",
      greeting: "Happy Labor Day! 💪",
    };
  }
  // Halloween: Oct 20 – Nov 1
  if ((month === 10 && day >= 20) || (month === 11 && day === 1)) {
    return {
      id: "halloween",
      name: "Halloween",
      emoji: ["🎃", "👻", "🕷️", "🦇", "🕸️"],
      accent: "#f97316",
      banner: "bg-gradient-to-r from-orange-600 via-orange-900 to-purple-900",
      greeting: "Happy Halloween! 🎃",
    };
  }
  // Veterans Day: Nov 10–11
  if (month === 11 && day >= 10 && day <= 11) {
    return {
      id: "veterans-day",
      name: "Veterans Day",
      emoji: ["🇺🇸", "🎗️", "⭐", "🦅", "🕊️"],
      accent: "#1e40af",
      banner: "bg-gradient-to-r from-blue-800 via-red-700 to-blue-800",
      greeting: "Thank You, Veterans 🇺🇸",
    };
  }
  // Thanksgiving: 4th Thursday of Nov (approx Nov 22–28)
  if (month === 11 && day >= 22 && day <= 28) {
    return {
      id: "thanksgiving",
      name: "Thanksgiving",
      emoji: ["🦃", "🍂", "🥧", "🌽", "🥕"],
      accent: "#b45309",
      banner: "bg-gradient-to-r from-amber-700 via-orange-600 to-amber-700",
      greeting: "Happy Thanksgiving! 🦃",
    };
  }
  // Christmas: Dec 12 – Dec 31
  if (month === 12 && day >= 12) {
    return {
      id: "christmas",
      name: "Christmas",
      emoji: ["🎄", "❄️", "🎅", "⛄", "🎁"],
      accent: "#dc2626",
      banner: "bg-gradient-to-r from-red-600 via-green-700 to-red-600",
      greeting: "Merry Christmas! 🎄",
    };
  }

  // ── Seasonal fallbacks (fill gaps between holidays) ──

  // Winter: Jan 4 – Feb 9, Nov 2–9, Dec 1–11
  if (
    (month === 1 && day >= 4 && day <= 14) ||
    (month === 2 && day <= 9) ||
    (month === 11 && day >= 2 && day <= 9) ||
    (month === 12 && day <= 11)
  ) {
    return {
      id: "winter",
      name: "Winter",
      emoji: ["❄️", "⛄", "🧣", "☕", "🌨️"],
      accent: "#3b82f6",
      banner: "bg-gradient-to-r from-sky-500 via-blue-500 to-sky-600",
      greeting: "Stay warm! ☕❄️",
    };
  }
  // Late Winter / Early Spring: Feb 22 – Mar 13
  if ((month === 2 && day >= 22) || (month === 3 && day <= 13)) {
    return {
      id: "early-spring",
      name: "Spring is Coming",
      emoji: ["🌱", "🌤️", "🌼", "🐝", "🦋"],
      accent: "#22c55e",
      banner: "bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400",
      greeting: "Spring is on the way! 🌱",
    };
  }
  // Spring: Mar 18 – Apr (handled by Easter above for late Mar/Apr)
  if (month === 3 && day >= 18 && day <= 27) {
    return {
      id: "spring",
      name: "Spring",
      emoji: ["🌸", "🌼", "🦋", "🐣", "🌈"],
      accent: "#a855f7",
      banner: "bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400",
      greeting: "Happy Spring! 🌸",
    };
  }
  // Late Spring: Apr 22 – May 2
  if ((month === 4 && day >= 22) || (month === 5 && day <= 2)) {
    return {
      id: "late-spring",
      name: "Spring",
      emoji: ["🌻", "🌼", "☀️", "🐝", "🌿"],
      accent: "#eab308",
      banner: "bg-gradient-to-r from-yellow-400 via-green-400 to-yellow-400",
      greeting: "Beautiful spring day! 🌻",
    };
  }
  // Early Summer: May 15–24, Jun 1–14
  if ((month === 5 && day >= 15 && day <= 24) || (month === 6 && day <= 14)) {
    return {
      id: "early-summer",
      name: "Summer's Coming",
      emoji: ["🌞", "🌴", "🍹", "😎", "🏄"],
      accent: "#f59e0b",
      banner: "bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400",
      greeting: "Summer is almost here! 🌞",
    };
  }
  // Summer: Jun 22 – Aug 31
  if ((month === 6 && day >= 22) || month === 7 || month === 8) {
    return {
      id: "summer",
      name: "Summer",
      emoji: ["☀️", "🌊", "🏖️", "🍦", "🌺"],
      accent: "#f59e0b",
      banner: "bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-500",
      greeting: "Enjoy the summer! ☀️",
    };
  }
  // Early Fall: Sep 8 – Oct 19
  if ((month === 9 && day >= 8) || (month === 10 && day <= 19)) {
    return {
      id: "fall",
      name: "Fall",
      emoji: ["🍂", "🍁", "🎃", "☕", "🌰"],
      accent: "#d97706",
      banner: "bg-gradient-to-r from-orange-500 via-amber-600 to-orange-600",
      greeting: "Happy Fall! 🍂",
    };
  }
  // Nov 12–21 gap (between Veterans Day and Thanksgiving)
  if (month === 11 && day >= 12 && day <= 21) {
    return {
      id: "pre-thanksgiving",
      name: "Autumn",
      emoji: ["🍁", "🦃", "🥧", "🌾", "🍂"],
      accent: "#b45309",
      banner: "bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600",
      greeting: "Thankful season! 🍁",
    };
  }
  // Nov 29–30 gap (after Thanksgiving, before Christmas)
  if (month === 11 && day >= 29) {
    return {
      id: "holiday-season",
      name: "Holiday Season",
      emoji: ["🎄", "🎁", "❄️", "✨", "🌟"],
      accent: "#dc2626",
      banner: "bg-gradient-to-r from-red-500 via-green-600 to-red-500",
      greeting: "Holiday season is here! 🎄✨",
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

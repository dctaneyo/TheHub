"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Delete, ChevronDown } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface OnscreenKeyboardProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onDismiss?: () => void;
  placeholder?: string;
  className?: string;
  /** Hide the built-in text input display at the top */
  hideInput?: boolean;
  /** Customize the submit button label (default: "Send") */
  submitLabel?: string;
}

type KeyboardMode = "alpha" | "shift" | "caps" | "numbers" | "symbols" | "emoji";

// Row 1: q-p with number hints
const ROW1 = [
  { key: "q", hint: "1" }, { key: "w", hint: "2" }, { key: "e", hint: "3" },
  { key: "r", hint: "4" }, { key: "t", hint: "5" }, { key: "y", hint: "6" },
  { key: "u", hint: "7" }, { key: "i", hint: "8" }, { key: "o", hint: "9" },
  { key: "p", hint: "0" },
];
const ROW2 = [
  { key: "a", hint: "@" }, { key: "s", hint: "#" }, { key: "d", hint: "$" },
  { key: "f", hint: "&" }, { key: "g", hint: "*" }, { key: "h", hint: "(" },
  { key: "j", hint: ")" }, { key: "k", hint: "'" }, { key: "l", hint: "\"" },
];
const ROW3 = [
  { key: "z", hint: "%" }, { key: "x", hint: "-" }, { key: "c", hint: "+" },
  { key: "v", hint: "=" }, { key: "b", hint: "/" }, { key: "n", hint: ";" },
  { key: "m", hint: ":" },
];

const NUM_ROW1 = ["1","2","3","4","5","6","7","8","9","0"];
const NUM_ROW2 = ["-","/",":",";","(",")","$","&","@","\""];
const NUM_ROW3 = [".",",","?","!","'"];

const SYM_ROW1 = ["[","]","{","}","#","%","^","*","+","="];
const SYM_ROW2 = ["_","\\","|","~","<",">","€","£","¥","•"];
const SYM_ROW3 = [".",",","?","!","'"];

const EMOJI_CATEGORIES = [
  {
    label: "😀",
    emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😊","😇","🥰","😍","🤩","😘","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","😐","😑","😶","😏","😒"],
  },
  {
    label: "👍",
    emojis: ["👍","👎","👊","✊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✌️","🤞","🤟","🤘","👌","🤌","🤏","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🖖","👋","🤙"],
  },
  {
    label: "❤️",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","⭐","🌟","✨","💫","🔥","💯","✅","❌","⚠️","🚫","♻️","💤"],
  },
  {
    label: "🎉",
    emojis: ["🎉","🎊","🏆","🥇","🥈","🥉","🎯","🎮","🎲","🎭","🎨","🎬","🎤","🎧","🎵","🎶","🔔","📣","💬","💭","🗯️","📋","📌","📎","🖊️","✏️","📝","📅","📊","🚀"],
  },
  {
    label: "🍔",
    emojis: ["🍔","🍟","🍕","🌭","🥪","🌮","🌯","🥙","🍳","🥘","🍲","🥗","🍿","🍱","🍣","🍤","🍦","🍧","🍨","🍩","🍪","🎂","🍰","☕","🍵","🥤","🍺","🍷","🥂","🧃"],
  },
];

/** Long-press threshold in ms */
const LONG_PRESS_MS = 400;

export function OnscreenKeyboard({
  value, onChange, onSubmit, onDismiss, placeholder, className,
  hideInput = false, submitLabel = "Send",
}: OnscreenKeyboardProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [mode, setMode] = useState<KeyboardMode>("alpha");
  const [prevAlphaMode, setPrevAlphaMode] = useState<"alpha" | "shift" | "caps">("alpha");
  const [emojiCat, setEmojiCat] = useState(0);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mobile detection (< 640px)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Double-tap shift for CAPS on mobile
  const lastShiftTap = useRef(0);

  const isAlpha = mode === "alpha" || mode === "shift" || mode === "caps";
  const isUpper = mode === "shift" || mode === "caps";
  const isNumbers = mode === "numbers" || mode === "symbols";
  const isEmoji = mode === "emoji";

  const press = useCallback((char: string) => {
    onChange(value + char);
    if (mode === "shift") setMode("alpha");
  }, [value, onChange, mode]);

  const backspace = useCallback(() => {
    onChange(value.slice(0, -1));
  }, [value, onChange]);

  const handleShift = () => {
    if (mode === "caps") setMode("shift");
    else if (mode === "shift") setMode("alpha");
    else setMode("shift");
  };

  const handleMobileShift = () => {
    const now = Date.now();
    const elapsed = now - lastShiftTap.current;
    lastShiftTap.current = now;
    if (elapsed < 400) {
      // Double-tap → CAPS
      setMode((m) => m === "caps" ? "alpha" : "caps");
    } else {
      handleShift();
    }
  };

  const handleCaps = () => {
    setMode((m) => m === "caps" ? "alpha" : "caps");
  };

  const handleNumToggle = () => {
    if (isNumbers || isEmoji) {
      setMode(prevAlphaMode);
    } else {
      setPrevAlphaMode(mode as "alpha" | "shift" | "caps");
      setMode("numbers");
    }
  };

  const handleEmojiToggle = () => {
    if (isEmoji) {
      setMode(prevAlphaMode);
    } else {
      if (isAlpha) setPrevAlphaMode(mode as "alpha" | "shift" | "caps");
      setMode("emoji");
    }
  };

  // Long-press handlers for hint characters
  const startLongPress = useCallback((hint: string) => {
    longPressTimer.current = setTimeout(() => {
      onChange(value + hint);
      if (mode === "shift") setMode("alpha");
      longPressTimer.current = null;
    }, LONG_PRESS_MS);
  }, [value, onChange, mode]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Animate key press
  const animateKey = useCallback((id: string) => {
    setPressedKey(id);
    setTimeout(() => setPressedKey(null), 100);
  }, []);

  // Key styles
  const K = "flex items-center justify-center select-none rounded-[6px] bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-[0_1px_0_1px_rgba(0,0,0,0.18)] dark:shadow-[0_1px_0_1px_rgba(0,0,0,0.4)] active:bg-slate-200 dark:active:bg-slate-600 transition-all cursor-pointer text-[15px] font-medium";
  const KDark = "flex items-center justify-center select-none rounded-[6px] bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-[0_1px_0_1px_rgba(0,0,0,0.18)] dark:shadow-[0_1px_0_1px_rgba(0,0,0,0.4)] active:bg-slate-300 dark:active:bg-slate-500 transition-all cursor-pointer";
  const KDarkL = "flex items-end justify-start pl-2 select-none rounded-[6px] bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-[0_1px_0_1px_rgba(0,0,0,0.18)] dark:shadow-[0_1px_0_1px_rgba(0,0,0,0.4)] active:bg-slate-300 dark:active:bg-slate-500 transition-all cursor-pointer text-[11px] font-semibold pb-2";
  const KDarkR = "flex items-end justify-end pr-2 select-none rounded-[6px] bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-[0_1px_0_1px_rgba(0,0,0,0.18)] dark:shadow-[0_1px_0_1px_rgba(0,0,0,0.4)] active:bg-slate-300 dark:active:bg-slate-500 transition-all cursor-pointer text-[11px] font-semibold pb-2";
  const KRed = "flex items-center justify-center select-none rounded-[6px] bg-[var(--hub-red)] text-white shadow-[0_1px_0_1px_rgba(0,0,0,0.25)] active:bg-[#c4001f] transition-all cursor-pointer";
  const H = "h-[46px]";
  const popClass = (id: string) => pressedKey === id ? "scale-[1.12] shadow-lg z-10" : "";

  if (!mounted) return null;

  /** Render a character key with optional long-press hint */
  const charKey = (key: string, hint?: string) => {
    const display = isUpper ? key.toUpperCase() : key;
    const id = `char-${key}`;
    return (
      <button
        key={key}
        onPointerDown={(e) => {
          e.preventDefault();
          animateKey(id);
          if (hint) startLongPress(hint);
        }}
        onPointerUp={() => {
          if (longPressTimer.current) {
            cancelLongPress();
            press(display);
          }
        }}
        onPointerLeave={cancelLongPress}
        className={cn(K, H, "flex-1 relative", popClass(id))}
      >
        {hint && (
          <span className="absolute top-0.5 right-1.5 text-[9px] text-slate-400 dark:text-slate-500 font-normal leading-none">
            {hint}
          </span>
        )}
        {display}
      </button>
    );
  };

  const keyboard = (
    <div
      className={cn(
        "fixed bottom-0 left-1/2 z-[9999] -translate-x-1/2",
        "w-[min(700px,100vw)]",
        "select-none bg-slate-300 dark:bg-slate-800 rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.18)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.5)] pb-3",
        className
      )}
    >
      {/* Text input display (hideable) */}
      {!hideInput && (
        <div className="flex items-center gap-2 px-2 pt-2 pb-1.5">
          <div className="flex-1 min-h-[38px] rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 shadow-inner overflow-x-auto whitespace-nowrap">
            {value
              ? <span>{value}</span>
              : <span className="text-slate-400 dark:text-slate-500">{placeholder || "Type a message..."}</span>
            }
          </div>
          {onSubmit && (
            <button
              onPointerDown={(e) => { e.preventDefault(); onSubmit(); }}
              className="shrink-0 rounded-lg bg-[var(--hub-red)] px-4 h-[38px] text-xs font-bold text-white shadow active:bg-[#c4001f]"
            >
              {submitLabel}
            </button>
          )}
        </div>
      )}
      <div className="px-1.5">
      <div className="space-y-1">

        {/* ── ALPHA MODE ── */}
        {isAlpha && !isMobile && (
          <>
            {/* Row 1: tab + q-p + delete */}
            <div className="flex gap-1">
              <button onPointerDown={(e) => e.preventDefault()}
                className={cn(KDarkL, H, "flex-[1.4] min-w-0")}>
                tab
              </button>
              {ROW1.map(({ key, hint }) => charKey(key, hint))}
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("del1"); backspace(); }}
                className={cn(KDarkR, H, "flex-[1.4] min-w-0", popClass("del1"))}>
                delete
              </button>
            </div>

            {/* Row 2: caps + a-l + return */}
            <div className="flex gap-1">
              <button onPointerDown={(e) => { e.preventDefault(); handleCaps(); }}
                className={cn(KDarkL, H, "flex-[1.6] min-w-0",
                  mode === "caps" && "ring-2 ring-[var(--hub-red)] ring-inset"
                )}>
                caps
              </button>
              {ROW2.map(({ key, hint }) => charKey(key, hint))}
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("ret"); press("\n"); }}
                className={cn(KDarkR, H, "flex-[1.6] min-w-0", popClass("ret"))}>
                return
              </button>
            </div>

            {/* Row 3: shift + z-m + shift */}
            <div className="flex gap-1">
              <button onPointerDown={(e) => { e.preventDefault(); handleShift(); }}
                className={cn(KDarkL, H, "flex-[1.8] min-w-0",
                  mode === "shift" && "bg-slate-400"
                )}>
                shift
              </button>
              {ROW3.map(({ key, hint }) => charKey(key, hint))}
              <button onPointerDown={(e) => { e.preventDefault(); handleShift(); }}
                className={cn(KDarkR, H, "flex-[1.8] min-w-0",
                  mode === "shift" && "bg-slate-400"
                )}>
                shift
              </button>
            </div>

            {/* Row 4: .?123 + emoji + space + .?123 + hide */}
            <div className="flex gap-1">
              <button onPointerDown={(e) => { e.preventDefault(); handleNumToggle(); }}
                className={cn(KDarkL, H, "flex-[1.6] min-w-0")}>
                .?123
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); handleEmojiToggle(); }}
                className={cn(KDark, H, "flex-1 min-w-0 text-base")}>
                😊
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("spc"); press(" "); }}
                className={cn(K, H, "flex-[4] min-w-0 text-[11px] text-slate-400 font-medium", popClass("spc"))}>
                space
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); handleNumToggle(); }}
                className={cn(KDarkR, H, "flex-[1.6] min-w-0")}>
                .?123
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); onDismiss?.(); }}
                className={cn(KRed, H, "flex-[1.2] min-w-0 gap-1")}>
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {/* ── ALPHA MODE — MOBILE ── */}
        {isAlpha && isMobile && (
          <>
            {/* Row 1: q-p (full width, no spacers — sets the key size baseline) */}
            <div className="flex gap-1">
              {ROW1.map(({ key, hint }) => charKey(key, hint))}
            </div>

            {/* Row 2: a-l (spacers sized so letter keys match row 1) */}
            <div className="flex gap-1">
              <div className="flex-[0.5] min-w-0" />
              {ROW2.map(({ key, hint }) => charKey(key, hint))}
              <div className="flex-[0.5] min-w-0" />
            </div>

            {/* Row 3: shift + z-m + delete */}
            <div className="flex gap-1">
              <button onPointerDown={(e) => { e.preventDefault(); handleMobileShift(); }}
                className={cn(KDark, H, "flex-[1.3] min-w-0 text-[11px] font-semibold",
                  mode === "shift" && "bg-slate-400",
                  mode === "caps" && "ring-2 ring-[var(--hub-red)] ring-inset"
                )}>
                {mode === "caps" ? "CAPS" : "shift"}
              </button>
              {ROW3.map(({ key, hint }) => charKey(key, hint))}
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("mdel"); backspace(); }}
                className={cn(KDark, H, "flex-[1.3] min-w-0", popClass("mdel"))}>
                <Delete className="h-5 w-5" />
              </button>
            </div>

            {/* Row 4: .?123 + space + emoji */}
            <div className="flex gap-1">
              <button onPointerDown={(e) => { e.preventDefault(); handleNumToggle(); }}
                className={cn(KDarkL, H, "flex-[1.2] min-w-0 text-[10px]")}>
                .?123
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("mspc"); press(" "); }}
                className={cn(K, H, "flex-[5] min-w-0 text-[11px] text-slate-400 font-medium", popClass("mspc"))}>
                space
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); handleEmojiToggle(); }}
                className={cn(KDark, H, "flex-[1.2] min-w-0 text-base")}>
                😊
              </button>
            </div>
          </>
        )}

        {/* ── NUMBERS / SYMBOLS MODE ── */}
        {isNumbers && !isMobile && (
          <>
            <div className="flex gap-1">
              {(mode === "numbers" ? NUM_ROW1 : SYM_ROW1).map((key) => (
                <button key={key} onPointerDown={(e) => { e.preventDefault(); animateKey(`n-${key}`); press(key); }}
                  className={cn(K, H, "flex-1 min-w-0 text-[15px] font-medium", popClass(`n-${key}`))}>
                  {key}
                </button>
              ))}
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("ndel1"); backspace(); }}
                className={cn(KDarkR, H, "flex-[1.4] min-w-0", popClass("ndel1"))}>
                delete
              </button>
            </div>
            <div className="flex gap-1">
              {(mode === "numbers" ? NUM_ROW2 : SYM_ROW2).map((key) => (
                <button key={key} onPointerDown={(e) => { e.preventDefault(); animateKey(`n2-${key}`); press(key); }}
                  className={cn(K, H, "flex-1 min-w-0 text-[15px] font-medium", popClass(`n2-${key}`))}>
                  {key}
                </button>
              ))}
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("nret"); press("\n"); }}
                className={cn(KDarkR, H, "flex-[1.4] min-w-0 text-[11px] font-semibold gap-1", popClass("nret"))}>
                return
              </button>
            </div>
            <div className="flex gap-1">
              <button onPointerDown={(e) => { e.preventDefault(); setMode(mode === "numbers" ? "symbols" : "numbers"); }}
                className={cn(KDarkL, H, "flex-[1.4] min-w-0 text-[11px] font-bold")}>
                {mode === "numbers" ? "#+=" : ".?123"}
              </button>
              {(mode === "numbers" ? NUM_ROW3 : SYM_ROW3).map((key) => (
                <button key={key} onPointerDown={(e) => { e.preventDefault(); animateKey(`n3-${key}`); press(key); }}
                  className={cn(K, H, "flex-1 min-w-0 text-[15px] font-medium", popClass(`n3-${key}`))}>
                  {key}
                </button>
              ))}
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("ndel2"); backspace(); }}
                className={cn(KDarkR, H, "flex-[1.4] min-w-0 text-[11px] font-semibold", popClass("ndel2"))}>
                delete
              </button>
            </div>
            <div className="flex gap-1">
              <button onPointerDown={(e) => { e.preventDefault(); handleNumToggle(); }}
                className={cn(KDarkL, H, "flex-[1.6] min-w-0")}>
                ABC
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); handleEmojiToggle(); }}
                className={cn(KDark, H, "flex-1 min-w-0 text-base")}>
                😊
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("nspc"); press(" "); }}
                className={cn(K, H, "flex-[4] min-w-0 text-[11px] text-slate-400", popClass("nspc"))}>
                space
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); handleNumToggle(); }}
                className={cn(KDarkR, H, "flex-[1.6] min-w-0")}>
                ABC
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); onDismiss?.(); }}
                className={cn(KRed, H, "flex-[1.2] min-w-0 gap-1")}>
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {/* ── NUMBERS / SYMBOLS MODE — MOBILE ── */}
        {isNumbers && isMobile && (
          <>
            {/* Row 1: 10 number/symbol keys (no delete) */}
            <div className="flex gap-1">
              {(mode === "numbers" ? NUM_ROW1 : SYM_ROW1).map((key) => (
                <button key={key} onPointerDown={(e) => { e.preventDefault(); animateKey(`n-${key}`); press(key); }}
                  className={cn(K, H, "flex-1 min-w-0 text-[15px] font-medium", popClass(`n-${key}`))}>
                  {key}
                </button>
              ))}
            </div>
            {/* Row 2: 10 number/symbol keys (no return) */}
            <div className="flex gap-1">
              {(mode === "numbers" ? NUM_ROW2 : SYM_ROW2).map((key) => (
                <button key={key} onPointerDown={(e) => { e.preventDefault(); animateKey(`n2-${key}`); press(key); }}
                  className={cn(K, H, "flex-1 min-w-0 text-[15px] font-medium", popClass(`n2-${key}`))}>
                  {key}
                </button>
              ))}
            </div>
            {/* Row 3: #+= toggle + punctuation + delete */}
            <div className="flex gap-1">
              <button onPointerDown={(e) => { e.preventDefault(); setMode(mode === "numbers" ? "symbols" : "numbers"); }}
                className={cn(KDarkL, H, "flex-[1.3] min-w-0 text-[10px] font-bold")}>
                {mode === "numbers" ? "#+=" : ".?123"}
              </button>
              {(mode === "numbers" ? NUM_ROW3 : SYM_ROW3).map((key) => (
                <button key={key} onPointerDown={(e) => { e.preventDefault(); animateKey(`n3-${key}`); press(key); }}
                  className={cn(K, H, "flex-1 min-w-0 text-[15px] font-medium", popClass(`n3-${key}`))}>
                  {key}
                </button>
              ))}
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("mndel"); backspace(); }}
                className={cn(KDark, H, "flex-[1.3] min-w-0", popClass("mndel"))}>
                <Delete className="h-5 w-5" />
              </button>
            </div>
            {/* Row 4: ABC + space + emoji */}
            <div className="flex gap-1">
              <button onPointerDown={(e) => { e.preventDefault(); handleNumToggle(); }}
                className={cn(KDarkL, H, "flex-[1.2] min-w-0 text-[10px]")}>
                ABC
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("mnspc"); press(" "); }}
                className={cn(K, H, "flex-[5] min-w-0 text-[11px] text-slate-400", popClass("mnspc"))}>
                space
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); handleEmojiToggle(); }}
                className={cn(KDark, H, "flex-[1.2] min-w-0 text-base")}>
                😊
              </button>
            </div>
          </>
        )}

        {/* ── EMOJI MODE ── */}
        {isEmoji && (
          <>
            {/* Category tabs */}
            <div className="flex gap-1 px-1 pb-1">
              {EMOJI_CATEGORIES.map((cat, i) => (
                <button
                  key={i}
                  onPointerDown={(e) => { e.preventDefault(); setEmojiCat(i); }}
                  className={cn(
                    "flex-1 rounded-md py-1 text-base transition-colors",
                    emojiCat === i
                      ? "bg-white dark:bg-slate-700 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {/* Emoji grid — 10 columns, scrollable */}
            <div className="grid grid-cols-10 gap-1 px-1 max-h-[184px] overflow-y-auto">
              {EMOJI_CATEGORIES[emojiCat].emojis.map((emoji) => (
                <button key={emoji} onPointerDown={(e) => { e.preventDefault(); animateKey(`e-${emoji}`); press(emoji); }}
                  className={cn(K, H, "text-xl", popClass(`e-${emoji}`))}>
                  {emoji}
                </button>
              ))}
            </div>
            <div className="flex gap-1 mt-1">
              <button onPointerDown={(e) => { e.preventDefault(); handleNumToggle(); }}
                className={cn(KDarkL, H, "flex-[1.6] min-w-0")}>
                .?123
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); handleEmojiToggle(); }}
                className={cn(KDark, H, "flex-1 min-w-0 text-base ring-2 ring-[var(--hub-red)] ring-inset")}>
                😊
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("espc"); press(" "); }}
                className={cn(K, H, "flex-[4] min-w-0 text-[11px] text-slate-400", popClass("espc"))}>
                space
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); handleNumToggle(); }}
                className={cn(KDarkR, H, "flex-[1.6] min-w-0")}>
                .?123
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); onDismiss?.(); }}
                className={cn(KRed, H, "flex-[1.2] min-w-0 gap-1")}>
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

      </div>
      </div>
    </div>
  );

  return createPortal(keyboard, document.body);
}

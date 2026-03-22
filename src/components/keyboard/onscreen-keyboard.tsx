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
const BACKSPACE_INITIAL_MS = 400;
const BACKSPACE_REPEAT_MS = 80;
const DOUBLE_SPACE_MS = 300;

/** Haptic feedback helper */
const haptic = (ms = 10) => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(ms);
  }
};

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

  // Character preview bubble (iOS-style)
  const [preview, setPreview] = useState<{ char: string; x: number; y: number; w: number } | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cursor & selection state
  const [cursor, setCursor] = useState(value.length);
  const [selStart, setSelStart] = useState<number | null>(null);
  const [selEnd, setSelEnd] = useState<number | null>(null);
  const hasSelection = selStart !== null && selEnd !== null && selStart !== selEnd;
  const valueRef = useRef(value);
  const cursorRef = useRef(cursor);
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { cursorRef.current = cursor; }, [cursor]);
  useEffect(() => { if (cursor > value.length) setCursor(value.length); }, [value, cursor]);

  // Hold-to-repeat backspace refs
  const bsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bsInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpaceTap = useRef(0);

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

  // Cursor-aware insert
  const insertAtCursor = useCallback((char: string) => {
    const v = valueRef.current;
    const c = cursorRef.current;
    let newVal: string;
    let newCursor: number;
    if (selStart !== null && selEnd !== null && selStart !== selEnd) {
      const lo = Math.min(selStart, selEnd);
      const hi = Math.max(selStart, selEnd);
      newVal = v.slice(0, lo) + char + v.slice(hi);
      newCursor = lo + char.length;
    } else {
      newVal = v.slice(0, c) + char + v.slice(c);
      newCursor = c + char.length;
    }
    setSelStart(null);
    setSelEnd(null);
    onChange(newVal);
    setCursor(newCursor);
    haptic();
  }, [onChange, selStart, selEnd]);

  const press = useCallback((char: string) => {
    insertAtCursor(char);
    if (mode === "shift") setMode("alpha");
  }, [insertAtCursor, mode]);

  const backspace = useCallback(() => {
    const v = valueRef.current;
    const c = cursorRef.current;
    if (selStart !== null && selEnd !== null && selStart !== selEnd) {
      const lo = Math.min(selStart, selEnd);
      const hi = Math.max(selStart, selEnd);
      onChange(v.slice(0, lo) + v.slice(hi));
      setCursor(lo);
      setSelStart(null);
      setSelEnd(null);
    } else if (c > 0) {
      onChange(v.slice(0, c - 1) + v.slice(c));
      setCursor(c - 1);
    }
    haptic(12);
  }, [onChange, selStart, selEnd]);

  const startBackspaceRepeat = useCallback(() => {
    backspace();
    bsTimeout.current = setTimeout(() => {
      bsInterval.current = setInterval(() => {
        const v = valueRef.current;
        const c = cursorRef.current;
        if (c > 0) {
          const newVal = v.slice(0, c - 1) + v.slice(c);
          valueRef.current = newVal;
          cursorRef.current = c - 1;
          onChange(newVal);
          setCursor(c - 1);
          haptic(6);
        }
      }, BACKSPACE_REPEAT_MS);
    }, BACKSPACE_INITIAL_MS);
  }, [backspace, onChange]);

  const stopBackspaceRepeat = useCallback(() => {
    if (bsTimeout.current) { clearTimeout(bsTimeout.current); bsTimeout.current = null; }
    if (bsInterval.current) { clearInterval(bsInterval.current); bsInterval.current = null; }
  }, []);

  useEffect(() => () => stopBackspaceRepeat(), [stopBackspaceRepeat]);

  const handleSpace = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastSpaceTap.current;
    lastSpaceTap.current = now;
    const v = valueRef.current;
    const c = cursorRef.current;
    if (elapsed < DOUBLE_SPACE_MS && c > 0 && v[c - 1] === " ") {
      const newVal = v.slice(0, c - 1) + ". " + v.slice(c);
      onChange(newVal);
      setCursor(c + 1);
      haptic();
    } else {
      insertAtCursor(" ");
    }
    if (mode === "shift") setMode("alpha");
  }, [insertAtCursor, onChange, mode]);

  const selectAll = useCallback(() => {
    setSelStart(0);
    setSelEnd(value.length);
    haptic();
  }, [value.length]);

  // Tap on input display to position cursor
  const handleInputTap = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (hasSelection) {
      setSelStart(null);
      setSelEnd(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - 12;
    if (value.length === 0) return;
    const charWidth = 8;
    const approxPos = Math.round(x / charWidth);
    setCursor(Math.max(0, Math.min(approxPos, value.length)));
    haptic();
  }, [value, hasSelection]);

  const handleShift = () => {
    if (mode === "caps") setMode("shift");
    else if (mode === "shift") setMode("alpha");
    else setMode("shift");
    haptic();
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
    haptic();
  };

  const handleNumToggle = () => {
    if (isNumbers || isEmoji) {
      setMode(prevAlphaMode);
    } else {
      setPrevAlphaMode(mode as "alpha" | "shift" | "caps");
      setMode("numbers");
    }
    haptic();
  };

  const handleEmojiToggle = () => {
    if (isEmoji) {
      setMode(prevAlphaMode);
    } else {
      if (isAlpha) setPrevAlphaMode(mode as "alpha" | "shift" | "caps");
      setMode("emoji");
    }
    haptic();
  };

  // Long-press handlers for hint characters
  const startLongPress = useCallback((hint: string) => {
    longPressTimer.current = setTimeout(() => {
      insertAtCursor(hint);
      // Swap the preview bubble to show the hint character
      setPreview((prev) => prev ? { ...prev, char: hint } : null);
      if (mode === "shift") setMode("alpha");
      longPressTimer.current = null;
    }, LONG_PRESS_MS);
  }, [insertAtCursor, mode]);

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

  // Character preview helpers
  const showPreview = useCallback((char: string, btn: HTMLElement) => {
    const rect = btn.getBoundingClientRect();
    setPreview({ char, x: rect.left + rect.width / 2, y: rect.top, w: rect.width });
    if (previewTimer.current) clearTimeout(previewTimer.current);
  }, []);

  const hidePreview = useCallback(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => setPreview(null), 60);
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
          showPreview(display, e.currentTarget);
          if (hint) startLongPress(hint);
        }}
        onPointerUp={(e) => {
          hidePreview();
          if (longPressTimer.current) {
            cancelLongPress();
            press(display);
          }
        }}
        onPointerLeave={() => { hidePreview(); cancelLongPress(); }}
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
          <div
            className="flex-1 min-h-[38px] rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 shadow-inner overflow-x-auto whitespace-nowrap"
            onPointerDown={handleInputTap}
          >
            {value.length === 0
              ? (
                <>
                  <span className="inline-block w-[2px] h-[1.1em] bg-blue-500 dark:bg-blue-400 align-text-bottom animate-pulse" />
                  <span className="text-slate-400 dark:text-slate-500 ml-0.5">{placeholder || "Type a message..."}</span>
                </>
              )
              : hasSelection ? (
                <>
                  {value.slice(0, Math.min(selStart!, selEnd!))}
                  <span className="bg-blue-300/50 dark:bg-blue-500/40">
                    {value.slice(Math.min(selStart!, selEnd!), Math.max(selStart!, selEnd!))}
                  </span>
                  {value.slice(Math.max(selStart!, selEnd!))}
                </>
              ) : (
                <>
                  {value.slice(0, cursor)}
                  <span className="inline-block w-[2px] h-[1.1em] bg-blue-500 dark:bg-blue-400 align-text-bottom animate-pulse" />
                  {value.slice(cursor)}
                </>
              )
            }
          </div>
          <button
            onPointerDown={(e) => { e.preventDefault(); selectAll(); }}
            className="shrink-0 rounded-md bg-slate-200 dark:bg-slate-600 px-2 h-[38px] text-[10px] font-semibold text-slate-500 dark:text-slate-400 active:bg-slate-300 dark:active:bg-slate-500 hidden sm:flex items-center"
          >
            Sel All
          </button>
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
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("del1"); startBackspaceRepeat(); }}
                onPointerUp={stopBackspaceRepeat} onPointerLeave={stopBackspaceRepeat}
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
                  mode === "shift" && "bg-slate-400 dark:bg-slate-500 text-white dark:text-white"
                )}>
                shift
              </button>
              {ROW3.map(({ key, hint }) => charKey(key, hint))}
              <button onPointerDown={(e) => { e.preventDefault(); handleShift(); }}
                className={cn(KDarkR, H, "flex-[1.8] min-w-0",
                  mode === "shift" && "bg-slate-400 dark:bg-slate-500 text-white dark:text-white"
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
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("spc"); handleSpace(); }}
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
                  mode === "shift" && "bg-slate-400 dark:bg-slate-500 text-white dark:text-white",
                  mode === "caps" && "ring-2 ring-[var(--hub-red)] ring-inset"
                )}>
                {mode === "caps" ? "CAPS" : "shift"}
              </button>
              {ROW3.map(({ key, hint }) => charKey(key, hint))}
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("mdel"); startBackspaceRepeat(); }}
                onPointerUp={stopBackspaceRepeat} onPointerLeave={stopBackspaceRepeat}
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
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("mspc"); handleSpace(); }}
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
                <button key={key} onPointerDown={(e) => { e.preventDefault(); animateKey(`n-${key}`); showPreview(key, e.currentTarget); press(key); }}
                  onPointerUp={hidePreview} onPointerLeave={hidePreview}
                  className={cn(K, H, "flex-1 min-w-0 text-[15px] font-medium", popClass(`n-${key}`))}>
                  {key}
                </button>
              ))}
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("ndel1"); startBackspaceRepeat(); }}
                onPointerUp={stopBackspaceRepeat} onPointerLeave={stopBackspaceRepeat}
                className={cn(KDarkR, H, "flex-[1.4] min-w-0", popClass("ndel1"))}>
                delete
              </button>
            </div>
            <div className="flex gap-1">
              {(mode === "numbers" ? NUM_ROW2 : SYM_ROW2).map((key) => (
                <button key={key} onPointerDown={(e) => { e.preventDefault(); animateKey(`n2-${key}`); showPreview(key, e.currentTarget); press(key); }}
                  onPointerUp={hidePreview} onPointerLeave={hidePreview}
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
                <button key={key} onPointerDown={(e) => { e.preventDefault(); animateKey(`n3-${key}`); showPreview(key, e.currentTarget); press(key); }}
                  onPointerUp={hidePreview} onPointerLeave={hidePreview}
                  className={cn(K, H, "flex-1 min-w-0 text-[15px] font-medium", popClass(`n3-${key}`))}>
                  {key}
                </button>
              ))}
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("ndel2"); startBackspaceRepeat(); }}
                onPointerUp={stopBackspaceRepeat} onPointerLeave={stopBackspaceRepeat}
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
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("nspc"); handleSpace(); }}
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
                <button key={key} onPointerDown={(e) => { e.preventDefault(); animateKey(`n-${key}`); showPreview(key, e.currentTarget); press(key); }}
                  onPointerUp={hidePreview} onPointerLeave={hidePreview}
                  className={cn(K, H, "flex-1 min-w-0 text-[15px] font-medium", popClass(`n-${key}`))}>
                  {key}
                </button>
              ))}
            </div>
            {/* Row 2: 10 number/symbol keys (no return) */}
            <div className="flex gap-1">
              {(mode === "numbers" ? NUM_ROW2 : SYM_ROW2).map((key) => (
                <button key={key} onPointerDown={(e) => { e.preventDefault(); animateKey(`n2-${key}`); showPreview(key, e.currentTarget); press(key); }}
                  onPointerUp={hidePreview} onPointerLeave={hidePreview}
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
                <button key={key} onPointerDown={(e) => { e.preventDefault(); animateKey(`n3-${key}`); showPreview(key, e.currentTarget); press(key); }}
                  onPointerUp={hidePreview} onPointerLeave={hidePreview}
                  className={cn(K, H, "flex-1 min-w-0 text-[15px] font-medium", popClass(`n3-${key}`))}>
                  {key}
                </button>
              ))}
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("mndel"); startBackspaceRepeat(); }}
                onPointerUp={stopBackspaceRepeat} onPointerLeave={stopBackspaceRepeat}
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
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("mnspc"); handleSpace(); }}
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
                <button key={emoji} onPointerDown={(e) => { e.preventDefault(); animateKey(`e-${emoji}`); showPreview(emoji, e.currentTarget); press(emoji); }}
                  onPointerUp={hidePreview} onPointerLeave={hidePreview}
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
              <button onPointerDown={(e) => { e.preventDefault(); animateKey("espc"); handleSpace(); }}
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

  return createPortal(
    <>
      {keyboard}
      {/* iOS-style character preview bubble */}
      {preview && (
        <div
          className="fixed z-[10000] pointer-events-none"
          style={{ left: preview.x, top: preview.y }}
        >
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center"
          >
            {/* Bubble */}
            <div
              className="flex items-center justify-center rounded-lg bg-white dark:bg-slate-600 shadow-[0_2px_12px_rgba(0,0,0,0.25)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.6)] text-slate-900 dark:text-white text-2xl font-medium"
              style={{ width: Math.max(preview.w + 12, 44), height: 52 }}
            >
              {preview.char}
            </div>
            {/* Stem / tail */}
            <div
              className="w-[20px] h-[10px] overflow-hidden"
            >
              <div className="w-[20px] h-[20px] bg-white dark:bg-slate-600 rotate-45 transform origin-top-left translate-x-[4px] -translate-y-[6px] rounded-[2px] shadow-[2px_2px_4px_rgba(0,0,0,0.12)]" />
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}

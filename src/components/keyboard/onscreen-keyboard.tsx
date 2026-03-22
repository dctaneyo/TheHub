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
/** Backspace repeat: initial delay then interval */
const BACKSPACE_INITIAL_MS = 400;
const BACKSPACE_REPEAT_MS = 80;
/** Double-space → period shortcut window */
const DOUBLE_SPACE_MS = 300;

/** Haptic feedback (mobile vibration) */
function haptic(ms = 8) {
  try { navigator?.vibrate?.(ms); } catch {}
}

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

  // Cursor position (index into value string)
  const [cursor, setCursor] = useState(value.length);
  // Keep cursor at end when value changes externally
  useEffect(() => { setCursor((c) => Math.min(c, value.length)); }, [value]);
  // Selection state
  const [selStart, setSelStart] = useState<number | null>(null);
  const [selEnd, setSelEnd] = useState<number | null>(null);
  const hasSelection = selStart !== null && selEnd !== null && selStart !== selEnd;

  // Refs for latest value/cursor (avoids stale closures in timers)
  const valueRef = useRef(value);
  const cursorRef = useRef(cursor);
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { cursorRef.current = cursor; }, [cursor]);

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
  // Double-space for period shortcut
  const lastSpaceTap = useRef(0);

  // Hold-to-repeat backspace
  const bsInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const bsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAlpha = mode === "alpha" || mode === "shift" || mode === "caps";
  const isUpper = mode === "shift" || mode === "caps";
  const isNumbers = mode === "numbers" || mode === "symbols";
  const isEmoji = mode === "emoji";

  // ── Cursor-aware insert: replaces selection or inserts at cursor ──
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

  // ── Cursor-aware backspace ──
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

  // ── Hold-to-repeat backspace ──
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

  // Cleanup on unmount
  useEffect(() => () => stopBackspaceRepeat(), [stopBackspaceRepeat]);

  // ── Double-space → period shortcut ──
  const handleSpace = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastSpaceTap.current;
    lastSpaceTap.current = now;
    const v = valueRef.current;
    const c = cursorRef.current;
    if (elapsed < DOUBLE_SPACE_MS && c > 0 && v[c - 1] === " ") {
      // Replace trailing space with ". "
      const newVal = v.slice(0, c - 1) + ". " + v.slice(c);
      onChange(newVal);
      setCursor(c + 1); // moved forward by 1 (". " is 2 chars, replaced 1)
      haptic();
    } else {
      insertAtCursor(" ");
    }
    if (mode === "shift") setMode("alpha");
  }, [insertAtCursor, onChange, mode]);

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

  // ── Select All / Clear selection ──
  const selectAll = useCallback(() => {
    setSelStart(0);
    setSelEnd(value.length);
    haptic();
  }, [value.length]);

  // ── Tap on input display to position cursor ──
  const handleInputTap = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Clear selection on tap
    if (hasSelection) {
      setSelStart(null);
      setSelEnd(null);
      return;
    }
    // Approximate cursor position from tap x within the text container
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - 12; // subtract padding
    if (value.length === 0) return;
    // Rough estimate: each char ~8px wide
    const charWidth = 8;
    const approxPos = Math.round(x / charWidth);
    setCursor(Math.max(0, Math.min(approxPos, value.length)));
    haptic();
  }, [value, hasSelection]);

  // Long-press handlers for hint characters
  const startLongPress = useCallback((hint: string) => {
    longPressTimer.current = setTimeout(() => {
      insertAtCursor(hint);
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

  // ── Key style helpers ──
  const K = "flex items-center justify-center rounded-lg text-sm font-medium select-none transition-transform active:scale-95 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-600";
  const KDark = "flex items-center justify-center rounded-lg text-sm font-medium select-none transition-transform active:scale-95 bg-zinc-200 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-300 shadow-sm border border-zinc-300 dark:border-zinc-500";
  const KDarkL = KDark + " rounded-l-xl";
  const KDarkR = KDark + " rounded-r-xl";
  const KRed = "flex items-center justify-center rounded-lg text-sm font-medium select-none transition-transform active:scale-95 bg-red-500 dark:bg-red-600 text-white shadow-sm";
  const H = "absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-zinc-400 dark:text-zinc-500 pointer-events-none";
  const popClass = (id: string) => pressedKey === id ? "scale-110" : "";

  // Shift button style — active state with dark variant
  const shiftBtnClass = cn(
    KDark,
    (mode === "shift" || mode === "caps") && "bg-slate-400 dark:bg-slate-500 text-white dark:text-white"
  );

  // ── charKey: renders a single character key with optional hint ──
  const charKey = (char: string, hint?: string, widthClass = "h-11 min-w-[2rem] flex-1") => {
    const display = isUpper ? char.toUpperCase() : char;
    const id = `key-${char}`;
    return (
      <button
        key={char}
        type="button"
        className={cn(K, widthClass, "relative", popClass(id))}
        onPointerDown={() => {
          animateKey(id);
          if (hint) startLongPress(isUpper ? hint.toUpperCase() : hint);
        }}
        onPointerUp={() => {
          cancelLongPress();
          press(display);
        }}
        onPointerLeave={cancelLongPress}
      >
        {hint && <span className={H}>{hint}</span>}
        {display}
      </button>
    );
  };

  // ── Render input display with cursor + selection ──
  const renderInputDisplay = () => {
    if (hideInput) return null;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    return (
      <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
        <div
          className="flex-1 min-h-[1.75rem] text-base text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap break-all cursor-text relative"
          onPointerDown={handleInputTap}
        >
          {value.length === 0 && (
            <span className="text-zinc-400 dark:text-zinc-500">{placeholder || "Type here…"}</span>
          )}
          {hasSelection ? (
            <>
              {value.slice(0, Math.min(selStart!, selEnd!))}
              <span className="bg-blue-300/50 dark:bg-blue-500/40">
                {value.slice(Math.min(selStart!, selEnd!), Math.max(selStart!, selEnd!))}
              </span>
              {value.slice(Math.max(selStart!, selEnd!))}
            </>
          ) : (
            <>
              {before}
              <span className="inline-block w-[2px] h-[1.1em] bg-blue-500 dark:bg-blue-400 align-text-bottom animate-pulse" />
              {after}
            </>
          )}
        </div>
        <button
          type="button"
          className="text-[10px] px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600 shrink-0"
          onClick={selectAll}
        >
          Sel All
        </button>
      </div>
    );
  };

  if (!mounted) return null;

  // ── JSX: full keyboard layout ──
  const keyboard = (
    <div className={cn("fixed inset-x-0 bottom-0 z-[9999] bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700 p-2 pb-4 sm:p-3 sm:pb-4 shadow-2xl", className)}>
      {renderInputDisplay()}

      {/* ── Alpha mode ── */}
      {isAlpha && (
        <div className="flex flex-col gap-1.5">
          {/* Row 1 */}
          <div className="flex gap-1 justify-center">
            {ROW1.map((k) => charKey(k.key, k.hint))}
          </div>
          {/* Row 2 */}
          <div className="flex gap-1 justify-center px-3">
            {ROW2.map((k) => charKey(k.key, k.hint))}
          </div>
          {/* Row 3: shift + letters + backspace */}
          <div className="flex gap-1 justify-center">
            <button
              type="button"
              className={cn(shiftBtnClass, "h-11 w-11")}
              onClick={isMobile ? handleMobileShift : handleShift}
              onDoubleClick={!isMobile ? handleCaps : undefined}
            >
              {mode === "caps" ? "⇪" : "⇧"}
            </button>
            {ROW3.map((k) => charKey(k.key, k.hint))}
            <button
              type="button"
              className={cn(KDark, "h-11 w-11")}
              onPointerDown={startBackspaceRepeat}
              onPointerUp={stopBackspaceRepeat}
              onPointerLeave={stopBackspaceRepeat}
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>
          {/* Row 4: bottom row */}
          {isMobile ? (
            <div className="flex gap-1 justify-center">
              <button type="button" className={cn(KDark, "h-11 px-3")} onClick={handleNumToggle}>123</button>
              <button type="button" className={cn(KDark, "h-11 px-3")} onClick={handleEmojiToggle}>😀</button>
              <button type="button" className={cn(K, "h-11 flex-1")} onClick={handleSpace}>space</button>
              <button type="button" className={cn(KDark, "h-11 px-3")} onClick={() => press(".")}>.</button>
              {onSubmit && (
                <button type="button" className="h-11 px-4 rounded-lg bg-blue-500 text-white text-sm font-medium active:scale-95" onClick={onSubmit}>{submitLabel}</button>
              )}
            </div>
          ) : (
            <div className="flex gap-1 justify-center">
              <button type="button" className={cn(KDarkL, "h-11 px-3")} onClick={handleNumToggle}>123</button>
              <button type="button" className={cn(KDark, "h-11 px-3")} onClick={handleEmojiToggle}>😀</button>
              <button type="button" className={cn(K, "h-11 flex-1")} onClick={handleSpace}>space</button>
              <button type="button" className={cn(KDark, "h-11 px-3")} onClick={() => press(".")}>.</button>
              {onSubmit && (
                <button type="button" className="h-11 px-4 rounded-lg bg-blue-500 text-white text-sm font-medium active:scale-95" onClick={onSubmit}>{submitLabel}</button>
              )}
              <button type="button" className={cn(KDarkR, "h-11 px-3")} onClick={onDismiss}>
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Numbers mode ── */}
      {mode === "numbers" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1 justify-center">
            {NUM_ROW1.map((k) => (
              <button key={k} type="button" className={cn(K, "h-11 flex-1", popClass(`n-${k}`))} onClick={() => { animateKey(`n-${k}`); press(k); }}>{k}</button>
            ))}
          </div>
          <div className="flex gap-1 justify-center">
            {NUM_ROW2.map((k) => (
              <button key={k} type="button" className={cn(K, "h-11 flex-1", popClass(`n-${k}`))} onClick={() => { animateKey(`n-${k}`); press(k); }}>{k}</button>
            ))}
          </div>
          <div className="flex gap-1 justify-center">
            <button type="button" className={cn(KDark, "h-11 px-3")} onClick={() => setMode("symbols")}>#+=</button>
            {NUM_ROW3.map((k) => (
              <button key={k} type="button" className={cn(K, "h-11 flex-1", popClass(`n-${k}`))} onClick={() => { animateKey(`n-${k}`); press(k); }}>{k}</button>
            ))}
            <button
              type="button"
              className={cn(KDark, "h-11 w-11")}
              onPointerDown={startBackspaceRepeat}
              onPointerUp={stopBackspaceRepeat}
              onPointerLeave={stopBackspaceRepeat}
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>
          {isMobile ? (
            <div className="flex gap-1 justify-center">
              <button type="button" className={cn(KDark, "h-11 px-3")} onClick={handleNumToggle}>ABC</button>
              <button type="button" className={cn(KDark, "h-11 px-3")} onClick={handleEmojiToggle}>😀</button>
              <button type="button" className={cn(K, "h-11 flex-1")} onClick={handleSpace}>space</button>
              <button type="button" className={cn(KDark, "h-11 px-3")} onClick={() => press(".")}>.</button>
              {onSubmit && (
                <button type="button" className="h-11 px-4 rounded-lg bg-blue-500 text-white text-sm font-medium active:scale-95" onClick={onSubmit}>{submitLabel}</button>
              )}
            </div>
          ) : (
            <div className="flex gap-1 justify-center">
              <button type="button" className={cn(KDarkL, "h-11 px-3")} onClick={handleNumToggle}>ABC</button>
              <button type="button" className={cn(KDark, "h-11 px-3")} onClick={handleEmojiToggle}>😀</button>
              <button type="button" className={cn(K, "h-11 flex-1")} onClick={handleSpace}>space</button>
              <button type="button" className={cn(KDark, "h-11 px-3")} onClick={() => press(".")}>.</button>
              {onSubmit && (
                <button type="button" className="h-11 px-4 rounded-lg bg-blue-500 text-white text-sm font-medium active:scale-95" onClick={onSubmit}>{submitLabel}</button>
              )}
              <button type="button" className={cn(KDarkR, "h-11 px-3")} onClick={onDismiss}>
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Symbols mode ── */}
      {mode === "symbols" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1 justify-center">
            {SYM_ROW1.map((k) => (
              <button key={k} type="button" className={cn(K, "h-11 flex-1", popClass(`s-${k}`))} onClick={() => { animateKey(`s-${k}`); press(k); }}>{k}</button>
            ))}
          </div>
          <div className="flex gap-1 justify-center">
            {SYM_ROW2.map((k) => (
              <button key={k} type="button" className={cn(K, "h-11 flex-1", popClass(`s-${k}`))} onClick={() => { animateKey(`s-${k}`); press(k); }}>{k}</button>
            ))}
          </div>
          <div className="flex gap-1 justify-center">
            <button type="button" className={cn(KDark, "h-11 px-3")} onClick={() => setMode("numbers")}>123</button>
            {SYM_ROW3.map((k) => (
              <button key={k} type="button" className={cn(K, "h-11 flex-1", popClass(`s-${k}`))} onClick={() => { animateKey(`s-${k}`); press(k); }}>{k}</button>
            ))}
            <button
              type="button"
              className={cn(KDark, "h-11 w-11")}
              onPointerDown={startBackspaceRepeat}
              onPointerUp={stopBackspaceRepeat}
              onPointerLeave={stopBackspaceRepeat}
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>
          {isMobile ? (
            <div className="flex gap-1 justify-center">
              <button type="button" className={cn(KDark, "h-11 px-3")} onClick={handleNumToggle}>ABC</button>
              <button type="button" className={cn(KDark, "h-11 px-3")} onClick={handleEmojiToggle}>😀</button>
              <button type="button" className={cn(K, "h-11 flex-1")} onClick={handleSpace}>space</button>
              <button type="button" className={cn(KDark, "h-11 px-3")} onClick={() => press(".")}>.</button>
              {onSubmit && (
                <button type="button" className="h-11 px-4 rounded-lg bg-blue-500 text-white text-sm font-medium active:scale-95" onClick={onSubmit}>{submitLabel}</button>
              )}
            </div>
          ) : (
            <div className="flex gap-1 justify-center">
              <button type="button" className={cn(KDarkL, "h-11 px-3")} onClick={handleNumToggle}>ABC</button>
              <button type="button" className={cn(KDark, "h-11 px-3")} onClick={handleEmojiToggle}>😀</button>
              <button type="button" className={cn(K, "h-11 flex-1")} onClick={handleSpace}>space</button>
              <button type="button" className={cn(KDark, "h-11 px-3")} onClick={() => press(".")}>.</button>
              {onSubmit && (
                <button type="button" className="h-11 px-4 rounded-lg bg-blue-500 text-white text-sm font-medium active:scale-95" onClick={onSubmit}>{submitLabel}</button>
              )}
              <button type="button" className={cn(KDarkR, "h-11 px-3")} onClick={onDismiss}>
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Emoji mode ── */}
      {isEmoji && (
        <div className="flex flex-col gap-1.5">
          {/* Category tabs */}
          <div className="flex gap-1 justify-center">
            {EMOJI_CATEGORIES.map((cat, i) => (
              <button
                key={i}
                type="button"
                className={cn(
                  "h-9 px-3 rounded-lg text-lg select-none transition-colors",
                  emojiCat === i
                    ? "bg-blue-100 dark:bg-blue-900/40"
                    : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                )}
                onClick={() => { setEmojiCat(i); haptic(); }}
              >
                {cat.label}
              </button>
            ))}
          </div>
          {/* Emoji grid */}
          <div className="grid grid-cols-10 gap-1 max-h-36 overflow-y-auto">
            {EMOJI_CATEGORIES[emojiCat].emojis.map((e) => (
              <button
                key={e}
                type="button"
                className="h-10 flex items-center justify-center text-xl rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-90 transition-transform select-none"
                onClick={() => { press(e); haptic(); }}
              >
                {e}
              </button>
            ))}
          </div>
          {/* Bottom row */}
          {isMobile ? (
            <div className="flex gap-1 justify-center">
              <button type="button" className={cn(KDark, "h-11 px-3")} onClick={handleNumToggle}>.?123</button>
              <button type="button" className={cn(K, "h-11 flex-1")} onClick={handleSpace}>space</button>
              <button type="button" className={cn(KDark, "h-11 px-3")} onClick={handleEmojiToggle}>ABC</button>
              <button
                type="button"
                className={cn(KDark, "h-11 w-11")}
                onPointerDown={startBackspaceRepeat}
                onPointerUp={stopBackspaceRepeat}
                onPointerLeave={stopBackspaceRepeat}
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex gap-1 justify-center">
              <button type="button" className={cn(KDarkL, "h-11 px-3")} onClick={handleNumToggle}>ABC</button>
              <button type="button" className={cn(K, "h-11 flex-1")} onClick={handleSpace}>space</button>
              <button
                type="button"
                className={cn(KDark, "h-11 w-11")}
                onPointerDown={startBackspaceRepeat}
                onPointerUp={stopBackspaceRepeat}
                onPointerLeave={stopBackspaceRepeat}
              >
                <Delete className="w-5 h-5" />
              </button>
              <button type="button" className={cn(KDarkR, "h-11 px-3")} onClick={onDismiss}>
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return createPortal(keyboard, document.body);
}

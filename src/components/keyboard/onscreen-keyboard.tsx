"use client";

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Delete, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnscreenKeyboardProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onDismiss?: () => void;
  placeholder?: string;
  className?: string;
}

type KeyboardMode = "alpha" | "shift" | "caps" | "numbers" | "symbols" | "emoji";

// Row 1: q-p with number hints above each key
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

const EMOJI_ROWS = [
  ["😀","😂","😍","🥰","😎","🤔","😅","🙏","👍","👎"],
  ["❤️","🔥","✅","⚠️","🎉","💯","⭐","🚀","💪","🤝"],
  ["😤","😬","🤦","🙌","👀","💬","📋","📌","🔔","⏰"],
];

export function OnscreenKeyboard({ value, onChange, onSubmit, onDismiss, placeholder, className }: OnscreenKeyboardProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [mode, setMode] = useState<KeyboardMode>("alpha");
  const [prevAlphaMode, setPrevAlphaMode] = useState<"alpha" | "shift" | "caps">("alpha");

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

  // Shared key style — light, rectangular, subtle shadow like iPadOS light theme
  const K = "flex items-center justify-center select-none rounded-[6px] bg-white text-slate-800 shadow-[0_1px_0_1px_rgba(0,0,0,0.18)] active:bg-slate-200 transition-colors cursor-pointer text-[15px] font-medium";
  const KDark = "flex items-center justify-center select-none rounded-[6px] bg-slate-200 text-slate-700 shadow-[0_1px_0_1px_rgba(0,0,0,0.18)] active:bg-slate-300 transition-colors cursor-pointer";
  const KDarkL = "flex items-end justify-start pl-2 select-none rounded-[6px] bg-slate-200 text-slate-700 shadow-[0_1px_0_1px_rgba(0,0,0,0.18)] active:bg-slate-300 transition-colors cursor-pointer text-[11px] font-semibold pb-2";
  const KDarkR = "flex items-end justify-end pr-2 select-none rounded-[6px] bg-slate-200 text-slate-700 shadow-[0_1px_0_1px_rgba(0,0,0,0.18)] active:bg-slate-300 transition-colors cursor-pointer text-[11px] font-semibold pb-2";
  const KRed = "flex items-center justify-center select-none rounded-[6px] bg-[var(--hub-red)] text-white shadow-[0_1px_0_1px_rgba(0,0,0,0.25)] active:bg-[#c4001f] transition-colors cursor-pointer";

  const H = "h-[46px]";

  if (!mounted) return null;

  const keyboard = (
    <div
      className={cn(
        "fixed bottom-0 left-1/2 z-[9999] -translate-x-1/2 w-[700px] max-w-[100vw]",
        "select-none bg-slate-300 rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.18)] pb-3",
        className
      )}
    >
      {/* Text input display */}
      <div className="flex items-center gap-2 px-2 pt-2 pb-1.5">
        <div className="flex-1 min-h-[38px] rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-inner overflow-x-auto whitespace-nowrap">
          {value
            ? <span>{value}</span>
            : <span className="text-slate-400">{placeholder || "Type a message..."}</span>
          }
        </div>
        {onSubmit && (
          <button
            onPointerDown={(e) => { e.preventDefault(); onSubmit(); }}
            className="shrink-0 rounded-lg bg-[var(--hub-red)] px-4 h-[38px] text-xs font-bold text-white shadow active:bg-[#c4001f]"
          >
            Send
          </button>
        )}
      </div>
      <div className="px-1.5">
      <div className="space-y-1">

        {/* ── ALPHA MODE ── */}
        {isAlpha && (
          <>
            {/* Row 1: tab + q-p + delete */}
            <div className="flex gap-1">
              <button onPointerDown={(e) => e.preventDefault()}
                className={cn(KDarkL, H, "w-16")}>
                tab
              </button>
              {ROW1.map(({ key }) => (
                <button key={key} onPointerDown={(e) => { e.preventDefault(); press(isUpper ? key.toUpperCase() : key); }}
                  className={cn(K, H, "flex-1")}>
                  {isUpper ? key.toUpperCase() : key}
                </button>
              ))}
              <button onPointerDown={(e) => { e.preventDefault(); backspace(); }}
                className={cn(KDarkR, H, "w-16")}>
                delete
              </button>
            </div>

            {/* Row 2: caps + a-l + return */}
            <div className="flex gap-1">
              <button onPointerDown={(e) => { e.preventDefault(); handleCaps(); }}
                className={cn(KDarkL, H, "w-20",
                  mode === "caps" && "ring-2 ring-[var(--hub-red)] ring-inset"
                )}>
                caps
              </button>
              {ROW2.map(({ key }) => (
                <button key={key} onPointerDown={(e) => { e.preventDefault(); press(isUpper ? key.toUpperCase() : key); }}
                  className={cn(K, H, "flex-1")}>
                  {isUpper ? key.toUpperCase() : key}
                </button>
              ))}
              <button onPointerDown={(e) => { e.preventDefault(); press("\n"); }}
                className={cn(KDarkR, H, "w-20")}>
                return
              </button>
            </div>

            {/* Row 3: shift + z-m + shift */}
            <div className="flex gap-1">
              <button onPointerDown={(e) => { e.preventDefault(); handleShift(); }}
                className={cn(KDarkL, H, "w-24",
                  mode === "shift" && "bg-slate-400"
                )}>
                shift
              </button>
              {ROW3.map(({ key }) => (
                <button key={key} onPointerDown={(e) => { e.preventDefault(); press(isUpper ? key.toUpperCase() : key); }}
                  className={cn(K, H, "flex-1")}>
                  {isUpper ? key.toUpperCase() : key}
                </button>
              ))}
              <button onPointerDown={(e) => { e.preventDefault(); handleShift(); }}
                className={cn(KDarkR, H, "w-24",
                  mode === "shift" && "bg-slate-400"
                )}>
                shift
              </button>
            </div>

            {/* Row 4: .?123 + emoji + space + .?123 + hide */}
            <div className="flex gap-1">
              <button onPointerDown={(e) => { e.preventDefault(); handleNumToggle(); }}
                className={cn(KDarkL, H, "w-20")}>
                .?123
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); handleEmojiToggle(); }}
                className={cn(KDark, H, "w-12 text-base")}>
                😊
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); press(" "); }}
                className={cn(K, H, "flex-1 text-[11px] text-slate-400 font-medium")}>
                space
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); handleNumToggle(); }}
                className={cn(KDarkR, H, "w-20")}>
                .?123
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); onDismiss?.(); }}
                className={cn(KRed, H, "w-16 gap-1")}>
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {/* ── NUMBERS / SYMBOLS MODE ── */}
        {isNumbers && (
          <>
            <div className="flex gap-1">
              {(mode === "numbers" ? NUM_ROW1 : SYM_ROW1).map((key) => (
                <button key={key} onPointerDown={(e) => { e.preventDefault(); press(key); }}
                  className={cn(K, H, "flex-1 text-[15px] font-medium")}>
                  {key}
                </button>
              ))}
              <button onPointerDown={(e) => { e.preventDefault(); backspace(); }}
                className={cn(KDarkR, H, "w-16")}>
                delete
              </button>
            </div>
            <div className="flex gap-1">
              {(mode === "numbers" ? NUM_ROW2 : SYM_ROW2).map((key) => (
                <button key={key} onPointerDown={(e) => { e.preventDefault(); press(key); }}
                  className={cn(K, H, "flex-1 text-[15px] font-medium")}>
                  {key}
                </button>
              ))}
              <button onPointerDown={(e) => { e.preventDefault(); press("\n"); }}
                className={cn(KDarkR, H, "w-16 text-[11px] font-semibold gap-1")}>
                return
              </button>
            </div>
            <div className="flex gap-1">
              <button onPointerDown={(e) => { e.preventDefault(); setMode(mode === "numbers" ? "symbols" : "numbers"); }}
                className={cn(KDarkL, H, "w-16 text-[11px] font-bold")}>
                {mode === "numbers" ? "#+="  : ".?123"}
              </button>
              {(mode === "numbers" ? NUM_ROW3 : SYM_ROW3).map((key) => (
                <button key={key} onPointerDown={(e) => { e.preventDefault(); press(key); }}
                  className={cn(K, H, "flex-1 text-[15px] font-medium")}>
                  {key}
                </button>
              ))}
              <button onPointerDown={(e) => { e.preventDefault(); backspace(); }}
                className={cn(KDarkR, H, "w-16 text-[11px] font-semibold")}>
                delete
              </button>
            </div>
            <div className="flex gap-1">
              <button onPointerDown={(e) => { e.preventDefault(); handleNumToggle(); }}
                className={cn(KDarkL, H, "w-20")}>
                ABC
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); handleEmojiToggle(); }}
                className={cn(KDark, H, "w-12 text-base")}>
                😊
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); press(" "); }}
                className={cn(K, H, "flex-1 text-[11px] text-slate-400")}>
                space
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); handleNumToggle(); }}
                className={cn(KDarkR, H, "w-20")}>
                ABC
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); onDismiss?.(); }}
                className={cn(KRed, H, "w-16 gap-1")}>
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {/* ── EMOJI MODE ── */}
        {isEmoji && (
          <>
            {EMOJI_ROWS.map((row, ri) => (
              <div key={ri} className="flex gap-1 justify-center">
                {row.map((emoji) => (
                  <button key={emoji} onPointerDown={(e) => { e.preventDefault(); press(emoji); }}
                    className={cn(K, H, "w-10 text-xl")}>
                    {emoji}
                  </button>
                ))}
              </div>
            ))}
            <div className="flex gap-1">
              <button onPointerDown={(e) => { e.preventDefault(); handleNumToggle(); }}
                className={cn(KDarkL, H, "w-20")}>
                .?123
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); handleEmojiToggle(); }}
                className={cn(KDark, H, "w-12 text-base ring-2 ring-[var(--hub-red)] ring-inset")}>
                😊
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); press(" "); }}
                className={cn(K, H, "flex-1 text-[11px] text-slate-400")}>
                space
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); handleNumToggle(); }}
                className={cn(KDarkR, H, "w-20")}>
                .?123
              </button>
              <button onPointerDown={(e) => { e.preventDefault(); onDismiss?.(); }}
                className={cn(KRed, H, "w-16 gap-1")}>
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

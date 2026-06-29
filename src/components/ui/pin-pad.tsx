"use client";

import { motion } from "framer-motion";
import { ChevronLeft, Delete } from "@/lib/icons";

const PAD_BUTTONS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "action", "0", "delete"] as const;

interface PinPadProps {
  /** Current entered digits — only used to highlight the most recently pressed one. */
  value: string;
  maxLength: number;
  onDigit: (digit: string) => void;
  onDelete: () => void;
  /** The "action" slot — back arrow or "Clear", caller decides which to show. */
  onAction: () => void;
  actionContent: React.ReactNode;
  disabled?: boolean;
  /** Marks the last-pressed digit button with data-login-button (used by login/page.tsx's Enter-key handler to flash it). Off by default — most callers don't need it. */
  markLastDigit?: boolean;
}

export function PinPad({ value, maxLength, onDigit, onDelete, onAction, actionContent, disabled, markLastDigit }: PinPadProps) {
  return (
    <div className="grid w-full grid-cols-3 gap-2 sm:gap-3 mt-1">
      {PAD_BUTTONS.map((btn) => {
        if (btn === "action") {
          return (
            <motion.button
              key="action"
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={onAction}
              disabled={disabled}
              className="flex h-12 sm:h-16 items-center justify-center rounded-2xl border border-border bg-background text-sm font-semibold text-muted-foreground transition-colors active:bg-muted disabled:opacity-50"
            >
              {actionContent}
            </motion.button>
          );
        }
        if (btn === "delete") {
          return (
            <motion.button
              key="delete"
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={onDelete}
              disabled={disabled}
              className="flex h-12 sm:h-16 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground transition-colors active:bg-muted disabled:opacity-50"
            >
              <Delete className="h-5 w-5" />
            </motion.button>
          );
        }
        const isLastDigit = markLastDigit && value.length === maxLength && btn === value[maxLength - 1];
        return (
          <motion.button
            key={btn}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => onDigit(btn)}
            disabled={disabled}
            {...(isLastDigit && { "data-login-button": true })}
            className="flex h-12 sm:h-16 items-center justify-center rounded-2xl bg-background text-lg font-semibold text-foreground transition-colors active:bg-muted disabled:opacity-50"
          >
            {btn}
          </motion.button>
        );
      })}
    </div>
  );
}

// Re-exported so callers building their own action-slot icon don't need a
// separate lucide-react import just for this one icon.
export { ChevronLeft as PinPadBackIcon };

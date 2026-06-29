"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { PinPad } from "@/components/ui/pin-pad";

const PIN_LENGTH = 6;

export interface ConfirmWithPinDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Receives the entered PIN — the caller sends it to the server, which re-checks it. This dialog never validates the PIN itself. */
  onConfirm: (pin: string) => void;
  onCancel: () => void;
  /** Set true while the confirm action's request is in flight, to disable re-submission. */
  submitting?: boolean;
  /** Server-side rejection message (wrong PIN, lockout, etc.) — shown above the pad. */
  error?: string;
}

/**
 * Admin Console only — re-confirms the 6-digit PIN before a destructive
 * action fires, regardless of how recently the admin authenticated. A stray
 * click can trigger a button and even a plain "Yes, delete" confirm in
 * sequence; it can't type a correct PIN by accident. See the Admin Console
 * plan's "PIN re-confirmation on destructive actions, not a lock screen"
 * section for why this exists instead of a session-lock feature.
 */
export function ConfirmWithPinDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  submitting = false,
  error,
}: ConfirmWithPinDialogProps) {
  const [pin, setPin] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Reset the entered PIN whenever the dialog transitions to open — adjusted
  // during render (React's recommended pattern for resetting state on a
  // prop change) rather than in an effect, which would trigger an extra
  // cascading render for no benefit here.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setPin("");
  }

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  const handleDigit = useCallback((digit: string) => {
    setPin((prev) => (prev.length < PIN_LENGTH ? prev + digit : prev));
  }, []);

  const handleDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setPin("");
  }, []);

  const canSubmit = pin.length === PIN_LENGTH && !submitting;

  const handleConfirm = useCallback(() => {
    if (!canSubmit) return;
    onConfirm(pin);
  }, [canSubmit, onConfirm, pin]);

  const dots = Array.from({ length: PIN_LENGTH }, (_, i) => (
    <div
      key={i}
      className={cn(
        "h-2.5 w-2.5 rounded-full transition-colors",
        i < pin.length ? "bg-destructive" : "bg-muted"
      )}
    />
  ));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
              </div>
              <button
                onClick={onCancel}
                className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Enter your PIN to confirm
            </p>
            <div className="mt-3 flex justify-center gap-2">{dots}</div>

            <div className="mt-2 h-6 flex items-center justify-center">
              {error && <span className="text-xs text-destructive">{error}</span>}
            </div>

            <div className="mt-2">
              <PinPad
                value={pin}
                maxLength={PIN_LENGTH}
                onDigit={handleDigit}
                onDelete={handleDelete}
                onAction={handleClear}
                actionContent="Clear"
                disabled={submitting}
              />
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                ref={cancelRef}
                onClick={onCancel}
                disabled={submitting}
                className="rounded-xl bg-muted px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                onClick={handleConfirm}
                disabled={!canSubmit}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {submitting ? "Confirming…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook mirroring useConfirmDialog's API shape, for the PIN-gated variant.
 */
export function useConfirmWithPinDialog() {
  const [state, setState] = useState<Omit<ConfirmWithPinDialogProps, "open" | "onCancel" | "onConfirm"> & {
    onConfirm: (pin: string) => void;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const confirm = useCallback((opts: {
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: (pin: string) => void | Promise<void>;
  }) => {
    setError(undefined);
    setState({
      ...opts,
      onConfirm: async (pin: string) => {
        setSubmitting(true);
        setError(undefined);
        try {
          await opts.onConfirm(pin);
          setState(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Incorrect PIN");
        } finally {
          setSubmitting(false);
        }
      },
    });
  }, []);

  const cancel = useCallback(() => {
    setState(null);
    setError(undefined);
  }, []);

  const dialog: ConfirmWithPinDialogProps = state
    ? { ...state, open: true, onCancel: cancel, submitting, error }
    : { open: false, title: "", description: "", onConfirm: () => {}, onCancel: cancel };

  return { dialog, confirm };
}

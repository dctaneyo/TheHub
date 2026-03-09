"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "@/lib/icons";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

const variantStyles = {
  danger: {
    icon: "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400",
    btn: "bg-red-600 hover:bg-red-700 text-white",
  },
  warning: {
    icon: "bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400",
    btn: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  info: {
    icon: "bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400",
    btn: "bg-indigo-600 hover:bg-indigo-700 text-white",
  },
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const styles = variantStyles[variant];

  // Focus cancel button on open for accessibility
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

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
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
          >
            <div className="flex items-start gap-4">
              <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", styles.icon)}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
              </div>
              <button
                onClick={onCancel}
                className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                ref={cancelRef}
                onClick={onCancel}
                className="rounded-xl bg-muted px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={cn("rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors shadow-sm", styles.btn)}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Lightweight hook for confirm-dialog state management.
 * Usage:
 *   const { dialog, confirm, alertDialog } = useConfirmDialog();
 *   // In JSX: <ConfirmDialog {...dialog} />
 *   // To trigger: confirm({ title, description, onConfirm, ... })
 *   // For alert (no cancel): alertDialog({ title, description })
 */
export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogProps | null>(null);

  const confirm = useCallback((opts: Omit<ConfirmDialogProps, "open" | "onCancel"> & { onCancel?: () => void }) => {
    setState({
      ...opts,
      open: true,
      onCancel: () => {
        opts.onCancel?.();
        setState(null);
      },
      onConfirm: () => {
        opts.onConfirm();
        setState(null);
      },
    });
  }, []);

  const alertDialog = useCallback((opts: { title: string; description: string; variant?: "danger" | "warning" | "info" }) => {
    setState({
      ...opts,
      open: true,
      confirmLabel: "OK",
      cancelLabel: "",
      onCancel: () => setState(null),
      onConfirm: () => setState(null),
    });
  }, []);

  const dialog: ConfirmDialogProps = state ?? {
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
    onCancel: () => {},
  };

  return { dialog, confirm, alertDialog };
}


"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@ark-ui/react/dialog"
import { Portal } from "@ark-ui/react/portal"
import { XIcon } from "@/lib/icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

// Ark's close part is named CloseTrigger; kept as DialogClose here so
// existing call sites (and any DialogClose asChild usage) don't change.
function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.CloseTrigger>) {
  return <DialogPrimitive.CloseTrigger data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Backdrop>) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        // z-[9999], not shadcn's stock z-50 — this app's top-tier overlays
        // (confirm-dialog.tsx, emergency-overlay, the onscreen keyboard,
        // error-boundary) all cluster at z-[9997]-z-[10000]. z-50 sat below
        // the ARL header (z-[100]) and its mobile nav overlay (z-[140]), so
        // a dialog rendered with its backdrop visually stopping short of —
        // and its content able to be covered by — the page chrome above it.
        "fixed inset-0 z-[9999] bg-black/50 data-[state=closed]:hidden",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  // Portal even though Positioner is `position: fixed` — fixed escapes
  // ancestor overflow clipping, but not a transformed ancestor (any
  // framer-motion wrapper mid-animation creates a new containing block),
  // so this is the same risk class as Menu/Select without one.
  return (
    <Portal>
      <DialogOverlay />
      <DialogPrimitive.Positioner className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className={cn(
            // bg-card, not bg-background — DESIGN.md §8's elevation model is
            // base darkest, cards lighter, modals lighter still; bg-background
            // put a modal at the *base* tier, the same color as the page
            // behind the backdrop (worse than wrong in dark mode, where it's
            // actually darker than the cards it's floating above). Matches
            // Menu's dropdown (bg-card) and Select's (bg-popover, same value).
            "relative grid w-full max-w-lg gap-4 rounded-2xl border border-border bg-card text-card-foreground p-6 shadow-lg outline-none",
            className
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.CloseTrigger
              data-slot="dialog-close"
              className="absolute top-4 right-4 rounded-lg p-1 text-muted-foreground opacity-70 outline-none transition-opacity hover:opacity-100 hover:bg-muted active:opacity-100 active:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none"
            >
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.CloseTrigger>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Positioner>
    </Portal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.CloseTrigger asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.CloseTrigger>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
}

"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@ark-ui/react/select"
import type { SelectRootComponentProps } from "@ark-ui/react/select"
import type { CollectionItem } from "@ark-ui/react/collection"
import { Portal } from "@ark-ui/react/portal"
import { Check, ChevronDown } from "@/lib/icons"

import { cn } from "@/lib/utils"

// Replaces native <select> app-wide (DESIGN.md §15 decision) so every
// dropdown gets real styling control instead of the browser default.
// `createListCollection` is re-exported so call sites don't need a
// separate import for it.
export { createListCollection } from "@ark-ui/react/collection"

// Generic, matching Ark's own SelectRoot — without this, TS collapses the
// collection's item type to `unknown` and every call site's `collection`
// prop fails to typecheck against its own createListCollection() result.
function Select<T extends CollectionItem>({ ...props }: SelectRootComponentProps<T>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Control>
      <SelectPrimitive.Trigger
        data-slot="select-trigger"
        className={cn(
          // rounded-xl to match Input — same form-control tier, often sits
          // in the same row as a text Input (DESIGN.md §3).
          "flex w-full items-center justify-between gap-2 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors",
          "hover:border-ring/50 active:border-ring/50",
          "focus-visible:ring-2 focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
        <SelectPrimitive.Indicator className="text-muted-foreground data-[state=open]:rotate-180 transition-transform">
          <ChevronDown className="h-4 w-4" />
        </SelectPrimitive.Indicator>
      </SelectPrimitive.Trigger>
    </SelectPrimitive.Control>
  )
}

function SelectValueText(props: React.ComponentProps<typeof SelectPrimitive.ValueText>) {
  return <SelectPrimitive.ValueText data-slot="select-value" {...props} />
}

function SelectContent({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  // Portal is required — without it the positioner is `position: absolute`
  // inside whatever DOM parent rendered it, so any ancestor with
  // overflow-hidden/auto (a scrollable table, a modal body) clips the
  // dropdown instead of letting it float above the page.
  return (
    <Portal>
      <SelectPrimitive.Positioner>
        <SelectPrimitive.Content
          data-slot="select-content"
          className={cn(
            // z-[10000], not shadcn's stock z-50 — Select is frequently used
            // inside Dialog (now z-[9999], see dialog.tsx), so its dropdown
            // needs a strictly higher z-index to render above the dialog
            // that contains it, not just above the page header.
            "z-[10000] min-w-[var(--reference-width)] overflow-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg",
            className
          )}
          {...props}
        />
      </SelectPrimitive.Positioner>
    </Portal>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none cursor-pointer",
        "data-[highlighted]:bg-muted",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectTrigger, SelectValueText, SelectContent, SelectItem }

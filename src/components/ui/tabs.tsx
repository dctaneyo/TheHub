"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@ark-ui/react/tabs"

import { cn } from "@/lib/utils"

// Underline only — the app's one decided tab style (DESIGN.md §15). No
// variant prop: previously this supported "default" (segmented pill) and
// "line" (underline), but the app only ever needs one, and offering a
// choice here is exactly what let two real screens drift into different
// styles in the first place.

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("relative flex items-center gap-6 border-b border-border", className)}
      {...props}
    >
      {props.children}
      <TabsPrimitive.Indicator className="absolute bottom-0 h-0.5 w-[var(--width)] bg-foreground" />
    </TabsPrimitive.List>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative py-2.5 text-sm font-semibold text-muted-foreground transition-colors outline-none",
        "hover:text-foreground active:text-foreground",
        "data-[selected]:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:rounded-sm",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }

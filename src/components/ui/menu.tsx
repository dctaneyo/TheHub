"use client"

import * as React from "react"
import { Menu as MenuPrimitive } from "@ark-ui/react/menu"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Replaces ad hoc dropdown implementations (row overflow menus, header
// overflow, settings popovers — DESIGN.md §15 decision) with one shared,
// keyboard/focus-managed primitive.

function Menu({ ...props }: React.ComponentProps<typeof MenuPrimitive.Root>) {
  return <MenuPrimitive.Root data-slot="menu" {...props} />
}

function MenuTrigger({
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Trigger>) {
  return <MenuPrimitive.Trigger data-slot="menu-trigger" {...props} />
}

function MenuContent({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Positioner>
      <MenuPrimitive.Content
        data-slot="menu-content"
        className={cn(
          "z-50 min-w-[168px] overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg outline-none",
          className
        )}
        {...props}
      />
    </MenuPrimitive.Positioner>
  )
}

const menuItemVariants = cva(
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold outline-none cursor-pointer",
  {
    variants: {
      variant: {
        default: "text-foreground data-[highlighted]:bg-muted",
        destructive: "text-red-600 dark:text-red-400 data-[highlighted]:bg-red-500/10",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

function MenuItem({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Item> &
  VariantProps<typeof menuItemVariants>) {
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      className={cn(menuItemVariants({ variant }), className)}
      {...props}
    />
  )
}

function MenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      data-slot="menu-separator"
      className={cn("my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

export { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator }

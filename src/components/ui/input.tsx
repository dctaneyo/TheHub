import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // rounded-xl, not shadcn's stock rounded-md — matches this app's
        // heavy-radius house style (DESIGN.md §3) and the Button primitive.
        // bg-input (not bg-transparent), no shadow-xs: DESIGN.md §3 prefers
        // fill-color contrast over shadow to separate surfaces, and shadow
        // is reserved for true overlays — a resting input is neither. The
        // dark:bg-input/30 half of this was already correct; bg-input now
        // applies the same token in light mode instead of relying on the
        // border alone.
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground bg-input dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-xl border px-3 py-1 text-base transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-semibold disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }

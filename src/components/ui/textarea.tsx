import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // rounded-xl, matching Input/Button — see DESIGN.md §3.
        // bg-input (not bg-transparent), no shadow-xs — same reasoning as
        // Input: fill-color contrast over shadow, applied in both modes
        // instead of leaving light mode on transparent+border-only.
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-input dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-xl border px-3 py-2 text-base transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

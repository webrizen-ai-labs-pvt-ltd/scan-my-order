import * as React from "react"
import { cn } from "../../lib/utils"

const Kbd = React.forwardRef(({ className, ...props }, ref) => (
  <kbd
    ref={ref}
    className={cn(
      "pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-zinc-200 bg-zinc-100 px-1.5 font-mono text-[10px] font-medium text-zinc-500 opacity-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
      className
    )}
    {...props}
  />
))
Kbd.displayName = "Kbd"

export { Kbd }

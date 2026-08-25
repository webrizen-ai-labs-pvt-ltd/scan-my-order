import * as React from "react"
import { cn } from "@ui/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-lg border-0 bg-muted/50 px-4 py-2.5",
        "text-sm text-foreground transition-colors duration-200",
        "placeholder:text-muted-foreground/60",
        "hover:bg-muted/70",
        "focus:bg-background focus:outline-none focus-visible:ring-0",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "selection:bg-primary/20 selection:text-foreground",
        "caret-primary",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = "Input"

export { Input }
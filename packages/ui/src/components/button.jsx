import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { cn } from "../lib/utils.js"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(0,0,0,0.3)] border border-zinc-700/50 hover:from-zinc-600 hover:via-zinc-700 hover:to-zinc-800 dark:from-zinc-200 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.1)] dark:border-zinc-300/50 dark:hover:from-zinc-100 dark:hover:via-zinc-200 dark:hover:to-zinc-300",
        destructive:
          "bg-gradient-to-b from-red-500 via-red-600 to-red-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.2)] border border-red-600/50 hover:from-red-400 hover:via-red-500 hover:to-red-600 dark:from-red-800 dark:via-red-900 dark:to-red-950 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(0,0,0,0.4)] dark:border-red-700/50 dark:hover:from-red-700 dark:hover:via-red-800 dark:hover:to-red-900",
        outline:
          "bg-gradient-to-b from-white via-zinc-50 to-zinc-100 border border-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),inset_0_-1px_0_rgba(0,0,0,0.05)] hover:from-zinc-50 hover:via-zinc-100 hover:to-zinc-200 hover:text-zinc-900 dark:from-zinc-900 dark:via-zinc-950 dark:to-black dark:border-zinc-700 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-1px_0_rgba(0,0,0,0.3)] dark:hover:from-zinc-800 dark:hover:via-zinc-900 dark:hover:to-zinc-950 dark:hover:text-zinc-50",
        secondary:
          "bg-gradient-to-b from-zinc-200 via-zinc-300 to-zinc-400 text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.1)] border border-zinc-300/50 hover:from-zinc-100 hover:via-zinc-200 hover:to-zinc-300 dark:from-zinc-700 dark:via-zinc-800 dark:to-zinc-900 dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(0,0,0,0.3)] dark:border-zinc-600/50 dark:hover:from-zinc-600 dark:hover:via-zinc-700 dark:hover:to-zinc-800",
        ghost: 
          "bg-transparent hover:bg-gradient-to-b hover:from-zinc-100 hover:via-zinc-200 hover:to-zinc-300 hover:text-zinc-900 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.1)] dark:hover:from-zinc-800 dark:hover:via-zinc-900 dark:hover:to-zinc-950 dark:hover:text-zinc-50 dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-1px_0_rgba(0,0,0,0.3)]",
        link: 
          "bg-transparent text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "primary" | "success" | "warning" | "error" | "neutral"
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    const variants = {
      primary: "bg-brand-secondary/10 text-brand-secondary",
      success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
      warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
      error: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
      neutral: "bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-200",
    }

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
          variants[variant],
          className
        )}
        {...props}
      />
    )
  }
)

Badge.displayName = "Badge"

export { Badge }

import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps {
  value: number
  max?: number
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
  variant?: "default" | "success" | "warning" | "error" | "intermediate"
  className?: string
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ value, max = 100, size = "md", showLabel = false, variant = "default", className }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100))

    const sizes = {
      sm: "h-1",
      md: "h-2",
      lg: "h-3",
    }

    const variants = {
      default: "bg-brand-secondary",
      success: "bg-emerald-500",
      warning: "bg-amber-500",
      error: "bg-red-500",
      intermediate: "bg-orange-500",
    }

    return (
      <div ref={ref} className={cn("w-full", className)}>
        <div
          className={cn(
            "bg-brand-border rounded-full overflow-hidden",
            sizes[size]
          )}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              variants[variant]
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {showLabel && (
          <div className="mt-1 text-right text-sm text-brand-textSecondary">
            {Math.round(percentage)}%
          </div>
        )}
      </div>
    )
  }
)

Progress.displayName = "Progress"

export { Progress }

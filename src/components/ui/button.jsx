import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[16px] text-sm font-bold ring-offset-background transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[linear-gradient(135deg,#FFD700,#B8860B,#DAA520)] text-white shadow-[0_8px_32px_rgba(255,215,0,0.4)] hover:brightness-110",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-[rgba(255,215,0,0.35)] bg-[rgba(255,255,255,0.08)] backdrop-blur-md text-[hsl(var(--foreground))] hover:scale-[1.02]",
        secondary:
          "border border-[rgba(255,215,0,0.35)] bg-[rgba(255,255,255,0.08)] backdrop-blur-md text-[hsl(var(--foreground))] hover:scale-[1.02]",
        ghost: "hover:bg-accent/40 hover:text-accent-foreground",
        link: "text-[#B8860B] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[44px] px-5 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-[52px] rounded-[16px] px-7",
        icon: "h-10 w-10",
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
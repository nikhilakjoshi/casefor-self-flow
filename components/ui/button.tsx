import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// casefor ink — tight chrome radius (4px) per spec. Never rounded-md/lg/xl on
// buttons. Primary variant is ink→deep-brown on hover with a soft shadow-md
// lift. Secondary is warm-white with cream border, hover fills cream.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[4px] text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--accent-gold-muted)] focus-visible:border-[var(--accent-gold)] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--ink)] text-[var(--parchment)] hover:bg-[var(--deep-brown)] hover:shadow-[0_4px_12px_rgba(12,11,10,0.06)]",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-[var(--cream)] bg-[var(--warm-white)] text-[var(--charcoal)] hover:bg-[var(--cream)] hover:text-[var(--ink)]",
        secondary:
          "bg-[var(--warm-white)] text-[var(--charcoal)] border border-[var(--cream)] hover:bg-[var(--cream)]",
        ghost:
          "text-[var(--charcoal)] hover:bg-[var(--cream)] hover:text-[var(--ink)]",
        link: "text-[var(--accent-gold)] underline-offset-4 hover:text-[var(--accent-gold-light)] hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-[4px] px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-[4px] gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-[4px] px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-[4px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

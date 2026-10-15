import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const baseButtonVariants = cva(
  "pressable inline-flex select-none items-center justify-center gap-2 rounded-full font-display font-extrabold uppercase tracking-[0.06em] [font-stretch:112%] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-brand-700 text-on-brand hover:bg-brand-800",
        secondary: "border-2 border-ink text-ink hover:bg-fill",
        ghost: "text-brand-700 hover:bg-brand-50",
      },
      size: {
        md: "min-h-11 px-6 py-2 text-[0.8125rem]",
        lg: "min-h-14 px-9 py-3 text-[0.9375rem]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

/** Variant classes, merged so overrides like `hidden sm:inline-flex` win. */
export function buttonVariants({
  className,
  ...variants
}: VariantProps<typeof baseButtonVariants> & { className?: string } = {}) {
  return cn(baseButtonVariants(variants), className);
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof baseButtonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

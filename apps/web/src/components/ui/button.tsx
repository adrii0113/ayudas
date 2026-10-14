import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const baseButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-brand-700 text-white hover:bg-brand-800",
        secondary: "border border-gray-300 bg-white text-ink hover:bg-gray-50",
        ghost: "text-brand-700 hover:bg-brand-50",
      },
      size: {
        md: "min-h-11 px-4 py-2 text-base",
        lg: "min-h-13 px-6 py-3 text-lg",
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

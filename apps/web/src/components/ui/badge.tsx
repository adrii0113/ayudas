import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-gray-100 text-gray-800",
        brand: "bg-brand-100 text-brand-800",
        warning: "bg-amber-100 text-amber-900",
        danger: "bg-red-100 text-red-900",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

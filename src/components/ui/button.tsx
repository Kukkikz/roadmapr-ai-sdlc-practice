import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

// DESIGN.md "Components": near-black primary, white secondary with a hairline outline,
// 12px corners, pressed state only (no hover styling). One primary button per viewport.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent text-base font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:bg-surface-strong disabled:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground active:bg-primary-active",
        secondary: "border-border bg-secondary text-secondary-foreground active:bg-surface-strong",
        ghost: "text-foreground active:bg-surface-strong",
        link: "text-link underline-offset-4 active:text-link-active",
      },
      size: {
        default: "h-11 px-6",
        sm: "h-9 rounded-md px-3 text-sm",
        icon: "size-10 rounded-full border-border bg-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };

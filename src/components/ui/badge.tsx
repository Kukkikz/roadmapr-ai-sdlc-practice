import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

// DESIGN.md: status is always a coloured badge WITH a text label (never colour alone).
// `tag` is the soft grey chip used for idea tags.
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-sm px-2 py-1 text-[13px] leading-[1.35] font-medium tracking-[0.16px] [&>svg]:size-3",
  {
    variants: {
      variant: {
        tag: "bg-muted text-body",
        open: "bg-status-open text-ink",
        planned: "bg-status-planned text-info",
        "in-progress": "bg-status-in-progress text-ink",
        shipped: "bg-status-shipped text-success",
        declined: "bg-status-declined text-danger",
      },
    },
    defaultVariants: {
      variant: "tag",
    },
  },
);

function Badge({
  className,
  variant = "tag",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };

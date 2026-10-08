import * as React from "react";
import { cn } from "cn";

// DESIGN.md "text-input": 44px tall, 6px corners, hairline border, blue focus ring.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-sm border border-input bg-background px-4 py-3 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:border-border-strong disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

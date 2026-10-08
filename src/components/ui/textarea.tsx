import * as React from "react";
import { cn } from "cn";

// Same field styling as Input (DESIGN.md "text-input"), taller and multi-line.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-28 w-full rounded-sm border border-input bg-background px-4 py-3 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:border-border-strong disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/20",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

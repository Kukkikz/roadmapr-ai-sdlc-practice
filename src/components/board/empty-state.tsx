import type { ReactNode } from "react";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg bg-muted p-12 text-center text-body">
      <h2 className="text-xl font-medium text-ink">{title}</h2>
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}

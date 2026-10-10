"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

const noop = () => () => {};
const originOnClient = () => window.location.origin;
const originOnServer = () => "";

/**
 * A secret link shown once, in the mono block, with a copy button (DESIGN.md). It sits on a dark
 * surface. `path` is the app-relative path (`/login/<token>`); the origin is added in the
 * browser. `children` are extra buttons next to Copy.
 */
export function SecretLink({
  path,
  testId,
  children,
}: {
  path: string;
  testId: string;
  children?: ReactNode;
}) {
  const origin = useSyncExternalStore(noop, originOnClient, originOnServer);
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const url = `${origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied("copied");
    } catch {
      // No clipboard access (for example on a non-secure origin): the link is still selectable.
      setCopied("failed");
    }
  }

  return (
    <>
      <code
        data-testid={testId}
        className="break-all rounded-md bg-primary-active px-4 py-3 font-mono text-[13px] text-on-dark"
      >
        {url}
      </code>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={copy}>
          {copied === "copied" ? "Copied" : "Copy link"}
        </Button>
        {children}
      </div>
      <p className="sr-only" aria-live="polite">
        {copied === "copied" ? "Link copied to the clipboard." : ""}
      </p>
      {copied === "failed" ? (
        <p className="text-sm">Could not copy. Select the link above and copy it yourself.</p>
      ) : null}
    </>
  );
}

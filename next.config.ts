import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // PGlite loads its WASM and data files from its own package directory, which bundling breaks.
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    return [
      {
        // Baseline hardening. No page is meant to be framed, which also stops clickjacking of
        // the "Continue" and delete screens. A CSP needs a nonce design and comes later.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
            : []),
        ],
      },
      {
        // Secret links (G4): never leak the token in a Referer header, never cache the page.
        // Listed after the rule above, so for the same key this one wins.
        source: "/:kind(login|join)/:token",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

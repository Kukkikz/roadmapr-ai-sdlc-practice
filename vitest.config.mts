import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    environment: "node",
    // Booting PGlite (WASM) in beforeAll can be slow when many test files start at once.
    hookTimeout: 30_000,
    env: { SESSION_SECRET: "vitest-only-session-secret-at-least-32-chars" },
    // Test files share one database (and each wipes it) when running against real Postgres.
    fileParallelism: !process.env.TEST_DATABASE_URL,
  },
});

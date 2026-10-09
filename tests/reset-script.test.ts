import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Only the refusal paths are run here: they exit before touching any database or folder.
function runReset(env: Record<string, string>) {
  const tsx = join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  return spawnSync(process.execPath, [tsx, "scripts/reset.mts"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: "", PGLITE_DATA_DIR: "", ...env },
    encoding: "utf8",
    timeout: 60_000,
  });
}

// Starting tsx in a child process is slow when the other test files run in parallel.
describe("db:reset safety guards", { timeout: 60_000 }, () => {
  it("refuses when DATABASE_URL is set, so it can never wipe a hosted database", () => {
    const result = runReset({ DATABASE_URL: "postgres://user:pass@example.neon.tech/db" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DATABASE_URL is set");
  });

  it("refuses a folder outside .data/ and leaves it alone", () => {
    const outside = mkdtempSync(join(tmpdir(), "roadmapr-reset-"));
    const marker = join(outside, "keep.txt");
    writeFileSync(marker, "keep");
    try {
      const result = runReset({ PGLITE_DATA_DIR: outside });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("inside .data/");
      expect(existsSync(marker)).toBe(true);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("refuses .data itself and parent-directory paths", () => {
    for (const dir of [".data", ".data/..", "..", "."]) {
      const result = runReset({ PGLITE_DATA_DIR: dir });
      expect(result.status, dir).toBe(1);
    }
  });
});

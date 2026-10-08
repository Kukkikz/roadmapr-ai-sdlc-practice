import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createPgliteDb } from "@/db";

const root = mkdtempSync(join(tmpdir(), "roadmapr-"));

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("createPgliteDb", () => {
  it("creates missing parent directories for a file-backed database", async () => {
    const db = createPgliteDb(join(root, "nested", "pglite"));
    const result = await db.execute(sql`select 1 as one`);
    expect(result.rows[0]).toEqual({ one: 1 });
  });
});

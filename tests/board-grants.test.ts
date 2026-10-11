import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  MAX_BOARD_GRANTS,
  signBoardGrants,
  verifyBoardGrants,
  withGrant,
  type BoardGrant,
} from "@/lib/board-grants";

const SECRET = "s".repeat(32);
const grant = (n: number): BoardGrant => ({ boardId: `board-${n}`, linkId: `link-${n}` });

describe("signed Board grants (US-4.2)", () => {
  it("round-trips the grants", () => {
    const grants = [grant(1), grant(2)];
    expect(verifyBoardGrants(signBoardGrants(grants, SECRET), SECRET)).toEqual(grants);
  });

  it("gives nothing for a missing, malformed or wrongly signed value", () => {
    const good = signBoardGrants([grant(1)], SECRET);
    expect(verifyBoardGrants(undefined, SECRET)).toEqual([]);
    expect(verifyBoardGrants("", SECRET)).toEqual([]);
    expect(verifyBoardGrants("nonsense", SECRET)).toEqual([]);
    expect(verifyBoardGrants(`${good}.extra`, SECRET)).toEqual([]);
    expect(verifyBoardGrants(good, "t".repeat(32))).toEqual([]);
  });

  it("rejects a payload that was edited after signing", () => {
    const [, signature] = signBoardGrants([grant(1)], SECRET).split(".");
    const forged = Buffer.from(JSON.stringify([{ b: "board-9", l: "link-9" }])).toString(
      "base64url",
    );
    expect(verifyBoardGrants(`${forged}.${signature}`, SECRET)).toEqual([]);
  });

  it("rejects a correctly signed value that is not a list of grants", () => {
    const payload = Buffer.from(JSON.stringify({ b: "x" })).toString("base64url");
    const signature = createHmac("sha256", SECRET)
      .update(`board-access:${payload}`)
      .digest("base64url");
    expect(verifyBoardGrants(`${payload}.${signature}`, SECRET)).toEqual([]);
  });

  it("is not interchangeable with the anonymous-ID cookie signature", () => {
    // A grant cookie value must never verify as anything else and vice versa: the signed
    // string carries a "board-access:" prefix.
    const value = signBoardGrants([grant(1)], SECRET);
    expect(value.split(".")).toHaveLength(2);
  });
});

describe("withGrant", () => {
  it("replaces an earlier grant for the same Board", () => {
    const next = withGrant([grant(1), grant(2)], { boardId: "board-1", linkId: "link-new" });
    expect(next).toEqual([grant(2), { boardId: "board-1", linkId: "link-new" }]);
  });

  it("keeps only the newest grants", () => {
    let grants: BoardGrant[] = [];
    for (let n = 0; n < MAX_BOARD_GRANTS + 5; n++) grants = withGrant(grants, grant(n));
    expect(grants).toHaveLength(MAX_BOARD_GRANTS);
    expect(grants.at(-1)).toEqual(grant(MAX_BOARD_GRANTS + 4));
    expect(grants[0]).toEqual(grant(5));
  });
});

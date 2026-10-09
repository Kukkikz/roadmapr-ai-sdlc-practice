import { describe, expect, it } from "vitest";
import { boardHref, parseBoardQuery } from "@/lib/board-query";

describe("parseBoardQuery", () => {
  it("defaults to sort=top with no filters", () => {
    expect(parseBoardQuery({})).toEqual({
      sort: "top",
      status: undefined,
      tag: undefined,
      q: undefined,
    });
  });

  it("reads valid values", () => {
    expect(
      parseBoardQuery({ sort: "newest", status: "in_progress", tag: "t1", q: " dark " }),
    ).toEqual({
      sort: "newest",
      status: "in_progress",
      tag: "t1",
      q: "dark",
    });
  });

  it("ignores invalid values instead of throwing", () => {
    expect(
      parseBoardQuery({ sort: "trending", status: "bogus", tag: "", q: "x".repeat(101) }),
    ).toEqual({ sort: "top", status: undefined, tag: undefined, q: undefined });
  });

  it("uses the first value of a repeated parameter and drops a blank search", () => {
    expect(parseBoardQuery({ status: ["shipped", "open"], q: "   " })).toMatchObject({
      status: "shipped",
      q: undefined,
    });
  });
});

describe("boardHref", () => {
  const base = parseBoardQuery({});

  it("leaves defaults out of the URL", () => {
    expect(boardHref("/acme/product", base)).toBe("/acme/product");
  });

  it("combines filters and keeps the rest when patching one", () => {
    const current = parseBoardQuery({ status: "planned", tag: "t1" });
    expect(boardHref("/acme/product", current, { sort: "newest" })).toBe(
      "/acme/product?sort=newest&status=planned&tag=t1",
    );
    expect(boardHref("/acme/product", current, { status: null })).toBe("/acme/product?tag=t1");
  });

  it("encodes the search text", () => {
    expect(boardHref("/a/b", base, { q: "dark & light" })).toBe("/a/b?q=dark+%26+light");
  });
});

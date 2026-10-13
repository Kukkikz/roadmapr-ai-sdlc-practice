import { describe, expect, it } from "vitest";
import { boardMetadata, ideaMetadata, summarize } from "@/lib/seo";

const team = { name: "Acme" };

describe("summarize", () => {
  it("returns null for empty or blank text", () => {
    expect(summarize(null)).toBeNull();
    expect(summarize("  \n ")).toBeNull();
  });

  it("collapses whitespace and keeps short text whole", () => {
    expect(summarize("Dark   mode\nplease")).toBe("Dark mode please");
  });

  it("cuts long text at a word boundary with an ellipsis, within the limit", () => {
    const out = summarize("word ".repeat(100))!;
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\swor…$/);
  });
});

describe("boardMetadata (NF4)", () => {
  it("gives a public Board a title, description and Open Graph tags, and no robots rule", () => {
    const meta = boardMetadata(team, {
      name: "Sandbox",
      description: "Try it",
      visibility: "public",
    });
    expect(meta.title).toBe("Sandbox · Acme");
    expect(meta.description).toBe("Try it");
    expect(meta.openGraph).toMatchObject({ title: "Sandbox · Acme", description: "Try it" });
    expect(meta.robots).toBeUndefined();
  });

  it("falls back to a generated description when the Board has none", () => {
    const meta = boardMetadata(team, { name: "Sandbox", description: null, visibility: "public" });
    expect(meta.description).toContain("Acme");
  });

  it("marks a Private Board noindex", () => {
    const meta = boardMetadata(team, { name: "Beta", description: null, visibility: "private" });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("titles the roadmap page", () => {
    const meta = boardMetadata(
      team,
      { name: "Sandbox", description: null, visibility: "public" },
      "Roadmap",
    );
    expect(meta.title).toBe("Roadmap · Sandbox · Acme");
  });
});

describe("ideaMetadata (NF4)", () => {
  it("uses the Idea title and a trimmed description", () => {
    const meta = ideaMetadata(
      team,
      { name: "Sandbox", visibility: "public" },
      { title: "Dark mode", description: "x ".repeat(200) },
    );
    expect(meta.title).toBe("Dark mode · Sandbox · Acme");
    expect(String(meta.description).length).toBeLessThanOrEqual(160);
    expect(meta.robots).toBeUndefined();
  });

  it("is noindex on a Private Board", () => {
    const meta = ideaMetadata(
      team,
      { name: "Beta", visibility: "private" },
      { title: "Secret", description: null },
    );
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});

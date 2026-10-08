import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// DESIGN.md is the source of truth for UI tokens. These tests fail when the colours or
// radii in src/app/globals.css drift from it, so a styling change must start in DESIGN.md.

const designMd = readFileSync("DESIGN.md", "utf8");
const globalsCss = readFileSync("src/app/globals.css", "utf8");

function designColors(): Record<string, string> {
  const block = designMd.split("\ncolors:\n")[1]?.split(/\n\S/)[0] ?? "";
  const colors: Record<string, string> = {};
  for (const match of block.matchAll(/^ {2}([a-z0-9-]+): "(#[0-9a-fA-F]{6})"/gm)) {
    colors[match[1]] = match[2].toLowerCase();
  }
  return colors;
}

function cssRootVariables(): Record<string, string> {
  const root = globalsCss.split(":root {")[1]?.split("\n}")[0] ?? "";
  const vars: Record<string, string> = {};
  for (const match of root.matchAll(/^\s*--([a-z0-9-]+):\s*([^;]+);/gm)) {
    vars[match[1]] = match[2].trim().toLowerCase();
  }
  return vars;
}

describe("design tokens", () => {
  const colors = designColors();
  const vars = cssRootVariables();

  it("finds the colour tokens in DESIGN.md", () => {
    expect(Object.keys(colors).length).toBeGreaterThan(20);
    expect(colors.primary).toBe("#181d26");
  });

  it("defines every DESIGN.md colour as a CSS variable with the same value", () => {
    const mismatches = Object.entries(colors)
      .filter(([name, hex]) => vars[name] !== hex)
      .map(([name, hex]) => `--${name}: expected ${hex}, found ${vars[name] ?? "missing"}`);
    expect(mismatches).toEqual([]);
  });

  it("uses the 6 / 10 / 12px radii from DESIGN.md", () => {
    expect(designMd).toMatch(/^ {2}sm: 6px$/m);
    expect(designMd).toMatch(/^ {2}md: 10px$/m);
    expect(designMd).toMatch(/^ {2}lg: 12px$/m);
    expect(globalsCss).toMatch(/--radius-sm:\s*6px/);
    expect(globalsCss).toMatch(/--radius-md:\s*10px/);
    expect(globalsCss).toMatch(/--radius-lg:\s*12px/);
  });
});

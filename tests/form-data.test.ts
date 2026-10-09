import { describe, expect, it } from "vitest";
import { formText, honeypotValue } from "@/lib/form-data";

describe("formText", () => {
  it("returns text and undefined for missing or non-text parts", () => {
    const form = new FormData();
    form.set("title", "Hello");
    form.set("upload", new File(["x"], "x.txt"));
    expect(formText(form, "title")).toBe("Hello");
    expect(formText(form, "missing")).toBeUndefined();
    expect(formText(form, "upload")).toBeUndefined();
  });
});

describe("honeypotValue", () => {
  it("is undefined when the field is absent and empty when left empty", () => {
    expect(honeypotValue(new FormData())).toBeUndefined();
    const form = new FormData();
    form.set("website", "");
    expect(honeypotValue(form)?.trim() ?? "").toBe("");
  });

  it("returns the text a bot typed", () => {
    const form = new FormData();
    form.set("website", "http://spam.example");
    expect(honeypotValue(form)).toBe("http://spam.example");
  });

  it("treats a file part as filled, so sending the field as a file does not bypass it", () => {
    const form = new FormData();
    form.set("website", new File(["spam"], "spam.txt"));
    expect(honeypotValue(form)?.trim()).toBeTruthy();
  });
});

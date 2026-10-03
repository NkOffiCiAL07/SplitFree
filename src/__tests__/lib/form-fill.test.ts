import { describe, it, expect } from "vitest";
import { fieldScore, formProgress, fillMood, fillCaption } from "@/lib/form-fill";

describe("fieldScore", () => {
  it("email: grows while typing but is only FULL once it is a real address", () => {
    expect(fieldScore({ kind: "email", value: "" })).toBe(0);
    expect(fieldScore({ kind: "email", value: undefined })).toBe(0);
    const partial = fieldScore({ kind: "email", value: "nishant" });
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(1);
    expect(fieldScore({ kind: "email", value: "averyveryverylongtextwithoutatsign" })).toBeLessThan(1); // long ≠ valid
    expect(fieldScore({ kind: "email", value: "a@b" })).toBeLessThan(1);
    expect(fieldScore({ kind: "email", value: " me@example.com " })).toBe(1);
  });

  it("password: proportional to length, full at the minimum, never above 1", () => {
    expect(fieldScore({ kind: "password", value: "abcd", min: 8 })).toBe(0.5);
    expect(fieldScore({ kind: "password", value: "abcdefgh", min: 8 })).toBe(1);
    expect(fieldScore({ kind: "password", value: "x".repeat(60), min: 8 })).toBe(1);
    expect(fieldScore({ kind: "password", value: "abcdef", min: 6 })).toBe(1);
    expect(fieldScore({ kind: "password", value: "abcd" })).toBe(0.5); // default minimum 8
  });

  it("name: full from two characters, spaces don't count", () => {
    expect(fieldScore({ kind: "name", value: "A" })).toBe(0.5);
    expect(fieldScore({ kind: "name", value: "  " })).toBe(0);
    expect(fieldScore({ kind: "name", value: "Al" })).toBe(1);
  });
});

describe("formProgress", () => {
  it("averages the fields, from empty to full", () => {
    const f = (email: string, password: string) => formProgress([{ kind: "email", value: email }, { kind: "password", value: password, min: 8 }]);
    expect(f("", "")).toBe(0);
    expect(f("me@example.com", "")).toBe(0.5);
    expect(f("me@example.com", "abcd")).toBe(0.75);
    expect(f("me@example.com", "abcdefgh")).toBe(1);
  });

  it("is never full while any field is incomplete, and handles no fields", () => {
    expect(formProgress([{ kind: "name", value: "Asha" }, { kind: "email", value: "asha@" }, { kind: "password", value: "longenoughpassword" }])).toBeLessThan(1);
    expect(formProgress([])).toBe(0);
  });
});

describe("mood and caption", () => {
  it("empty → filling → full", () => {
    expect([0, 0.3, 0.999, 1].map(fillMood)).toEqual(["empty", "filling", "filling", "full"]);
    expect(fillCaption(0)).toMatch(/start typing/i);
    expect(fillCaption(0.5)).toMatch(/keep going/i);
    expect(fillCaption(1)).toMatch(/full/i);
  });
});

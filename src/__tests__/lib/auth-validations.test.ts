import { describe, it, expect } from "vitest";
import { passwordSchema, signupSchema, loginSchema, updatePasswordSchema } from "@/lib/validations/auth";

const msgs = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues.map((i) => i.message) ?? [];

describe("passwordSchema (shared by signup and reset)", () => {
  it("accepts a password with 8+ chars, an uppercase letter and a digit", () => {
    expect(passwordSchema.safeParse("Passw0rdX").success).toBe(true);
    expect(passwordSchema.safeParse("A1aaaaaa").success).toBe(true); // exactly 8
  });

  it.each([
    ["short1A", /at least 8/],
    ["alllowercase1", /uppercase/],
    ["NoDigitsHere", /number/],
    ["", /at least 8/],
  ])("rejects %j", (pw, message) => {
    const r = passwordSchema.safeParse(pw);
    expect(r.success).toBe(false);
    expect(msgs(r).join("|")).toMatch(message);
  });
});

describe("signupSchema", () => {
  const ok = { name: "Asha", email: "asha@x.com", password: "Passw0rdX" };
  it("accepts valid details", () => expect(signupSchema.safeParse(ok).success).toBe(true));
  it("validates each field", () => {
    expect(signupSchema.safeParse({ ...ok, name: "A" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...ok, name: "x".repeat(81) }).success).toBe(false);
    expect(signupSchema.safeParse({ ...ok, email: "nope" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...ok, password: "weakpass" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("only needs a valid email and 6+ characters (existing accounts may predate the stronger rule)", () => {
    expect(loginSchema.safeParse({ email: "a@x.com", password: "abcdef" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@x.com", password: "abc" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a", password: "abcdef" }).success).toBe(false);
  });
});

describe("updatePasswordSchema (reset can't weaken the policy)", () => {
  it("enforces the same strength rules as signup — it used to accept any 8 characters", () => {
    expect(updatePasswordSchema.safeParse({ password: "alllowercase", confirm: "alllowercase" }).success).toBe(false);
    expect(updatePasswordSchema.safeParse({ password: "Passw0rdX", confirm: "Passw0rdX" }).success).toBe(true);
  });
  it("requires both fields to match and reports it on the confirm field", () => {
    const r = updatePasswordSchema.safeParse({ password: "Passw0rdX", confirm: "Passw0rdY" });
    expect(r.success).toBe(false);
    expect((r as { error: { issues: { path: string[] }[] } }).error.issues[0].path).toEqual(["confirm"]);
  });
});

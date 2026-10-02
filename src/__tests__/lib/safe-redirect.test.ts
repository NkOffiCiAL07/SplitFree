import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { safeRedirectPath } from "@/lib/api-helpers";

describe("safeRedirectPath (open-redirect guard)", () => {
  it("allows in-app paths, including query strings and hashes", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/groups/abc?tab=1#x")).toBe("/groups/abc?tab=1#x");
    expect(safeRedirectPath("/reset-password/update")).toBe("/reset-password/update");
  });

  it("falls back for empty or missing values", () => {
    expect(safeRedirectPath(null)).toBe("/dashboard");
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
    expect(safeRedirectPath("")).toBe("/dashboard");
    expect(safeRedirectPath(null, "/home")).toBe("/home");
  });

  it.each([
    ["@evil.com", "userinfo trick: https://app.com@evil.com"],
    ["//evil.com", "protocol-relative URL"],
    ["///evil.com", "triple slash"],
    ["https://evil.com", "absolute URL"],
    ["http://evil.com/path", "absolute http URL"],
    ["javascript:alert(1)", "javascript scheme"],
    ["\\evil.com", "backslash"],
    ["/\\evil.com", "slash + backslash (browsers treat it as //)"],
    ["/path\r\nSet-Cookie: x=1", "header injection"],
    ["evil.com", "no leading slash"],
  ])("rejects %s (%s)", (input) => {
    expect(safeRedirectPath(input)).toBe("/dashboard");
  });
});

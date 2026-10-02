import { describe, it, expect } from "vitest";
import { buildUpiLink, isValidUpiId, formatSettlePlan } from "@/lib/settle-tools";

describe("isValidUpiId", () => {
  it("accepts typical handles and rejects junk", () => {
    expect(isValidUpiId("rahul@okhdfcbank")).toBe(true);
    expect(isValidUpiId("rahul.k-1@ybl")).toBe(true);
    expect(isValidUpiId("rahul")).toBe(false);
    expect(isValidUpiId("@ybl")).toBe(false);
    expect(isValidUpiId("a b@ybl")).toBe(false);
  });
});

describe("buildUpiLink", () => {
  it("builds a upi://pay link with a decimal rupee amount", () => {
    const link = buildUpiLink({ vpa: "rahul@ybl", name: "Rahul K", amountCents: 50050, note: "Dinner" })!;
    const url = new URL(link);
    expect(url.protocol).toBe("upi:");
    expect(url.searchParams.get("pa")).toBe("rahul@ybl");
    expect(url.searchParams.get("am")).toBe("500.50");
    expect(url.searchParams.get("cu")).toBe("INR");
    expect(url.searchParams.get("pn")).toBe("Rahul K");
    expect(url.searchParams.get("tn")).toBe("Dinner");
  });
  it("returns null for invalid ids or non-positive amounts", () => {
    expect(buildUpiLink({ vpa: "nope", amountCents: 100 })).toBeNull();
    expect(buildUpiLink({ vpa: "a@ybl", amountCents: 0 })).toBeNull();
  });
});

describe("formatSettlePlan", () => {
  it("says everyone is settled when there are no debts", () => {
    expect(formatSettlePlan([])).toContain("settled up");
  });
  it("lists each payment and names the current user as You", () => {
    const text = formatSettlePlan(
      [{ fromUserId: "me", toUserId: "p", amount: 1000, currency: "USD", toUser: { id: "p", name: "Priya", avatarUrl: null } }],
      "me"
    );
    expect(text).toContain("1 payment");
    expect(text).toContain("You → Priya");
    expect(text).toContain("$10.00");
  });
});

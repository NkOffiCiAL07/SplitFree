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

import { buildUpiAppLinks } from "@/lib/settle-tools";
describe("buildUpiAppLinks (iPhone has no UPI chooser, so each app gets its own link)", () => {
  const links = buildUpiAppLinks({ vpa: "asha@okhdfc", name: "Asha Rao", amountCents: 123456, note: "Goa trip" })!;
  it("gives Google Pay, PhonePe, Paytm and a generic fallback in that order", () => {
    expect(links.map((l) => l.id)).toEqual(["gpay", "phonepe", "paytm", "upi"]);
    expect(links.map((l) => new URL(l.url).protocol)).toEqual(["gpay:", "phonepe:", "paytmmp:", "upi:"]);
  });
  it("carries identical payee, amount, currency and note in every link", () => {
    for (const l of links) {
      const q = new URL(l.url).searchParams;
      expect([q.get("pa"), q.get("pn"), q.get("am"), q.get("cu"), q.get("tn")]).toEqual(["asha@okhdfc", "Asha Rao", "1234.56", "INR", "Goa trip"]);
    }
  });
  it("refuses an invalid ID or a zero amount, like the single link", () => {
    expect(buildUpiAppLinks({ vpa: "nope", amountCents: 100 })).toBeNull();
    expect(buildUpiAppLinks({ vpa: "a@okhdfc", amountCents: 0 })).toBeNull();
  });
});

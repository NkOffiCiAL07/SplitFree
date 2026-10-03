import { describe, it, expect } from "vitest";
import { buildGroupInviteMessage, buildInviteMessage, buildReminderMessage, whatsappShareUrl } from "@/lib/invite";

describe("WhatsApp messages", () => {
  it("builds a wa.me link with the text safely encoded", () => {
    const url = whatsappShareUrl("Hi & bye? 100% ₹5");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(new URL(url).searchParams.get("text")).toBe("Hi & bye? 100% ₹5");
  });

  it("group invite names the group, the inviter and carries the link", () => {
    const m = buildGroupInviteMessage("Goa Trip", "https://x.app/join/abc", "Nishant");
    expect(m).toContain("Nishant added you to \"Goa Trip\"");
    expect(m).toContain("https://x.app/join/abc");
    expect(buildGroupInviteMessage("Goa Trip", "https://x/j")).toMatch(/^Join "Goa Trip"/);
  });

  it("general invite still works", () => {
    expect(buildInviteMessage("https://x", "Asha")).toContain("Asha invited you");
  });

  it("reminder is specific and polite, and gives the UPI ID for rupee debts", () => {
    const m = buildReminderMessage({ debtorName: "Bhanu Pal", amountLabel: "₹200.00", currency: "INR", upiId: " me@okaxis " });
    expect(m).toContain("Hi Bhanu!");
    expect(m).toContain("you owe me ₹200.00");
    expect(m).toContain("UPI: me@okaxis");
    expect(m).toContain("Thanks");
  });

  it("no UPI line for other currencies, or when none is saved; optional note and name", () => {
    expect(buildReminderMessage({ debtorName: "A", amountLabel: "$5.00", currency: "USD", upiId: "me@okaxis" })).not.toMatch(/UPI/);
    expect(buildReminderMessage({ amountLabel: "₹5.00", currency: "INR", upiId: "" })).not.toMatch(/UPI/);
    expect(buildReminderMessage({ amountLabel: "₹5.00", currency: "INR" })).toMatch(/^Hi!/);
    expect(buildReminderMessage({ amountLabel: "₹5.00", currency: "INR", note: "the Goa trip" })).toContain("for the Goa trip");
  });
});

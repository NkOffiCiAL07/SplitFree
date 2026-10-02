import { describe, it, expect } from "vitest";
import { buildInviteMessage, whatsappShareUrl } from "@/lib/invite";

describe("buildInviteMessage", () => {
  it("includes the link and names the inviter when known", () => {
    const msg = buildInviteMessage("https://app.example/signup", "Nishant", "Splitr Pro");
    expect(msg).toContain("Nishant invited you to Splitr Pro");
    expect(msg).toContain("https://app.example/signup");
  });
  it("falls back to a generic invitation without a name", () => {
    expect(buildInviteMessage("https://x.y", undefined, "Splitr Pro")).toMatch(/^Join me on Splitr Pro/);
  });
});

describe("whatsappShareUrl", () => {
  it("builds a wa.me link with the text safely encoded", () => {
    const url = whatsappShareUrl("Hi & welcome? 100% free");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1])).toBe("Hi & welcome? 100% free");
    expect(url).not.toContain(" ");
  });
});

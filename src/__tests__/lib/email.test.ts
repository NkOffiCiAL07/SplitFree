import { describe, it, expect, vi, afterEach } from "vitest";
import { renderEmail, sendEmail, emailConfigured } from "@/lib/email";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("renderEmail", () => {
  it("escapes HTML in user-controlled text (names/descriptions)", () => {
    const html = renderEmail({ title: "<b>Hi</b>", text: 'Asha "<script>alert(1)</script>"', ctaUrl: "https://x.y/?a=1&b=2" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;Hi&lt;/b&gt;");
    expect(html).toContain("a=1&amp;b=2");
  });
  it("includes the call to action", () => {
    expect(renderEmail({ title: "t", text: "x", ctaUrl: "https://app/settle", appName: "Splitr Pro" })).toContain('href="https://app/settle"');
  });
});

describe("sendEmail", () => {
  it("is inert without an API key", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(emailConfigured()).toBe(false);
    expect(await sendEmail({ to: "a@x.com", subject: "s", text: "t", ctaPath: "/settle" })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to Resend with the key, sender and a deep link", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_123");
    vi.stubEnv("EMAIL_FROM", "Splitr <hi@example.com>");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendEmail({ to: "a@x.com", subject: "Reminder", text: "Pay up", ctaPath: "/settle" })).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer re_123" });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ from: "Splitr <hi@example.com>", to: ["a@x.com"], subject: "Reminder" });
    expect(body.text).toContain("https://app.example/settle");
  });

  it("returns false (and never throws) when the API fails or the network is down", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_123");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await sendEmail({ to: "a@x.com", subject: "s", text: "t", ctaPath: "/" })).toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await sendEmail({ to: "a@x.com", subject: "s", text: "t", ctaPath: "/" })).toBe(false);
  });
});

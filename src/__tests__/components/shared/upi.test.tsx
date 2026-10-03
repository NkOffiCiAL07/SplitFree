import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { useProfile, toast } = vi.hoisted(() => ({ useProfile: vi.fn(), toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => useProfile() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("sonner", () => ({ toast }));

import { UpiPayLink } from "@/components/shared/upi-pay-link";
import { UpiSettings } from "@/components/settings/upi-settings";

describe("UpiPayLink", () => {
  it("links to a upi://pay URL with payee and exact amount for rupee debts", () => {
    render(<UpiPayLink vpa="asha@okhdfc" payeeName="Asha Rao" amountCents={123456} currency="INR" note="Goa trip" />);
    const link = screen.getByRole("link", { name: /pay asha rao via upi/i });
    const url = new URL(link.getAttribute("href")!);
    expect(url.protocol).toBe("upi:");
    expect(url.searchParams.get("pa")).toBe("asha@okhdfc");
    expect(url.searchParams.get("am")).toBe("1234.56");
    expect(url.searchParams.get("cu")).toBe("INR");
    expect(url.searchParams.get("tn")).toBe("Goa trip");
  });

  it("renders nothing for non-rupee amounts, missing or invalid UPI IDs, or zero amounts", () => {
    const { container, rerender } = render(<UpiPayLink vpa="asha@okhdfc" amountCents={100} currency="USD" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<UpiPayLink vpa={null} amountCents={100} currency="INR" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<UpiPayLink vpa="not-valid" amountCents={100} currency="INR" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<UpiPayLink vpa="asha@okhdfc" amountCents={0} currency="INR" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("UpiPayLink — iPhone vs Android", () => {
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
  const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";
  const ua = (v: string, touch = 0) => { vi.spyOn(navigator, "userAgent", "get").mockReturnValue(v); Object.defineProperty(navigator, "maxTouchPoints", { value: touch, configurable: true }); };
  afterEach(() => vi.restoreAllMocks());

  it("Android keeps the single link (the system shows your UPI apps)", () => {
    ua(ANDROID, 5);
    render(<UpiPayLink vpa="asha@okhdfc" payeeName="Asha Rao" amountCents={50000} currency="INR" />);
    expect(screen.getByRole("link", { name: /pay asha rao via upi/i }).getAttribute("href")).toMatch(/^upi:\/\/pay\?/);
  });

  it("iPhone gets a menu with each app's own link — same payee and exact amount — plus 'Copy UPI ID'", async () => {
    ua(IPHONE, 5);
    render(<UpiPayLink vpa="asha@okhdfc" payeeName="Asha Rao" amountCents={123456} currency="INR" note="Goa trip" />);
    expect(screen.queryByRole("link", { name: /via upi/i })).not.toBeInTheDocument(); // not a bare link that does nothing on iOS
    await userEvent.click(screen.getByRole("button", { name: /pay asha rao via upi/i }));
    const hrefOf = (name: string) => screen.getByRole("menuitem", { name }).getAttribute("href")!;
    const gpay = new URL(hrefOf("Google Pay")), phonepe = new URL(hrefOf("PhonePe")), paytm = new URL(hrefOf("Paytm"));
    expect([gpay.protocol, phonepe.protocol, paytm.protocol]).toEqual(["gpay:", "phonepe:", "paytmmp:"]);
    for (const u of [gpay, phonepe, paytm]) {
      expect(u.searchParams.get("pa")).toBe("asha@okhdfc");
      expect(u.searchParams.get("am")).toBe("1234.56");
      expect(u.searchParams.get("cu")).toBe("INR");
      expect(u.searchParams.get("tn")).toBe("Goa trip");
    }
    expect(hrefOf("Other UPI app")).toMatch(/^upi:\/\/pay\?/);
    expect(screen.getByRole("menuitem", { name: /copy upi id/i })).toBeInTheDocument();
  });

  it("copying the UPI ID works, and falls back to showing it when the clipboard is blocked", async () => {
    ua(IPHONE, 5);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<UpiPayLink vpa=" asha@okhdfc " amountCents={100} currency="INR" />);
    await userEvent.click(screen.getByRole("button", { name: /via upi/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: /copy upi id/i }));
    expect(writeText).toHaveBeenCalledWith("asha@okhdfc");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("UPI ID copied"));

    writeText.mockRejectedValue(new Error("denied"));
    await userEvent.click(screen.getByRole("button", { name: /via upi/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: /copy upi id/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("UPI ID: asha@okhdfc"));
  });

  it("iPhone still renders nothing for dollar amounts or invalid IDs", () => {
    ua(IPHONE, 5);
    const { container } = render(<UpiPayLink vpa="asha@okhdfc" amountCents={100} currency="USD" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("UpiSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProfile.mockReturnValue({ data: { upiId: null } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ data: {} }) }));
  });

  it("starts empty with Save disabled until something valid is typed", async () => {
    render(<UpiSettings />);
    const input = screen.getByLabelText(/your upi id/i);
    expect(input).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await userEvent.type(input, "nishant@okaxis");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("shows the saved ID and disables Save until it changes", async () => {
    useProfile.mockReturnValue({ data: { upiId: "me@ybl" } });
    render(<UpiSettings />);
    expect(screen.getByLabelText(/your upi id/i)).toHaveValue("me@ybl");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/your upi id/i), "x");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("flags an invalid ID and blocks saving it", async () => {
    render(<UpiSettings />);
    await userEvent.type(screen.getByLabelText(/your upi id/i), "nope");
    expect(screen.getByText(/enter a valid upi id/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("saves the trimmed ID to the profile", async () => {
    render(<UpiSettings />);
    await userEvent.type(screen.getByLabelText(/your upi id/i), "  me@ybl  ");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/profile");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ upiId: "me@ybl" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("UPI ID saved"));
  });

  it("clearing the field removes the saved ID", async () => {
    useProfile.mockReturnValue({ data: { upiId: "me@ybl" } });
    render(<UpiSettings />);
    await userEvent.clear(screen.getByLabelText(/your upi id/i));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)).toEqual({ upiId: "" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("UPI ID removed"));
  });

  it("reports server errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ error: { message: "nope" } }) }));
    render(<UpiSettings />);
    await userEvent.type(screen.getByLabelText(/your upi id/i), "me@ybl");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("nope"));
  });

  it("is disabled until the profile has loaded", () => {
    useProfile.mockReturnValue({ data: undefined });
    render(<UpiSettings />);
    expect(screen.getByLabelText(/your upi id/i)).toBeDisabled();
  });
});

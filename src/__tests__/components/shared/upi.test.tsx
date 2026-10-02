import { describe, it, expect, vi, beforeEach } from "vitest";
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

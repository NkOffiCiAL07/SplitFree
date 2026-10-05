import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({ profile: undefined as unknown, toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: h.profile }) }));
vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/lib/region", () => ({ browserCountry: () => "IN" })); // (the real one depends on the machine's time zone and language)

import { PhonePrompt } from "@/components/auth/phone-prompt";
import { PhoneSettings } from "@/components/settings/phone-settings";
import { mustAddPhone, PHONE_REQUIRED_SINCE } from "@/lib/phone";

const NEW = "2026-10-06T10:00:00Z";
const OLD = "2026-09-01T10:00:00Z";
const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  h.profile = undefined;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ data: {}, error: null }) }));
});

describe("mustAddPhone", () => {
  it("is true only for a NEW account with no number saved yet", () => {
    expect(mustAddPhone({ phone: null, createdAt: NEW })).toBe(true);
    expect(mustAddPhone({ phone: "+919876543210", createdAt: NEW })).toBe(false);
    expect(mustAddPhone({ phone: null, createdAt: OLD })).toBe(false); // older accounts are only asked in Settings
    expect(mustAddPhone({ phone: null, createdAt: PHONE_REQUIRED_SINCE })).toBe(true);
    expect(mustAddPhone(undefined)).toBe(false); // profile still loading
    expect(mustAddPhone({ phone: null })).toBe(false);
  });
});

describe("PhonePrompt (Google sign-ups skip the sign-up form)", () => {
  it("shows nothing while loading, for older accounts, and once a number is saved", () => {
    for (const profile of [undefined, { phone: null, createdAt: OLD }, { phone: "+919876543210", createdAt: NEW }]) {
      h.profile = profile;
      const { unmount } = wrap(<PhonePrompt />);
      expect(screen.queryByTestId("phone-prompt")).toBeNull();
      unmount();
    }
  });

  it("blocks a new account without a number: no close button, and Escape does not dismiss it", async () => {
    h.profile = { phone: null, createdAt: NEW };
    wrap(<PhonePrompt />);
    expect(await screen.findByText("One last step")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /close/i })).toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("One last step")).toBeInTheDocument();
  });

  it("won't continue until the number is valid, and says why", async () => {
    h.profile = { phone: null, createdAt: NEW };
    wrap(<PhonePrompt />);
    const btn = await screen.findByRole("button", { name: /continue/i });
    expect(btn).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Mobile number"), "12345");
    expect(await screen.findByRole("alert")).toHaveTextContent(/valid mobile number/i);
    expect(btn).toBeDisabled();
  });

  it("saves the number in international format and confirms", async () => {
    h.profile = { phone: null, createdAt: NEW };
    wrap(<PhonePrompt />);
    await userEvent.type(await screen.findByLabelText("Mobile number"), "98765 43210");
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/profile", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ phone: "+919876543210" }) })));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalled());
  });

  it("shows the server's message if saving fails, and stays open", async () => {
    h.profile = { phone: null, createdAt: NEW };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ data: null, error: { message: "Enter a valid mobile number" } }) }));
    wrap(<PhonePrompt />);
    await userEvent.type(await screen.findByLabelText("Mobile number"), "9876543210");
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("Enter a valid mobile number"));
    expect(screen.getByText("One last step")).toBeInTheDocument();
  });
});

describe("country code picker", () => {
  it("lets a Google sign-up from another country pick theirs, and sends the number with that code", async () => {
    h.profile = { phone: null, createdAt: NEW };
    wrap(<PhonePrompt />);
    await userEvent.selectOptions(await screen.findByLabelText("Country code"), "GB");
    await userEvent.type(screen.getByLabelText("Mobile number"), "07911 123456");
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/profile", expect.objectContaining({ body: JSON.stringify({ phone: "+447911123456" }) })));
  });

  it("changing the country re-reads what was already typed", async () => {
    h.profile = { phone: null, createdAt: NEW };
    wrap(<PhonePrompt />);
    await userEvent.type(await screen.findByLabelText("Mobile number"), "415 555 2671"); // not an Indian mobile
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText("Country code"), "US");
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });

  it("a number typed with + wins over the picker", async () => {
    h.profile = { phone: null, createdAt: NEW };
    wrap(<PhonePrompt />);
    await userEvent.type(await screen.findByLabelText("Mobile number"), "+44 7911 123456");
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/profile", expect.objectContaining({ body: JSON.stringify({ phone: "+447911123456" }) })));
  });

  it("lists every country with its flag and code, India first", async () => {
    h.profile = { phone: null, createdAt: NEW };
    wrap(<PhonePrompt />);
    const options = Array.from((await screen.findByLabelText("Country code")).querySelectorAll("option")).map((o) => o.textContent);
    expect(options[0]).toBe("🇮🇳 India (+91)");
    expect(options).toContain("🇺🇸 United States (+1)");
    expect(options).toContain("🇬🇧 United Kingdom (+44)");
    expect(options.length).toBeGreaterThan(40);
  });
});

describe("PhoneSettings", () => {
  it("shows the saved number nicely grouped, and Save stays off until it changes to a valid one", async () => {
    h.profile = { phone: "+919876543210", createdAt: OLD };
    wrap(<PhoneSettings />);
    const input = screen.getByLabelText("Mobile number") as HTMLInputElement;
    expect(input.value).toBe("98765 43210");
    expect(screen.getByLabelText("Country code")).toHaveValue("IN"); // 🇮🇳 +91
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, "99999 11111");
    expect(save).toBeEnabled();
    await userEvent.clear(input);
    await userEvent.type(input, "99");
    expect(screen.getByText(/valid mobile number/i)).toBeInTheDocument();
    expect(save).toBeDisabled();
  });

  it("an older account with no number can add one from Settings", async () => {
    h.profile = { phone: null, createdAt: OLD };
    wrap(<PhoneSettings />);
    await userEvent.type(screen.getByLabelText("Mobile number"), "9876543210");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/profile", expect.objectContaining({ body: JSON.stringify({ phone: "+919876543210" }) })));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith("Mobile number saved"));
  });
});

describe("PhoneField country suggestion (it arrives after hydration)", () => {
  it("follows a changed suggestion until the person touches it, then never overrides their choice", async () => {
    const { PhoneField } = await import("@/components/ui/phone-field");
    const { rerender } = render(<PhoneField id="f" defaultCountry="IN" onChange={() => {}} />);
    expect(screen.getByLabelText("Country code")).toHaveValue("IN");
    rerender(<PhoneField id="f" defaultCountry="GB" onChange={() => {}} />); // the browser's guess arrives
    expect(screen.getByLabelText("Country code")).toHaveValue("GB");
    await userEvent.selectOptions(screen.getByLabelText("Country code"), "US"); // the person chooses
    rerender(<PhoneField id="f" defaultCountry="DE" onChange={() => {}} />);
    expect(screen.getByLabelText("Country code")).toHaveValue("US");
  });

  it("a saved number always wins over a suggestion", async () => {
    const { PhoneField } = await import("@/components/ui/phone-field");
    const { rerender } = render(<PhoneField id="f" initial="+919876543210" defaultCountry="IN" onChange={() => {}} />);
    rerender(<PhoneField id="f" initial="+919876543210" defaultCountry="GB" onChange={() => {}} />);
    expect(screen.getByLabelText("Country code")).toHaveValue("IN");
  });
});

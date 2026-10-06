import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/dynamic", () => ({ default: () => (p: { value: string }) => <svg data-testid="qr" data-value={p.value} /> }));

import { IosNotify } from "@/components/landing/ios-notify";
import { SplitTryout } from "@/components/landing/split-tryout";
import { PhoneDemo } from "@/components/landing/phone-demo";
import { SettleFlow } from "@/components/landing/settle-flow";
import { SplitwiseBanner } from "@/components/landing/splitwise-banner";

beforeEach(() => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { joined: true }, error: null }) })); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("IosNotify — a real way to be told when iPhone launches", () => {
  it("sends the email and thanks the person", async () => {
    render(<IosNotify />);
    await userEvent.type(screen.getByLabelText("Your email"), "asha@example.com");
    await userEvent.click(screen.getByRole("button", { name: /notify me/i }));
    await waitFor(() => expect(screen.getByTestId("ios-notify-done")).toHaveTextContent(/on the list/i));
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/waitlist");
    expect(JSON.parse(init.body)).toEqual({ email: "asha@example.com", website: "" });
  });

  it("shows the server's message when it fails, and lets the person try again", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, json: async () => ({ data: null, error: { message: "Too many requests — please try again later" } }) });
    render(<IosNotify />);
    await userEvent.type(screen.getByLabelText("Your email"), "asha@example.com");
    await userEvent.click(screen.getByRole("button", { name: /notify me/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/too many requests/i);
    await userEvent.click(screen.getByRole("button", { name: /notify me/i }));
    await waitFor(() => expect(screen.getByTestId("ios-notify-done")).toBeInTheDocument());
  });

  it("survives the network being down", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<IosNotify />);
    await userEvent.type(screen.getByLabelText("Your email"), "a@example.com");
    await userEvent.click(screen.getByRole("button", { name: /notify me/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("has a hidden field real people never fill (bots do), and needs an email address to submit", () => {
    render(<IosNotify />);
    expect(document.querySelector("input[name=website]")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByLabelText("Your email")).toBeRequired();
  });
});

describe("SplitTryout — the live bill splitter", () => {
  const shares = () => within(screen.getByRole("list", { name: /each person's share/i })).getAllByRole("listitem").map((li) => li.textContent ?? "");

  it("starts with a sensible example and the shares add up exactly", () => {
    render(<SplitTryout symbol="₹" defaultAmount="2400" />);
    expect(shares()).toHaveLength(4);
    expect(shares().every((t) => /₹600/.test(t))).toBe(true);
    expect(screen.getByText(/Adds up to exactly/)).toHaveTextContent("₹2,400");
  });

  it("uses the app's own maths: 100 between 3 is 33.34 / 33.33 / 33.33", async () => {
    render(<SplitTryout symbol="$" defaultAmount="100" currency="USD" />);
    await userEvent.click(screen.getByRole("button", { name: /fewer people/i })); // 4 → 3
    const got = shares().map((t) => /\$(\d+\.\d\d)/.exec(t)?.[1]);
    expect(got).toEqual(["33.34", "33.33", "33.33"]);
    expect(got.reduce((s, v) => s + Math.round(parseFloat(v!) * 100), 0)).toBe(10000);
  });

  it("can have 2 to 10 friends, no fewer and no more", async () => {
    render(<SplitTryout />);
    for (let i = 0; i < 12; i++) await userEvent.click(screen.getByRole("button", { name: /more people/i }));
    expect(shares()).toHaveLength(10);
    expect(screen.getByRole("button", { name: /more people/i })).toBeDisabled();
    for (let i = 0; i < 12; i++) await userEvent.click(screen.getByRole("button", { name: /fewer people/i }));
    expect(shares()).toHaveLength(2);
    expect(screen.getByRole("button", { name: /fewer people/i })).toBeDisabled();
  });

  it("accepts only an amount (letters are dropped), and says so when there is nothing to split", async () => {
    render(<SplitTryout defaultAmount="" />);
    expect(screen.getByText(/type an amount/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Bill total"), "1a2b0");
    expect(screen.getByLabelText("Bill total")).toHaveValue("120");
    expect(shares().length).toBeGreaterThan(0);
  });
});

describe("PhoneDemo — the phone screen changes with the tabs", () => {
  const sample = {
    owed: "₹1,190", owe: "₹1,200", received: "₹850 · UPI", trip: "Goa trip", payChip: "UPI",
    people: [{ name: "Himanshu", note: "you owe", amount: "₹1,200", tone: "text-red-600", bg: "bg-rose-400" }],
    recent: [{ emoji: "🍔", name: "Dinner", share: "you owe ₹600", tone: "text-red-600", amount: "₹1,800" }],
    payments: [{ from: "Rohan", to: "Ananya", amount: "₹2,400" }, { from: "Kavya", to: "Ananya", amount: "₹1,150" }, { from: "Aditya", to: "Rohan", amount: "₹600" }],
    bill: { title: "Dinner at Barbeque Nation", total: "₹1,800", shares: [{ name: "You", amount: "₹600" }, { name: "Divyansh", amount: "₹600" }] },
  };

  it("has three real tabs; Balances first, with the names visible (they used to inherit white text on a white screen)", () => {
    render(<PhoneDemo s={sample} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Balances", "Settle up", "Split a bill"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Himanshu")).toBeInTheDocument();
    expect(screen.getByText("Himanshu").closest(".text-foreground")).not.toBeNull(); // the screen sets its own text colour
  });

  it("clicking Settle up shows the simplified payments; Split a bill shows the equal split", async () => {
    render(<PhoneDemo s={sample} />);
    await userEvent.click(screen.getByRole("tab", { name: "Settle up" }));
    expect(screen.getByText(/3 payments/)).toBeInTheDocument();
    expect(screen.getAllByText("Rohan").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("tab", { name: "Split a bill" }));
    expect(screen.getByText("Dinner at Barbeque Nation")).toBeInTheDocument();
    expect(screen.getAllByText("₹600")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Split a bill" })).toHaveAttribute("aria-selected", "true");
  });

  it("rotates by itself until someone touches it, then stays where they put it", async () => {
    vi.useFakeTimers();
    render(<PhoneDemo s={sample} />);
    act(() => { vi.advanceTimersByTime(5300); });
    expect(screen.getByRole("tab", { name: "Settle up" })).toHaveAttribute("aria-selected", "true");
    await act(async () => { screen.getByRole("tab", { name: "Balances" }).click(); });
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(screen.getByRole("tab", { name: "Balances" })).toHaveAttribute("aria-selected", "true");
  });

  it("the phone itself is decoration (hidden from screen readers); only the tabs are interactive", () => {
    const { container } = render(<PhoneDemo s={sample} />);
    expect(container.querySelector("[aria-hidden='true'] .rounded-\\[2\\.9rem\\]")).not.toBeNull();
    expect(screen.getByRole("tablist")).toHaveAccessibleName(/see the app in action/i);
  });
});

describe("SettleFlow and SplitwiseBanner", () => {
  it("SettleFlow explains ten payments becoming three, with an accessible description of the diagram", () => {
    render(<SettleFlow />);
    expect(screen.getByRole("heading", { name: /ten payments become three/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/ten payments between five friends become three/i)).toBeInTheDocument();
    expect(document.querySelectorAll(".settle-before line")).toHaveLength(10);
    expect(document.querySelectorAll(".settle-after line")).toHaveLength(3);
  });

  it("SplitwiseBanner is a clear call to bring your history, with the three steps and a way to start", () => {
    render(<SplitwiseBanner />);
    expect(screen.getByRole("heading", { name: /coming from splitwise/i })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    // (one quiet way in: the single Sign in entry — the sign-in page has the Create account tab; no sign-up buttons on the landing page)
    expect(screen.getByRole("link", { name: /sign in and import your history/i })).toHaveAttribute("href", "/login");
  });
});

describe("nothing un-serialisable is handed from the server page to client components", () => {
  it("every prop the landing page gives its client components is plain data (a function/icon there breaks the production build)", async () => {
    const source = (await import("node:fs")).readFileSync("src/components/landing/landing-view.tsx", "utf8");
    // the phone demo must be given an explicit plain-data object, never the whole sample (which holds an icon component)
    expect(source).not.toMatch(/<PhoneDemo\s+s=\{sample\}/);
    expect(source).toMatch(/<PhoneDemo[\s\S]*?s=\{\{ owed: sample\.owed/);
    const { default: Home } = await import("@/app/page");
    const tree = Home() as { props: unknown };
    const seen = new WeakSet<object>();
    const functions: string[] = [];
    const walk = (v: unknown, path: string) => {
      if (typeof v === "function") functions.push(path);
      if (v && typeof v === "object" && !seen.has(v as object)) { seen.add(v as object); for (const [k, x] of Object.entries(v as object)) if (k !== "type" && k !== "_owner" && k !== "_store") walk(x, `${path}.${k}`); }
    };
    // find the element for PhoneDemo in the element tree and check ITS props
    const find = (v: unknown): { props: Record<string, unknown> } | null => {
      if (!v || typeof v !== "object") return null;
      const el = v as { type?: { name?: string }; props?: Record<string, unknown> };
      if (typeof el.type === "function" && el.type.name === "LandingView") return find((el.type as unknown as (p: unknown) => unknown)(el.props));
      if (typeof el.type === "function" && el.type.name === "PhoneDemo") return el as { props: Record<string, unknown> };
      for (const x of Object.values(el.props ?? {})) { const hit = Array.isArray(x) ? x.map(find).find(Boolean) : find(x); if (hit) return hit; }
      return null;
    };
    const demo = find(tree);
    expect(demo).not.toBeNull();
    walk(demo!.props, "PhoneDemo.props");
    expect(functions).toEqual([]);
  });
});

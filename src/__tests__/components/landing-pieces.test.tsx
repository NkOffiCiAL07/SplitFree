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
    expect(screen.getByRole("heading", { name: /ten payments\. three transfers\. done/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/ten payments between five friends become three/i)).toBeInTheDocument();
    const lists = screen.getByTestId("settle-lists"); // the same story in words: five of the ten, then the three that remain, with amounts
    expect(within(lists).getByLabelText("Before: ten payments")).toHaveTextContent("+ 5 more payments");
    expect(within(lists).getByLabelText("After: three payments")).toHaveTextContent("₹2,400");
    expect(within(lists).getAllByRole("listitem").length).toBeGreaterThan(8);
    expect(document.querySelectorAll(".settle-before line")).toHaveLength(10);
    expect(document.querySelectorAll(".settle-after line")).toHaveLength(3);
  });

  it("SplitwiseBanner is a clear call to bring your history, with the three steps and a way to start", () => {
    render(<SplitwiseBanner />);
    expect(screen.getByRole("heading", { name: /switch without starting over/i })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(7); // three steps + what carries over
    expect(within(screen.getByTestId("import-carries")).getAllByRole("listitem").map((l) => l.textContent?.trim())).toEqual(["Groups", "Expenses", "Balances", "Friends"]);
    // (one quiet way in: the single Sign in entry — the sign-in page has the Create account tab; no sign-up buttons on the landing page)
    expect(screen.getByRole("link", { name: /import your history/i })).toHaveAttribute("href", "/login");
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

describe("Feature groups and continuity pill", () => {
  it("the features are four big ideas — Split, Settle, Anywhere, Yours — with the smaller features inside", async () => {
    const { default: Page } = await import("@/app/page");
    render(await Page());
    const groups = screen.getByTestId("feature-groups");
    expect(within(groups).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Split", "Settle", "Anywhere", "Yours"]);
    for (const t of ["Smart settle-up", "Works offline", "Splitwise import", "No ads", "Export or delete anytime", "Percentages"]) expect(groups).toHaveTextContent(t);
  });

  it("the light hero, the offline phone and the glass moment chips are there", async () => {
    const { default: Page } = await import("@/app/page");
    render(await Page());
    expect(screen.getByTestId("hero")).toHaveClass("hero-light", "bg-[#f5f7fb]");
    expect(screen.getByTestId("offline-sync")).toHaveTextContent(/Offline — saved on this phone/);
    expect(screen.getByTestId("offline-sync")).toHaveTextContent(/synced/);
    expect(screen.getByTestId("moments")).toHaveTextContent("₹18,450");
  });

  it("the pill offers the web app and can be dismissed; it only appears after scrolling", async () => {
    const { ContinuityPill } = await import("@/components/landing/continuity-pill");
    const { fireEvent, act } = await import("@testing-library/react");
    render(<ContinuityPill />);
    const pill = screen.getByTestId("continuity-pill");
    expect(pill).toHaveAttribute("aria-hidden", "true");
    Object.defineProperty(window, "scrollY", { value: 900, configurable: true });
    act(() => { fireEvent.scroll(window); });
    expect(pill).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByRole("link", { name: /launch web app/i })).toHaveAttribute("href", "/login");
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByTestId("continuity-pill")).toBeNull();
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });
});

describe("Hero trip card", () => {
  it("the Indian page shows the Goa card with the big 'you get' number (wide screens, by the hero phone)", async () => {
    const { default: Page } = await import("@/app/page");
    render(await Page());
    const card = screen.getByTestId("trip-card");
    expect(card).toHaveTextContent("Goa trip");
    expect(card).toHaveTextContent("₹2,840");
  });

  it("the page is tighter: no highlights marquee, no five-step story, no separate QR section", async () => {
    const { default: Page } = await import("@/app/page");
    const { container } = render(await Page());
    expect(container.querySelector(".lg-marquee")).toBeNull();
    expect(screen.queryByTestId("money-story")).toBeNull();
    expect(container.querySelector("#scan-to-join")).toBeNull();
  });
});

describe("Problem + real-life moments", () => {
  it("shows the group-chat problem and six moments (India flavour on the Indian page, none of it on the English one)", async () => {
    const { default: Page } = await import("@/app/page");
    const { default: Intl } = await import("@/app/intl/page");
    render(await Page());
    expect(within(screen.getByTestId("chat-problem")).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByTestId("moments")).toHaveTextContent("Shaadi kharcha");
    expect(within(screen.getByTestId("moments")).getAllByRole("listitem")).toHaveLength(6);
    document.body.innerHTML = "";
    render(await Intl());
    expect(screen.getByTestId("moments")).toHaveTextContent("Road trips");
    expect(screen.getByTestId("moments").textContent).not.toMatch(/₹|shaadi|chai/i);
    expect(screen.getByTestId("chat-problem").textContent).not.toMatch(/₹|bhai/i);
  });

  it("the settle-up scene now comes before the Android download section", async () => {
    const { default: Page } = await import("@/app/page");
    const { container } = render(await Page());
    const html = container.innerHTML;
    const at = html.indexOf('id="settle-flow-title"');
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(html.indexOf('id="download"'));
  });
});

describe("Mobile menu, use-case amounts and feature pictures", () => {
  it("the hamburger opens a labelled menu with the sections and both ways in, and closes on Escape or a tap", async () => {
    const { MobileMenu } = await import("@/components/landing/mobile-menu");
    render(<MobileMenu links={[{ href: "#product", label: "Product" }, { href: "#features", label: "Features" }]} />);
    const btn = screen.getByRole("button", { name: /open menu/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("mobile-menu")).toBeNull();
    await userEvent.click(btn);
    const menu = screen.getByTestId("mobile-menu");
    expect(within(menu).getByRole("link", { name: "Product" })).toHaveAttribute("href", "#product");
    expect(within(menu).getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(within(menu).getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/signup");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByTestId("mobile-menu")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /open menu/i }));
    await userEvent.click(screen.getByRole("link", { name: "Features" }));
    expect(screen.queryByTestId("mobile-menu")).toBeNull();
  });

  it("the page header links the sections: Product, How it works, Features, Download", async () => {
    const { default: Page } = await import("@/app/page");
    render(await Page());
    const nav = screen.getByRole("navigation", { name: "Sections" });
    expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual(["Product", "How it works", "Features", "Download"]);
    for (const id of ["product", "how-it-works", "features", "download"]) expect(document.getElementById(id), id).not.toBeNull();
  });

  it("each use-case chip shows its amount and group size; each feature group has a picture", async () => {
    const { default: Page } = await import("@/app/page");
    render(await Page());
    expect(screen.getByTestId("moments")).toHaveTextContent("₹18,450 · 4 people");
    expect(screen.getByTestId("moments")).toHaveTextContent("₹420 · 6 people");
    const groups = screen.getByTestId("feature-groups");
    for (const v of ["split", "settle", "anywhere", "yours"]) expect(groups.querySelector(`[data-visual="${v}"]`), v).not.toBeNull();
  });

  it("the pill steps aside near the end of the page (the closing section has its own button)", async () => {
    const { ContinuityPill } = await import("@/components/landing/continuity-pill");
    const { fireEvent, act } = await import("@testing-library/react");
    Object.defineProperty(document.documentElement, "scrollHeight", { value: 6000, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    render(<ContinuityPill />);
    const pill = screen.getByTestId("continuity-pill");
    Object.defineProperty(window, "scrollY", { value: 2000, configurable: true });
    act(() => { fireEvent.scroll(window); });
    expect(pill).toHaveAttribute("aria-hidden", "false");
    Object.defineProperty(window, "scrollY", { value: 5000, configurable: true });
    act(() => { fireEvent.scroll(window); });
    expect(pill).toHaveAttribute("aria-hidden", "true");
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    Object.defineProperty(document.documentElement, "scrollHeight", { value: 0, configurable: true });
  });
});

describe("Split modes and moment cards", () => {
  it("the bill splitter offers Equal, Shares and Percent, always adding up exactly to the bill", async () => {
    render(<SplitTryout symbol="₹" defaultAmount="2400" currency="INR" />);
    const total = (list: HTMLElement) => within(list).getAllByRole("listitem").map((li) => Number((li.textContent ?? "").match(/₹([\d,]+)\s*$/)?.[1].replace(/,/g, "")));
    const list = () => screen.getByRole("list", { name: /each person/i });
    expect(total(list())).toEqual([600, 600, 600, 600]);
    await userEvent.click(screen.getByRole("tab", { name: "Shares" })); // 2 shares for you, 1 for the others: 2400 over 5 portions
    expect(total(list())).toEqual([960, 480, 480, 480]);
    await userEvent.click(screen.getByRole("tab", { name: "Percent" })); // 40% / 20% ×3
    expect(total(list())).toEqual([960, 480, 480, 480]);
    for (const n of [5, 7, 10]) {
      await userEvent.click(screen.getByRole("button", { name: /more people/i }));
      if (n === 5 || n === 7 || n === 10) { /* walk up */ }
    }
    expect(total(list()).reduce((a, b) => a + b, 0)).toBe(2400); // ten people, whole-number percentages, still exact
  });

  it("each moment is a small product card with what you get or owe", async () => {
    const { default: Page } = await import("@/app/page");
    render(await Page());
    const m = screen.getByTestId("moments");
    expect(m).toHaveTextContent("Goa trip");
    expect(m).toHaveTextContent("You get");
    expect(m).toHaveTextContent("You owe");
    expect(m.textContent).not.toMatch(/[+−]\s?₹/);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Suspense } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({ user: { value: null as null | { id: string }, loading: false }, push: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: h.user.value, loading: h.user.loading }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }));

import JoinPage from "@/app/join/[token]/page";

const group = { id: "g1", name: "Goa Trip", description: "Beach week", category: "TRIP", currency: "INR", _count: { members: 4, expenses: 12 } };

function stubFetch(handlers: { get?: unknown; post?: unknown; getFails?: boolean }) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") return { json: async () => handlers.post ?? { data: { groupId: "g1" } } };
    if (handlers.getFails) throw new Error("offline");
    return { json: async () => handlers.get ?? { data: group } };
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}
async function renderPage(token = "tok123") {
  await act(async () => {
    render(<Suspense fallback={null}><JoinPage params={Promise.resolve({ token })} /></Suspense>);
  });
}

beforeEach(() => { vi.clearAllMocks(); h.user.value = null; h.user.loading = false; });

describe("JoinPage — previewing an invite", () => {
  it("loads the invite for the token in the URL and shows the group", async () => {
    const fetchMock = stubFetch({});
    await renderPage("abc");
    expect(await screen.findByText("Goa Trip")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/join/abc");
    expect(screen.getByText("Beach week")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument(); // members
    expect(screen.getByText("12")).toBeInTheDocument(); // expenses
  });

  it("shows the server's reason when the invite is invalid or expired, with a way home", async () => {
    stubFetch({ get: { error: { message: "Invite link is invalid or has expired" } } });
    await renderPage();
    expect(await screen.findByText("Invite link is invalid or has expired")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go home/i })).toHaveAttribute("href", "/");
  });

  it("handles network failures", async () => {
    stubFetch({ getFails: true });
    await renderPage();
    expect(await screen.findByText("Failed to load invite.")).toBeInTheDocument();
  });

  it("shows a loading state while auth or the invite is loading", async () => {
    h.user.loading = true;
    stubFetch({});
    await renderPage();
    expect(screen.queryByText("Goa Trip")).not.toBeInTheDocument();
  });
});

describe("JoinPage — signed out", () => {
  it("offers Sign up & join, and keeps the invite through sign-up (regression: it used to be lost)", async () => {
    stubFetch({});
    await renderPage("tok123");
    await userEvent.click(await screen.findByRole("button", { name: /sign up & join/i }));
    expect(h.push).toHaveBeenCalledWith("/signup?redirect=/join/tok123");
  });

  it("existing users can sign in and return to the invite", async () => {
    stubFetch({});
    await renderPage("tok123");
    expect(await screen.findByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login?redirect=/join/tok123");
  });

  it("does not join anything before signing in", async () => {
    const fetchMock = stubFetch({});
    await renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /sign up & join/i }));
    expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit | undefined)?.method !== "POST")).toBe(true);
  });
});

describe("JoinPage — signed in", () => {
  const redirects: (() => void)[] = [];
  beforeEach(() => {
    h.user.value = { id: "me" };
    redirects.length = 0;
    // Capture only the celebration's 2.8s redirect timer so tests don't wait for it
    const realSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void, ms?: number, ...rest: unknown[]) => {
      if (ms === 2800) { redirects.push(fn); return 0 as never; }
      return (realSetTimeout as unknown as (...a: unknown[]) => unknown)(fn, ms, ...rest);
    }) as never);
  });
  afterEach(() => vi.restoreAllMocks());

  it("joins with a POST, shows the celebration, then opens the group after the animation", async () => {
    const fetchMock = stubFetch({});
    await renderPage("tok123");
    await userEvent.click(await screen.findByRole("button", { name: /join goa trip/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/join/tok123", { method: "POST" }));
    await waitFor(() => expect(redirects).toHaveLength(1));
    expect(h.push).not.toHaveBeenCalled(); // waits for the animation
    act(() => redirects[0]());
    expect(h.push).toHaveBeenCalledWith("/groups/g1");
  });

  it("shows why joining failed (e.g. the invite expired) and doesn't navigate", async () => {
    stubFetch({ post: { error: { message: "Invite link is invalid or has expired" } } });
    await renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /join goa trip/i }));
    expect(await screen.findByText("Invite link is invalid or has expired")).toBeInTheDocument();
    expect(redirects).toHaveLength(0);
    expect(h.push).not.toHaveBeenCalled();
  });

  it("an existing member is simply taken to the group", async () => {
    stubFetch({ post: { data: { groupId: "g1", alreadyMember: true } } });
    await renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /join goa trip/i }));
    await waitFor(() => expect(redirects).toHaveLength(1));
    act(() => redirects[0]());
    expect(h.push).toHaveBeenCalledWith("/groups/g1");
  });
});

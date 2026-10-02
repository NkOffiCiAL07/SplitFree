import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const auth = vi.hoisted(() => {
  const state = { listener: null as null | ((event: string, session: unknown) => void), unsubscribe: vi.fn() };
  return {
    state,
    getSession: vi.fn(),
    onAuthStateChange: vi.fn((cb: (e: string, s: unknown) => void) => { state.listener = cb; return { data: { subscription: { unsubscribe: state.unsubscribe } } }; }),
    signOut: vi.fn().mockResolvedValue({}),
    signInWithOAuth: vi.fn().mockResolvedValue({}),
    signInWithPassword: vi.fn().mockResolvedValue({}),
    signUp: vi.fn().mockResolvedValue({}),
    resetPasswordForEmail: vi.fn().mockResolvedValue({}),
  };
});
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));

import { useAuth } from "@/hooks/use-auth";

const session = (id: string) => ({ user: { id, email: `${id}@x.com` } });

beforeEach(() => {
  vi.clearAllMocks();
  auth.getSession.mockResolvedValue({ data: { session: session("u1") } });
});

describe("useAuth — state", () => {
  it("starts loading, then exposes the signed-in user and session", async () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toMatchObject({ id: "u1" });
    expect(result.current.session).toMatchObject({ user: { id: "u1" } });
  });

  it("is signed out (not loading) when there is no session", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it("follows auth changes (sign-in elsewhere, sign-out, token refresh)", async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => auth.state.listener!("SIGNED_IN", session("u2")));
    expect(result.current.user).toMatchObject({ id: "u2" });
    act(() => auth.state.listener!("SIGNED_OUT", null));
    expect(result.current.user).toBeNull();
  });

  it("unsubscribes from auth changes on unmount", async () => {
    const { unmount } = renderHook(() => useAuth());
    unmount();
    expect(auth.state.unsubscribe).toHaveBeenCalledOnce();
  });
});

describe("useAuth — actions", () => {
  const setup = async () => {
    const hook = renderHook(() => useAuth());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    return hook.result;
  };

  it("signOut", async () => {
    const r = await setup();
    await r.current.signOut();
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it("signInWithEmail passes credentials through", async () => {
    const r = await setup();
    await r.current.signInWithEmail("a@x.com", "pw");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@x.com", password: "pw" });
  });

  it("signUpWithEmail stores the name and sends the confirmation link back to this app", async () => {
    const r = await setup();
    await r.current.signUpWithEmail("a@x.com", "pw", "Asha");
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "a@x.com", password: "pw",
      options: { data: { name: "Asha" }, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
  });

  it("Google sign-in returns to the callback with a (URL-encoded) destination, defaulting to the dashboard", async () => {
    const r = await setup();
    await r.current.signInWithGoogle();
    expect(auth.signInWithOAuth).toHaveBeenLastCalledWith({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=%2Fdashboard` },
    });
    await r.current.signInWithGoogle("/groups/abc?x=1");
    expect(auth.signInWithOAuth.mock.calls[1][0].options.redirectTo).toContain("next=%2Fgroups%2Fabc%3Fx%3D1");
  });

  it("password reset email links to the update-password page", async () => {
    const r = await setup();
    await r.current.resetPassword("a@x.com");
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("a@x.com", {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password/update`,
    });
  });
});

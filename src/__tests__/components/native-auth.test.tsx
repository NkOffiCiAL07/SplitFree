import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ signInWithEmail: vi.fn(), signInWithGoogle: vi.fn(), signUpWithEmail: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import LoginForm from "@/app/(auth)/login/login-form";
import SignupForm from "@/app/(auth)/signup/signup-form";
import { InstallBanner } from "@/components/layout/install-banner";

const APP_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SplitrProApp/1.0";
const SAFARI_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const ua = (v: string) => vi.spyOn(navigator, "userAgent", "get").mockReturnValue(v);

beforeEach(() => { sessionStorage.clear(); });
afterEach(() => vi.restoreAllMocks());

describe("sign-in inside the iPhone app", () => {
  it("offers email sign-in only: Google refuses embedded web views, so its button is hidden (and the divider with it)", () => {
    ua(APP_UA);
    render(<LoginForm />);
    expect(screen.queryByRole("button", { name: /continue with google/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
  });

  it("…and does NOT show the 'you're in another app's browser' warning (it's our own app)", () => {
    ua(APP_UA);
    render(<LoginForm />);
    expect(screen.queryByTestId("inapp-notice")).not.toBeInTheDocument();
  });

  it("sign-up is email-only in the app too", () => {
    ua(APP_UA);
    render(<SignupForm />);
    expect(screen.queryByRole("button", { name: /continue with google/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("in Safari the Google button is still there", () => {
    ua(SAFARI_UA);
    render(<LoginForm />);
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeEnabled();
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("the 'install the app' banner never shows inside the app", () => {
    ua(APP_UA);
    localStorage.setItem("splitfree-visits", "5");
    render(<InstallBanner />);
    expect(screen.queryByTestId("install-banner")).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({
  push: vi.fn(),
  search: { value: "" },
  toast: { success: vi.fn(), error: vi.fn() },
  auth: {
    signInWithEmail: vi.fn(), signInWithGoogle: vi.fn(), signUpWithEmail: vi.fn(),
  },
  supabase: { resetPasswordForEmail: vi.fn(), updateUser: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push }),
  useSearchParams: () => new URLSearchParams(h.search.value),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => h.auth }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: h.supabase }) }));

import LoginForm from "@/app/(auth)/login/login-form";
import SignupForm from "@/app/(auth)/signup/signup-form";
import { ResetPasswordForm } from "@/app/(auth)/reset-password/reset-password-form";
import { UpdatePasswordContent } from "@/app/(auth)/reset-password/update/update-password-form";

beforeEach(() => {
  vi.clearAllMocks();
  h.search.value = "";
  h.auth.signInWithEmail.mockResolvedValue({ error: null });
  h.auth.signInWithGoogle.mockResolvedValue({ error: null });
  h.auth.signUpWithEmail.mockResolvedValue({ error: null, data: { session: null } });
  h.supabase.resetPasswordForEmail.mockResolvedValue({ error: null });
  h.supabase.updateUser.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("LoginForm", () => {
  const fill = async (email: string, password: string) => {
    await userEvent.type(screen.getByLabelText("Email"), email);
    await userEvent.type(screen.getByPlaceholderText("••••••••"), password);
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
  };

  it("validates before calling the server", async () => {
    render(<LoginForm />);
    await fill("a@b", "abc"); // "a@b" passes the browser's own check but not ours
    expect(await screen.findByText("Enter a valid email")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 6 characters")).toBeInTheDocument();
    expect(h.auth.signInWithEmail).not.toHaveBeenCalled();
  });

  it("signs in and goes to the dashboard by default", async () => {
    render(<LoginForm />);
    await fill("me@x.com", "secret1");
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/dashboard"));
    expect(h.auth.signInWithEmail).toHaveBeenCalledWith("me@x.com", "secret1");
    expect(h.toast.success).toHaveBeenCalledWith("Welcome back!");
  });

  it("returns to the page they were trying to open", async () => {
    h.search.value = "redirect=/groups/abc";
    render(<LoginForm />);
    await fill("me@x.com", "secret1");
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/groups/abc"));
  });

  it.each(["//evil.com", "@evil.com", "https://evil.com", "/\\evil.com"])(
    "never redirects off-site after login: ?redirect=%s (open-redirect fix)",
    async (evil) => {
      h.search.value = `redirect=${encodeURIComponent(evil)}`;
      render(<LoginForm />);
      await fill("me@x.com", "secret1");
      await waitFor(() => expect(h.push).toHaveBeenCalledWith("/dashboard"));
    }
  );

  it("shows the server's message and stays on the page when sign-in fails", async () => {
    h.auth.signInWithEmail.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<LoginForm />);
    await fill("me@x.com", "wrongpw");
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("Invalid login credentials"));
    expect(h.push).not.toHaveBeenCalled();
  });

  it("Google sign-in passes along the (sanitised) destination and reports errors", async () => {
    h.search.value = "redirect=/expenses";
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(h.auth.signInWithGoogle).toHaveBeenCalledWith("/expenses");
  });

  it("Google sign-in errors are shown and the button becomes usable again", async () => {
    h.auth.signInWithGoogle.mockResolvedValue({ error: { message: "popup closed" } });
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("popup closed"));
    await waitFor(() => expect(screen.getByRole("button", { name: /continue with google/i })).toBeEnabled());
  });

  it("can show and hide the password, and links to password reset", async () => {
    render(<LoginForm />);
    const pw = screen.getByPlaceholderText("••••••••");
    expect(pw).toHaveAttribute("type", "password");
    await userEvent.click(pw.parentElement!.querySelector("button[type=button]") as HTMLElement);
    expect(pw).toHaveAttribute("type", "text");
    expect(screen.getByRole("link", { name: /forgot password/i })).toHaveAttribute("href", "/reset-password");
  });

  it("has no bypass or demo login — signing in takes real credentials (in every environment)", () => {
    for (const env of ["production", "development"]) {
      vi.stubEnv("NODE_ENV", env);
      const { unmount } = render(<LoginForm />);
      expect(screen.queryByRole("button", { name: /bypass|skip login|demo/i })).not.toBeInTheDocument();
      unmount();
    }
  });
});

describe("SignupForm", () => {
  const fill = async (name: string, email: string, password: string) => {
    await userEvent.type(screen.getByLabelText("Full name"), name);
    await userEvent.type(screen.getByLabelText("Email"), email);
    await userEvent.type(screen.getByLabelText("Password"), password);
    await userEvent.click(screen.getByRole("button", { name: /^create account$/i }));
  };

  it("enforces the password policy (8+ chars, uppercase, number)", async () => {
    render(<SignupForm />);
    await fill("Asha Rao", "asha@x.com", "weakpass");
    expect(await screen.findByText(/uppercase/i)).toBeInTheDocument();
    expect(h.auth.signUpWithEmail).not.toHaveBeenCalled();
  });

  it("asks you to confirm your email when there's no session yet", async () => {
    render(<SignupForm />);
    await fill("Asha Rao", "asha@x.com", "Passw0rdX");
    await waitFor(() => expect(h.auth.signUpWithEmail).toHaveBeenCalledWith("asha@x.com", "Passw0rdX", "Asha Rao", undefined));
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    expect(h.push).not.toHaveBeenCalled();
  });

  it("goes straight to the dashboard when the account is auto-confirmed", async () => {
    h.auth.signUpWithEmail.mockResolvedValue({ error: null, data: { session: { access_token: "x" } } });
    render(<SignupForm />);
    await fill("Asha Rao", "asha@x.com", "Passw0rdX");
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/dashboard"));
  });

  describe("invite links: new people must end up in the group (regression: ?redirect was ignored)", () => {
    it("carries the destination through email confirmation", async () => {
      h.search.value = "redirect=/join/tok123";
      render(<SignupForm />);
      await fill("Asha Rao", "asha@x.com", "Passw0rdX");
      await waitFor(() => expect(h.auth.signUpWithEmail).toHaveBeenCalledWith("asha@x.com", "Passw0rdX", "Asha Rao", "/join/tok123"));
    });

    it("sends auto-confirmed accounts straight to the destination", async () => {
      h.search.value = "redirect=/join/tok123";
      h.auth.signUpWithEmail.mockResolvedValue({ error: null, data: { session: { access_token: "x" } } });
      render(<SignupForm />);
      await fill("Asha Rao", "asha@x.com", "Passw0rdX");
      await waitFor(() => expect(h.push).toHaveBeenCalledWith("/join/tok123"));
    });

    it("Google sign-up also returns to the destination", async () => {
      h.search.value = "redirect=/join/tok123";
      render(<SignupForm />);
      await userEvent.click(screen.getByRole("button", { name: /sign up with google/i }));
      expect(h.auth.signInWithGoogle).toHaveBeenCalledWith("/join/tok123");
    });

    it("never accepts an off-site destination", async () => {
      h.search.value = `redirect=${encodeURIComponent("//evil.com")}`;
      h.auth.signUpWithEmail.mockResolvedValue({ error: null, data: { session: { access_token: "x" } } });
      render(<SignupForm />);
      await fill("Asha Rao", "asha@x.com", "Passw0rdX");
      await waitFor(() => expect(h.push).toHaveBeenCalledWith("/dashboard"));
      expect(h.auth.signUpWithEmail.mock.calls[0][3]).toBe("/dashboard");
    });

    it("without a destination nothing extra is sent", async () => {
      render(<SignupForm />);
      await fill("Asha Rao", "asha@x.com", "Passw0rdX");
      await waitFor(() => expect(h.auth.signUpWithEmail).toHaveBeenCalled());
      expect(h.auth.signUpWithEmail.mock.calls[0]).toHaveLength(4);
      expect(h.auth.signUpWithEmail.mock.calls[0][3]).toBeUndefined();
    });
  });

  it("shows sign-up errors (e.g. email already registered)", async () => {
    h.auth.signUpWithEmail.mockResolvedValue({ error: { message: "User already registered" }, data: {} });
    render(<SignupForm />);
    await fill("Asha Rao", "asha@x.com", "Passw0rdX");
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("User already registered"));
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
  });
});

describe("ResetPasswordForm", () => {
  const submit = async (email: string) => {
    await userEvent.type(screen.getByLabelText(/email address/i), email);
    await userEvent.click(screen.getByRole("button", { name: /send|reset/i }));
  };

  it("validates the email", async () => {
    render(<ResetPasswordForm />);
    await submit("a@b");
    expect(await screen.findByText("Enter a valid email")).toBeInTheDocument();
    expect(h.supabase.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("sends the link to the update page and confirms", async () => {
    render(<ResetPasswordForm />);
    await submit("me@x.com");
    await waitFor(() => expect(h.supabase.resetPasswordForEmail).toHaveBeenCalledWith("me@x.com", {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password/update`,
    }));
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to sign in/i })).toHaveAttribute("href", "/login");
  });

  it("reports errors without claiming it was sent", async () => {
    h.supabase.resetPasswordForEmail.mockResolvedValue({ error: { message: "rate limited" } });
    render(<ResetPasswordForm />);
    await submit("me@x.com");
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("rate limited"));
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
  });
});

describe("UpdatePasswordContent", () => {
  const submit = async (password: string, confirm: string) => {
    await userEvent.type(screen.getByPlaceholderText(/min\. 8 characters/i), password);
    await userEvent.type(screen.getByPlaceholderText(/repeat your password/i), confirm);
    await userEvent.click(screen.getByRole("button", { name: /update password/i }));
  };

  it("applies the same strength policy as signup", async () => {
    render(<UpdatePasswordContent />);
    await submit("alllowercase", "alllowercase");
    expect(await screen.findByText(/uppercase/i)).toBeInTheDocument();
    expect(h.supabase.updateUser).not.toHaveBeenCalled();
  });

  it("requires the confirmation to match", async () => {
    render(<UpdatePasswordContent />);
    await submit("Passw0rdX", "Passw0rdY");
    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(h.supabase.updateUser).not.toHaveBeenCalled();
  });

  it("updates the password and sends you to sign in", async () => {
    render(<UpdatePasswordContent />);
    await submit("Passw0rdX", "Passw0rdX");
    await waitFor(() => expect(h.supabase.updateUser).toHaveBeenCalledWith({ password: "Passw0rdX" }));
    expect(h.toast.success).toHaveBeenCalledWith("Password updated! Please sign in.");
    expect(h.push).toHaveBeenCalledWith("/login");
  });

  it("shows server errors and stays put", async () => {
    h.supabase.updateUser.mockResolvedValue({ error: { message: "Auth session missing" } });
    render(<UpdatePasswordContent />);
    await submit("Passw0rdX", "Passw0rdX");
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("Auth session missing"));
    expect(h.push).not.toHaveBeenCalled();
  });
});

describe("Sign-in / sign-up forms — built for phones (touch targets, keyboards, password managers)", () => {
  it("login: password managers can recognise the fields, and the keyboard suits each one", () => {
    render(<LoginForm />);
    const email = screen.getByLabelText("Email");
    const password = screen.getByPlaceholderText("••••••••");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "username");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    expect(email).toHaveAttribute("inputmode", "email");
    expect(email).toHaveAttribute("autocapitalize", "none");   // no auto-capital first letter in an email
    expect(email).toHaveAttribute("autocorrect", "off");
    expect(email).toHaveAttribute("spellcheck", "false");
    expect(email).toHaveAttribute("enterkeyhint", "next");     // keyboard's action key moves to the password
    expect(password).toHaveAttribute("enterkeyhint", "go");    // …and then signs in
  });

  it("signup: asks the password manager to save a NEW password, and capitalises names", () => {
    render(<SignupForm />);
    expect(screen.getByLabelText("Full name")).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText("Full name")).toHaveAttribute("autocapitalize", "words");
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "new-password");
  });

  it("every control is a comfortable thumb target on phones (52px, vs Material's 48–56dp guidance)", () => {
    render(<LoginForm />);
    for (const el of [screen.getByLabelText("Email"), screen.getByPlaceholderText("••••••••"), screen.getByRole("button", { name: /continue with google/i })]) {
      expect(el.className).toMatch(/max-lg:h-\[52px\]/);
      expect(el.className).toMatch(/max-lg:rounded-2xl/);
    }
    expect(screen.getByRole("button", { name: /^sign in$/i }).className).toMatch(/h-\[54px\]/); // the main action is the biggest
  });

  it("the show/hide password button is labelled, announces its state, and is a 44px target", async () => {
    render(<LoginForm />);
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle.className).toMatch(/size-11/);
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByPlaceholderText("••••••••")).toHaveAttribute("type", "text");
  });

  it("errors are tied to their fields for screen readers (aria-invalid + described-by) and announced", async () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "false");
    await userEvent.type(screen.getByLabelText("Email"), "a@b");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    const email = screen.getByLabelText("Email");
    await waitFor(() => expect(email).toHaveAttribute("aria-invalid", "true"));
    const msg = screen.getAllByRole("alert").find((a) => a.id === "email-error")!;
    expect(msg).toHaveTextContent("Enter a valid email");
    expect(email).toHaveAttribute("aria-describedby", "email-error");
  });

  it("the sign-up and forgot-password links are big enough to hit", () => {
    render(<LoginForm />);
    expect(screen.getByRole("link", { name: /forgot password/i }).className).toMatch(/py-2/);
    expect(screen.getByRole("link", { name: /sign up free/i }).className).toMatch(/py-2/);
  });
});

describe("Sign-in polish", () => {
  it("the Sign in button is the glossy primary action with a sliding arrow and a shimmer", () => {
    render(<LoginForm />);
    const btn = screen.getByRole("button", { name: /^sign in$/i });
    expect(btn).toHaveClass("btn-liquid", "lg-shine", "group");
    expect(btn.querySelector("svg")).toHaveClass("group-hover:translate-x-1"); // the arrow nudges forward on hover
    expect(btn.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("sign-up gets the same primary button", () => {
    render(<SignupForm />);
    expect(screen.getByRole("button", { name: /create account/i })).toHaveClass("btn-liquid");
  });

  it("the footer (sign-up link + trust line) is pinned to the bottom of the sheet instead of leaving a blank gap", () => {
    render(<LoginForm />);
    const footer = screen.getByRole("link", { name: /sign up free/i }).closest("div")!;
    expect(footer).toHaveClass("mt-auto");
    expect(footer).toHaveTextContent(/Secure sign-in · No ads · Free forever/);
    expect(screen.getByRole("link", { name: /sign up free/i })).toHaveAttribute("href", "/signup");
  });

  it("the form builds up in sequence (staggered entrance), header first and footer last", () => {
    const { container } = render(<LoginForm />);
    const delays = [...container.querySelectorAll<HTMLElement>(".anim-fade-up")].map((e) => parseInt(e.style.animationDelay));
    expect(delays.length).toBeGreaterThanOrEqual(7);
    expect(delays).toEqual([...delays].sort((a, b) => a - b)); // strictly in DOM order
    expect(delays[0]).toBeLessThan(delays[delays.length - 1]);
  });

  it("the subtitle is one short line (it used to wrap and leave 'them.' alone)", () => {
    render(<LoginForm />);
    expect(screen.getByText("Your groups and balances are waiting.")).toBeInTheDocument();
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DeleteAccountPage, { metadata } from "@/app/delete-account/page";

// Google Play needs a public web page that explains how to delete an account and what happens to the data.
describe("Delete account page", () => {
  it("explains the in-app path, the settle-up rule, what is deleted and what stays", () => {
    const { container } = render(<DeleteAccountPage />);
    const text = container.textContent ?? "";
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/delete your .* account/i);
    expect(text).toMatch(/Settings[\s\S]*Delete account/);
    expect(text).toMatch(/settle up first/i);
    expect(text).toMatch(/mobile number/i);
    expect(text).toMatch(/Deleted user/);
    expect(text).toMatch(/stay for those people/i);
    expect(text).not.toMatch(/permanently removes all your data/i);
  });

  it("works without the app: an email route for people who cannot sign in", () => {
    render(<DeleteAccountPage />);
    const mail = screen.getAllByRole("link").find((a) => (a.getAttribute("href") ?? "").startsWith("mailto:"));
    expect(mail).toBeTruthy();
    expect(mail!.getAttribute("href")).toMatch(/subject=Delete/);
  });

  it("has a title for search and the store listing", () => {
    expect(String(metadata.title)).toMatch(/delete/i);
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PrivacyPage from "@/app/privacy/page";

// App Review compares the privacy policy with the App Store "App Privacy" answers: whatever we collect must be stated here.
describe("Privacy policy", () => {
  it("says we collect the mobile number, that it is required, private, and never sold or shown to others", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/name, email address and mobile number when you sign up/i);
    expect(text).toMatch(/mobile number is required to create an account/i);
    expect(text).toMatch(/never shown to other users/i);
    expect(text).toMatch(/never used for advertising or marketing, and never sold/i);
    expect(text).toMatch(/do not send text messages or call you/i);
  });

  it("also covers the optional UPI ID, and what deleting an account removes (including the number)", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/UPI ID/);
    expect(text).toMatch(/removes your name, email address, mobile number, photo, payment address/i);
  });

  it("covers the optional iPhone launch list (an email stored for that one purpose)", () => {
    const { container } = render(<PrivacyPage />);
    expect(container.textContent).toMatch(/iPhone launch list.*store your email address for that one purpose/i);
  });

  it("is dated, and has a way to contact us", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/Last updated: October 7, 2026/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /@/ })).toBeInTheDocument();
  });

  it("is honest about what is and is not collected: no analytics or ads, no location/contacts/camera, and no claim that deletion erases shared records", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/do not use advertising, analytics or tracking services/i);
    expect(text).toMatch(/do not access your location, contacts, camera, microphone, photos or files/i);
    expect(text).not.toMatch(/usage data/i); // (there is no analytics code, so it must not claim usage tracking)
    expect(text).not.toMatch(/delete your account and all associated data/i);
    expect(text).toMatch(/shared records stay for the other members|stay for the other members, with the deleted person shown as/i);
  });

  it("names every service provider the code really uses, and links to the deletion page", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";
    for (const name of ["Supabase", "Vercel", "Google", "Resend", "Frankfurter"]) expect(text).toContain(name);
    expect(text).not.toMatch(/ui-avatars/i);
    expect(screen.getByRole("link", { name: /account deletion page/i })).toHaveAttribute("href", "/delete-account");
  });
});

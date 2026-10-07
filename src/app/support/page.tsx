import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/app-config";
import { BrandLogo } from "@/components/shared/brand-logo";

export const metadata: Metadata = {
  title: "Support",
};

const CONTACT_EMAIL = "nishantkumar19041@gmail.com";

const FAQS = [
  {
    q: "How do I add an expense?",
    a: "Tap the + button in the bottom navigation bar (mobile) or the 'Add expense' button in the top right (desktop). Fill in the description, amount, and who to split with.",
  },
  {
    q: "How do I settle up with someone?",
    a: "Go to the Dashboard and tap 'Settle up', or navigate to the Settle page from the sidebar. Select the person you want to settle with and enter the amount paid.",
  },
  {
    q: "Can I be in multiple groups?",
    a: "Yes. You can create or join as many groups as you need — for trips, home expenses, work meals, or any shared context.",
  },
  {
    q: "How do I invite someone to a group?",
    a: "Open the group, tap the members section, and use the 'Invite' option to share a link or QR code. They'll need a Splitr Pro account to join.",
  },
  {
    q: "What currencies are supported?",
    a: "Splitr Pro supports 15+ currencies. You can set a default currency per group when creating it.",
  },
  {
    q: "How do I delete my account?",
    a: "Go to Settings → scroll to the bottom → Delete account. Your name, email, mobile number, photo and sign-in are removed. If you still owe or are owed money, you'll be asked to settle up first. Expenses you shared with other people stay for them, with your name shown as \"Deleted user\". You can also request deletion without the app on the Delete account page.",
  },
  {
    q: "How do I export my expenses?",
    a: "Go to Settings → Export Data. You'll get a CSV file of all your expenses.",
  },
  {
    q: "Is Splitr Pro free?",
    a: "Yes, completely free. No premium tiers, no ads, no paywalls.",
  },
];

export default function SupportPage() {
  return (
    <div className="safe-top min-h-dvh bg-background text-foreground">
      <header className="border-b px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" aria-label={`${APP_NAME} home`}><BrandLogo size={28} /></Link>
        <Link href="/privacy" className="-my-3 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        <div>
          <h1 className="text-3xl font-bold">Support</h1>
          <p className="text-muted-foreground mt-2">
            Need help with {APP_NAME}? We&apos;re here to assist.
          </p>
        </div>

        {/* Contact */}
        <section className="rounded-2xl border bg-card p-6 space-y-3">
          <h2 className="text-xl font-semibold">Contact Us</h2>
          <p className="text-muted-foreground leading-relaxed">
            For bug reports, feature requests, or account issues, email us directly. We typically
            respond within 24 hours.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex min-h-11 items-center gap-2 text-[#4f48e6] dark:text-primary font-medium hover:underline underline-offset-2"
          >
            {CONTACT_EMAIL}
          </a>
        </section>

        {/* FAQ */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="rounded-xl border bg-card p-5 space-y-2">
                <p className="font-medium">{q}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Links */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Other Links</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/privacy" className="-my-2 py-2 text-sm text-[#4f48e6] dark:text-primary hover:underline underline-offset-2">Privacy Policy</Link>
            <Link href="/dashboard" className="-my-2 py-2 text-sm text-[#4f48e6] dark:text-primary hover:underline underline-offset-2">Go to App</Link>
          </div>
        </section>
      </main>

      <footer className="border-t px-6 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {APP_NAME} · <Link href="/privacy" className="hover:text-foreground">Privacy</Link> · <Link href="/support" className="hover:text-foreground">Support</Link>
      </footer>
    </div>
  );
}

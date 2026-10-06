import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/app-config";
import { BrandLogo } from "@/components/shared/brand-logo";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

const LAST_UPDATED = "October 6, 2026";
const CONTACT_EMAIL = "nishantkumar19041@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="safe-top min-h-dvh bg-background text-foreground">
      <header className="border-b px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" aria-label={`${APP_NAME} home`}><BrandLogo size={28} /></Link>
        <Link href="/support" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Support</Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        <div>
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: {LAST_UPDATED}</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Overview</h2>
          <p className="text-muted-foreground leading-relaxed">
            {APP_NAME} (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This policy
            explains what information we collect, how we use it, and your rights regarding your data.
            By using {APP_NAME}, you agree to the practices described here.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Information We Collect</h2>
          <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc list-inside">
            <li><strong className="text-foreground">Account information</strong> — name, email address and mobile number when you sign up. Your mobile number is required to create an account.</li>
            <li><strong className="text-foreground">iPhone launch list (optional)</strong> — if you ask to be notified when the iPhone app launches on our home page, we store your email address for that one purpose, and delete it once we have told you or when you ask us to.</li>
            <li><strong className="text-foreground">Payment address (optional)</strong> — your UPI ID, if you add one, so friends can pay you.</li>
            <li><strong className="text-foreground">Profile data</strong> — optional avatar/profile photo you upload.</li>
            <li><strong className="text-foreground">Expense data</strong> — expenses, amounts, groups, and splits you create.</li>
            <li><strong className="text-foreground">Usage data</strong> — pages visited and actions taken within the app, used to improve the product.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How We Use Your Information</h2>
          <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc list-inside">
            <li>To provide and operate the {APP_NAME} service.</li>
            <li>To calculate and display expense balances between you and your friends/groups.</li>
            <li>To send notifications about friend requests, group invites, and expense activity.</li>
            <li>To improve and maintain the app.</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Your mobile number</strong> is kept on your account to identify you and to help us
            reach you about your account if we ever need to. It is <strong className="text-foreground">never shown to other users</strong>,
            never used for advertising or marketing, and never sold. We do not send text messages or call you today; we do not verify
            the number yet. If we add phone verification or text-message alerts, we will update this policy first.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Data Storage & Security</h2>
          <p className="text-muted-foreground leading-relaxed">
            Your data is stored securely using <strong className="text-foreground">Supabase</strong>, a
            PostgreSQL-based platform with encryption at rest and in transit. Authentication is handled
            via Supabase Auth with industry-standard security practices. We never store passwords in
            plain text.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Data Sharing</h2>
          <p className="text-muted-foreground leading-relaxed">
            We do <strong className="text-foreground">not</strong> sell, trade, or rent your personal
            information to third parties. Your expense data is only visible to you and the group members
            or friends you explicitly share it with; other people cannot see your mobile number or email address through the app. We use Supabase and Vercel as infrastructure
            providers — they process your data solely to operate the service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Your Rights</h2>
          <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc list-inside">
            <li><strong className="text-foreground">Access</strong> — You can download your data, including your mobile number, from Settings → Download all my data.</li>
            <li><strong className="text-foreground">Deletion</strong> — You can delete your account and all associated data from Settings → Delete Account. This removes your name, email address, mobile number, photo and UPI ID.</li>
            <li><strong className="text-foreground">Correction</strong> — You can update your name, profile and mobile number at any time from your Profile and Settings pages.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Cookies & Local Storage</h2>
          <p className="text-muted-foreground leading-relaxed">
            We use cookies strictly for authentication (session management). We also use browser
            local storage to remember your UI preferences (theme, notification settings). No
            third-party advertising or tracking cookies are used.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Children&apos;s Privacy</h2>
          <p className="text-muted-foreground leading-relaxed">
            {APP_NAME} is not directed at children under 13. We do not knowingly collect personal
            information from children under 13. If you believe a child has provided us information,
            please contact us and we will delete it promptly.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Changes to This Policy</h2>
          <p className="text-muted-foreground leading-relaxed">
            We may update this privacy policy from time to time. We will notify you of significant
            changes by updating the &quot;Last updated&quot; date above. Continued use of the app after changes
            constitutes acceptance of the updated policy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Contact Us</h2>
          <p className="text-muted-foreground leading-relaxed">
            If you have questions or concerns about this privacy policy or your data, contact us at:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>
      </main>

      <footer className="border-t px-6 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {APP_NAME} · <Link href="/privacy" className="hover:text-foreground">Privacy</Link> · <Link href="/support" className="hover:text-foreground">Support</Link>
      </footer>
    </div>
  );
}

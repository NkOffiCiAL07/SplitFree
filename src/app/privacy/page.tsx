import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/app-config";
import { BrandLogo } from "@/components/shared/brand-logo";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

const LAST_UPDATED = "October 7, 2026";
const CONTACT_EMAIL = "nishantkumar19041@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="safe-top min-h-dvh bg-background text-foreground">
      <header className="border-b px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" aria-label={`${APP_NAME} home`}><BrandLogo size={28} /></Link>
        <Link href="/support" className="-my-3 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">Support</Link>
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
            <li><strong className="text-foreground">Account information</strong> — name, email address and mobile number when you sign up. Your mobile number is required to create an account. If you sign in with Google, we receive your name, email address and Google profile photo from Google.</li>
            <li><strong className="text-foreground">Payment address (optional)</strong> — your UPI ID, if you add one, so friends can pay you. {APP_NAME} does not move money: payments happen in your own UPI or banking app.</li>
            <li><strong className="text-foreground">Expense and group data</strong> — the groups, friends, expenses, descriptions, notes, amounts, currencies, splits, payments you record, comments, emoji reactions, budgets and edit history you create or that other members of your groups create.</li>
            <li><strong className="text-foreground">Notification data (optional)</strong> — if you turn on push notifications, your browser or phone gives us a push address for this device so we can send them.</li>
            <li><strong className="text-foreground">Data stored on your device</strong> — your sign-in session, your theme and display choices, and, when you are offline, expenses and payments waiting to be saved. They are sent to us when you are back online.</li>
            <li><strong className="text-foreground">iPhone launch list (optional)</strong> — if you ask to be notified when the iPhone app launches on our home page, we store your email address for that one purpose, and delete it once we have told you or when you ask us to.</li>
            <li><strong className="text-foreground">Technical logs</strong> — our hosting provider processes standard request information (such as IP address and browser type) to deliver the service and keep it secure.</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            We do <strong className="text-foreground">not</strong> use advertising, analytics or tracking services, and we do not access your location, contacts, camera, microphone, photos or files.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How We Use Your Information</h2>
          <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc list-inside">
            <li>To provide and operate the {APP_NAME} service.</li>
            <li>To calculate and display expense balances between you and your friends/groups.</li>
            <li>To send notifications and emails about friend requests, group invites, payment reminders, payments you receive and expense activity (you can turn email and push notifications off in Settings).</li>
            <li>To keep the service secure and to fix problems.</li>
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
          <h2 className="text-xl font-semibold">Data Sharing and Service Providers</h2>
          <p className="text-muted-foreground leading-relaxed">
            We do <strong className="text-foreground">not</strong> sell, trade, or rent your personal
            information. Your expense data is visible to you and to the group members or friends you share it with; other people cannot see your mobile number or email address through the app.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            We use these service providers, who process data only to operate {APP_NAME}:
          </p>
          <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc list-inside">
            <li><strong className="text-foreground">Supabase</strong> — database and sign-in (account, group and expense data).</li>
            <li><strong className="text-foreground">Vercel</strong> — hosting of the website and app.</li>
            <li><strong className="text-foreground">Google</strong> — only if you choose Google sign-in.</li>
            <li><strong className="text-foreground">Resend</strong> — sends emails such as invitations and reminders (your email address and the message).</li>
            <li><strong className="text-foreground">Push services of your browser or phone maker</strong> (for example Google, Apple, Mozilla) — deliver push notifications if you turn them on.</li>
            <li><strong className="text-foreground">Frankfurter (exchange rates)</strong> — we fetch public exchange rates; no personal data is sent.</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">We may also disclose information if the law requires it.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How Long We Keep Data</h2>
          <p className="text-muted-foreground leading-relaxed">
            We keep your account data for as long as your account exists. Shared expenses and payments belong to every member of a group, so when someone deletes their account those shared records stay for the other members, with the deleted person shown as &quot;Deleted user&quot;. Your name, email address, mobile number, photo, payment address, notifications and push addresses are removed. Backups are overwritten on the provider&apos;s normal schedule.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Your Rights</h2>
          <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc list-inside">
            <li><strong className="text-foreground">Access</strong> — You can download your data, including your mobile number, from Settings → Download all my data.</li>
            <li><strong className="text-foreground">Deletion</strong> — You can delete your account in the app from Settings → Delete account, or request it without the app on our <Link href="/delete-account" className="text-[#4f48e6] underline underline-offset-2 dark:text-primary">account deletion page</Link>. It removes your name, email address, mobile number, photo, payment address, friends, notifications and sign-in. If you still owe or are owed money we ask you to settle up first, so nobody is left with a debt that cannot be traced; records of shared expenses stay for the other members of your groups (see &quot;How Long We Keep Data&quot;).</li>
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
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#4f48e6] dark:text-primary underline underline-offset-2">
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

import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/app-config";
import { BrandLogo } from "@/components/shared/brand-logo";

export const metadata: Metadata = {
  title: "Delete your account",
  description: `How to delete your ${APP_NAME} account and what happens to your data.`,
};

const CONTACT_EMAIL = "nishantkumar19041@gmail.com";

export default function DeleteAccountPage() {
  return (
    <div className="safe-top min-h-dvh bg-background text-foreground">
      <header className="border-b px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" aria-label={`${APP_NAME} home`}><BrandLogo size={28} /></Link>
        <Link href="/privacy" className="-my-3 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <div>
          <h1 className="text-3xl font-bold">Delete your {APP_NAME} account</h1>
          <p className="text-sm text-muted-foreground mt-2">You can do this yourself, in the app or on the website, in a minute.</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">In the app or on the website</h2>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground leading-relaxed">
            <li>Sign in to {APP_NAME} (Android app, iPhone app or the website).</li>
            <li>Open <strong className="text-foreground">Settings</strong> and scroll to the bottom.</li>
            <li>Choose <strong className="text-foreground">Delete account</strong>, type your email address to confirm, and confirm.</li>
          </ol>
          <p className="text-muted-foreground leading-relaxed">
            Deleting is immediate and cannot be undone. Want to keep a copy first? Use <strong className="text-foreground">Settings → Download all my data</strong>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">If you still owe or are owed money</h2>
          <p className="text-muted-foreground leading-relaxed">
            To protect everyone in your groups, {APP_NAME} asks you to settle up first. The delete screen lists exactly who you need to settle with. Once your balances are zero you can delete your account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">What is deleted</h2>
          <ul className="list-disc list-inside space-y-1.5 text-muted-foreground leading-relaxed">
            <li>Your name, email address, mobile number and profile photo.</li>
            <li>Your payment address (UPI ID).</li>
            <li>Your friendships, notifications, push-notification addresses, budgets, comments, reactions and your sign-in itself.</li>
            <li>Your membership of every group.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">What stays, and why</h2>
          <ul className="list-disc list-inside space-y-1.5 text-muted-foreground leading-relaxed">
            <li>Expenses and payments you shared with other people (and their edit history) stay for those people, so their balances and history remain correct. Your name on them becomes &quot;Deleted user&quot;, and nothing that identifies you is kept with them.</li>
            <li>Groups stay available to the remaining members (a group nobody is left in is archived). If you were the group&apos;s admin, another member becomes the admin.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Can&apos;t sign in?</h2>
          <p className="text-muted-foreground leading-relaxed">
            If you can no longer sign in, email us from the address on your account at{" "}
            <a href={`mailto:${CONTACT_EMAIL}?subject=Delete my ${APP_NAME} account`} className="text-[#4f48e6] underline underline-offset-2 dark:text-primary">{CONTACT_EMAIL}</a>{" "}
            with the subject &quot;Delete my {APP_NAME} account&quot;. We will confirm it is you and delete the account, normally within 7 days.
          </p>
        </section>
      </main>
    </div>
  );
}

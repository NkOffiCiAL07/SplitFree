import type { Metadata } from "next";
import { Check, Zap } from "lucide-react";
import { APP_NAME } from "@/lib/app-config";
import { FillProvider } from "@/components/auth/fill-context";
import { FillingPot } from "@/components/auth/filling-pot";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <FillProvider>
    <div className="min-h-screen flex">
      {/* Left — branding panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 gradient-brand flex-col justify-between p-12 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-white blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-violet-600 font-bold text-sm">S</span>
            </div>
            <span className="text-white font-semibold text-xl">{APP_NAME}</span>
          </div>
        </div>

        {/* The water pot: fills as the form is filled in */}
        <div className="relative z-10 flex flex-1 items-center justify-center py-6">
          <FillingPot size="lg" />
        </div>

        <div className="relative z-10 space-y-6">
          <blockquote className="text-white">
            <p className="text-3xl font-bold leading-tight">
              Split expenses, not friendships.
            </p>
            <p className="mt-4 text-white/80 text-lg leading-relaxed">
              The free, beautiful alternative to Splitwise. Track shared
              expenses with anyone, anywhere — zero ads, zero paywalls.
            </p>
          </blockquote>

        </div>
      </div>

      {/* Right — auth form */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
        {/* Welcome for phones and tablets (also what the Android app shows when signed out) */}
        <section aria-label="Welcome" data-testid="welcome" className="relative w-full max-w-md overflow-hidden rounded-3xl gradient-brand p-6 text-white shadow-xl shadow-violet-500/20 lg:hidden">
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/15 blur-2xl" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-white">
                <Zap className="size-4 text-violet-600" />
              </div>
              <span className="text-lg font-semibold">{APP_NAME}</span>
            </div>
            <div className="float-right -mt-1 ml-3">
              <FillingPot size="sm" />
            </div>
            <p className="text-2xl font-bold leading-tight">Split expenses, not friendships.</p>
            <p className="mt-2 text-sm leading-relaxed text-white/80">
              Share costs with friends and groups, settle up by UPI, and keep going even without signal.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
              {["UPI pay links", "Works offline", "Smart settle-up", "No ads"].map((t) => (
                <li key={t} className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
                  <Check className="size-3" aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
    </FillProvider>
  );
}

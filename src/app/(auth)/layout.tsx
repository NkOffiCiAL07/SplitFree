import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
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
            <span className="text-white font-semibold text-xl">SplitFree</span>
          </div>
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
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}

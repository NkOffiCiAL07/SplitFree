"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { m } from "framer-motion";
import { ArrowRight, Check, Eye, EyeOff, Mail, Lock, ShieldCheck } from "lucide-react";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { loginSchema } from "@/lib/validations/auth";

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
import { toast } from "sonner";
import { useReportFill, useFillLevel } from "@/components/auth/fill-context";
import { InAppBrowserNotice } from "@/components/auth/in-app-browser-notice";
import { useInAppBrowser, useNativeApp } from "@/hooks/use-platform";
import { formProgress } from "@/lib/form-fill";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginValues = z.infer<typeof loginSchema>;

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `redirect` comes from the URL: only in-app paths are allowed (blocks //evil.com style open redirects)
  const redirect = safeRedirectPath(searchParams.get("redirect"));
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false); // the button turns into "You're in" while the app opens

  // The sign-in callback sends people back here with ?error=auth_failed when Google (or an email link) did not complete.
  // It used to show nothing at all, which looked like the button simply didn't work.
  const authFailed = searchParams.get("error") === "auth_failed";
  useEffect(() => {
    if (authFailed) toast.error("Sign-in didn't complete. Please try again — or sign in with your email and password.");
  }, [authFailed]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  // The pot beside the form fills as the form does
  const email = useWatch({ control, name: "email" });
  const password = useWatch({ control, name: "password" });
  const inApp = useInAppBrowser();
  const native = useNativeApp(); // the iPhone app: email sign-in only (Google blocks embedded web views)
  const ready = useFillLevel() >= 1; // the pot is full: invite the click
  useReportFill(formProgress([{ kind: "email", value: email }, { kind: "password", value: password, min: 6 }]));

  const onSubmit = async (values: LoginValues) => {
    try {
      const { error } = await signInWithEmail(values.email, values.password);
      if (error) {
        toast.error(error.message);
        return;
      }
    } catch {
      // The request itself failed (no signal, a dropped connection): say so, instead of leaving the button silently idle
      toast.error("Couldn't reach the server — check your connection and try again");
      return;
    }
    setSignedIn(true);
    toast.success("Welcome back!");
    router.push(redirect);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle(redirect);
    if (error) {
      toast.error(error.message);
      setGoogleLoading(false);
    }
  };


  return (
    <m.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-1 flex-col gap-5 lg:gap-6"
    >
      {/* Header */}
      <div className="anim-fade-up space-y-1" style={{ animationDelay: "60ms" }}>
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl [@media(max-height:700px)]:text-xl">Welcome back 👋</h1>
        <p className="text-sm text-muted-foreground">
          Your groups are waiting.
        </p>
      </div>

      <InAppBrowserNotice />

      {!native && (
        <>
      {/* Google */}
      <Button
        variant="outline"
        data-hide-in-app className="anim-fade-up w-full gap-2 border-[#d9dce5] bg-white text-slate-900 shadow-none hover:bg-[#f8f9fc] h-[52px] rounded-xl text-base dark:border-transparent dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        style={{ animationDelay: "120ms" }}
        onClick={handleGoogle}
        loading={googleLoading}
        disabled={inApp}
        title={inApp ? "Google sign-in isn't available in this browser" : undefined}
      >
        <GoogleIcon />
        Continue with Google
      </Button>
      <p data-hide-in-app data-testid="google-new-here" className="-mt-2 text-center text-xs leading-relaxed text-muted-foreground [@media(max-height:700px)]:hidden">New here? Continuing with Google creates your account automatically.</p>

      <div data-hide-in-app className="anim-fade-up flex items-center gap-3 text-xs text-muted-foreground" role="separator" aria-label="or" style={{ animationDelay: "170ms" }}>
        <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        or continue with email
        <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      </div>
        </>
      )}

      {/* Email form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="anim-fade-up space-y-1.5" style={{ animationDelay: "220ms" }}>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            startIcon={<Mail />}
            autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" inputMode="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className="h-[52px] rounded-xl"
            {...register("email")}
          />
          {errors.email && (
            <p id="email-error" role="alert" className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="anim-fade-up space-y-1.5" style={{ animationDelay: "280ms" }}>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/reset-password"
              className="-my-2 py-2 text-sm text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            startIcon={<Lock />}
            endIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="-mr-3 flex size-11 items-center justify-center rounded-lg hover:text-foreground"
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            }
            autoComplete="current-password" enterKeyHint="go"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            className="h-[52px] rounded-xl"
            {...register("password")}
          />
          {errors.password && (
            <p id="password-error" role="alert" className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        <Button
          type="submit"
          style={{ animationDelay: "420ms" }}
          className={`anim-fade-up btn-liquid group w-full lg-shine h-[54px] text-base font-semibold ${ready ? "lg-ready" : ""}`}
          variant="brand"
          size="lg"
          loading={isSubmitting && !signedIn}
          disabled={signedIn}
        >
          {signedIn ? (
            <><Check className="size-5" aria-hidden="true" /> Welcome back</>
          ) : isSubmitting ? (
            <>Signing you in…</>
          ) : (
            <>
              Sign in
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
            </>
          )}
        </Button>
      </form>

      <div className="anim-fade-up mt-auto space-y-3 pt-2" style={{ animationDelay: "480ms" }}>
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="-my-2 inline-block py-2 font-medium text-primary hover:underline">
          Sign up free
        </Link>
      </p>
      <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/80">
        <ShieldCheck className="size-3.5" aria-hidden="true" /> Secure sign-in · No ads · Free forever
      </p>
      </div>

    </m.div>
  );
}

export default function LoginForm() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { m } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Mail, Lock, User, ShieldCheck } from "lucide-react";
import { PhoneField } from "@/components/ui/phone-field";
import { safeRedirectPath } from "@/lib/safe-redirect";

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
import { signupSchema } from "@/lib/validations/auth";
import { normalizePhone } from "@/lib/phone";
import { useRegion } from "@/components/auth/region-context";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SignupValues = z.infer<typeof signupSchema>;

function SignupFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Where to go after sign-up (e.g. back to an invite link) — in-app paths only
  const redirectParam = searchParams.get("redirect");
  const redirect = safeRedirectPath(redirectParam);
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const region = useRegion(); // placeholder and country code follow where the visitor is
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({ resolver: zodResolver(signupSchema) });

  // The pot beside the form fills as the form does
  const name = useWatch({ control, name: "name" });
  const email = useWatch({ control, name: "email" });
  const phone = useWatch({ control, name: "phone" });
  const password = useWatch({ control, name: "password" });
  const inApp = useInAppBrowser();
  const native = useNativeApp(); // the iPhone app: email sign-in only (Google blocks embedded web views)
  const ready = useFillLevel() >= 1; // the pot is full: invite the click
  useReportFill(formProgress([{ kind: "name", value: name }, { kind: "phone", value: phone }, { kind: "email", value: email }, { kind: "password", value: password, min: 8 }]));

  const onSubmit = async (values: SignupValues) => {
    let result;
    try {
      result = await signUpWithEmail(
        values.email,
        values.password,
        values.name,
        redirectParam ? redirect : undefined,
        normalizePhone(values.phone, region.dial) ?? undefined // stored in international format
      );
    } catch {
      toast.error("Couldn't reach the server — check your connection and try again");
      return;
    }
    const { error, data } = result;
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      // Auto-confirmed (e.g., dev mode)
      router.push(redirect);
    } else {
      setEmailSent(true);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle(redirect);
    if (error) {
      toast.error(error.message);
      setGoogleLoading(false);
    }
  };


  if (emailSent) {
    return (
      <m.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-4"
      >
        <div className="w-16 h-16 gradient-brand rounded-2xl flex items-center justify-center mx-auto">
          <Mail className="size-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          We&apos;ve sent you a confirmation link. Click it to activate your
          account and start splitting expenses.
        </p>
        <Button variant="outline" onClick={() => setEmailSent(false)}>
          Use a different email
        </Button>
      </m.div>
    );
  }

  return (
    <m.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-1 flex-col gap-5 lg:gap-6"
    >
      <div className="anim-fade-up space-y-1" style={{ animationDelay: "60ms" }}>
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Free forever — no ads, no card. Takes about 30 seconds.
        </p>
      </div>

      <InAppBrowserNotice />

      {!native && (
        <>
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
        Sign up with Google
      </Button>

      <div data-hide-in-app className="anim-fade-up flex items-center gap-3 text-xs text-muted-foreground" role="separator" aria-label="or" style={{ animationDelay: "170ms" }}>
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
        </>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="anim-fade-up space-y-1.5" style={{ animationDelay: "220ms" }}>
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            placeholder="Alex Johnson"
            startIcon={<User />}
            autoComplete="name" autoCapitalize="words" enterKeyHint="next"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            className="h-[52px] rounded-xl"
            {...register("name")}
          />
          {errors.name && (
            <p id="name-error" role="alert" className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="anim-fade-up space-y-1.5" style={{ animationDelay: "250ms" }}>
          <Label htmlFor="phone">Mobile number</Label>
          <Controller
            control={control}
            name="phone"
            defaultValue=""
            render={({ field }) => (
              <PhoneField
                id="phone"
                defaultCountry={region.country || "IN"}
                onChange={field.onChange}
                invalid={!!errors.phone}
                describedBy={errors.phone ? "phone-error" : "phone-hint"}
              />
            )}
          />
          {errors.phone ? (
            <p id="phone-error" role="alert" className="text-xs text-destructive">{errors.phone.message}</p>
          ) : (
            <p id="phone-hint" className="text-xs text-muted-foreground">
              {region.isIndia || region.dial ? "Required. Kept private — never shown to other people." : "Required. Choose your country code first. Kept private — never shown to other people."}
            </p>
          )}
        </div>

        <div className="anim-fade-up space-y-1.5" style={{ animationDelay: "280ms" }}>
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

        <div className="anim-fade-up space-y-1.5" style={{ animationDelay: "340ms" }}>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Min. 8 characters"
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
            autoComplete="new-password" enterKeyHint="go"
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
          loading={isSubmitting}
        >
          Create account
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          By signing up, you agree to our{" "}
          <Link href="/terms" className="text-primary hover:underline">Terms</Link>
          {" "}and{" "}
          <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
        </p>
      </form>

      <div className="anim-fade-up mt-auto space-y-3 pt-2" style={{ animationDelay: "480ms" }}>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="-my-2 inline-block py-2 font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/80">
          <ShieldCheck className="size-3.5" aria-hidden="true" /> Secure sign-up · No ads · Free forever
        </p>
      </div>

    </m.div>
  );
}

export default function SignupForm() {
  return (
    <Suspense>
      <SignupFormContent />
    </Suspense>
  );
}

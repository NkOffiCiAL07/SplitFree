"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, Zap } from "lucide-react";

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

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type LoginValues = z.infer<typeof loginSchema>;

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginValues) => {
    const { error } = await signInWithEmail(values.email, values.password);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
    router.push(redirect);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast.error(error.message);
      setGoogleLoading(false);
    }
  };

  const handleDevBypass = async () => {
    setDevLoading(true);
    try {
      const res = await fetch("/api/dev-login", { method: "POST" });
      const json = await res.json();
      if (json.error) { toast.error(json.error); return; }
      const { error } = await signInWithEmail(json.email, json.password);
      if (error) { toast.error(error.message); return; }
      toast.success("Signed in as dev user");
      router.push(redirect);
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 lg:hidden mb-6">
          <div className="w-7 h-7 gradient-brand rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="font-semibold">SplitFree</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your account to continue
        </p>
      </div>

      {/* Google */}
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={handleGoogle}
        loading={googleLoading}
      >
        <GoogleIcon />
        Continue with Google
      </Button>

      <div className="relative">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
          or
        </span>
      </div>

      {/* Email form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            startIcon={<Mail />}
            autoComplete="email"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/reset-password"
              className="text-xs text-primary hover:underline"
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
                className="hover:text-foreground"
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            }
            autoComplete="current-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          variant="brand"
          size="lg"
          loading={isSubmitting}
        >
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-primary font-medium hover:underline">
          Sign up free
        </Link>
      </p>

      {process.env.NODE_ENV === "development" && (
        <div className="pt-2 border-t border-dashed">
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20"
            onClick={handleDevBypass}
            loading={devLoading}
          >
            <Zap className="size-4" /> Dev bypass — skip login
          </Button>
          <p className="text-[10px] text-center text-muted-foreground mt-1.5">Only visible in development</p>
        </div>
      )}
    </motion.div>
  );
}

export default function LoginForm() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, CheckCircle2, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const requestSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

const updateSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: "Passwords do not match",
  path: ["confirm"],
});

type RequestForm = z.infer<typeof requestSchema>;
type UpdateForm = z.infer<typeof updateSchema>;

function RequestResetForm() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<RequestForm>({
    resolver: zodResolver(requestSchema),
  });

  const onSubmit = async (data: RequestForm) => {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password/update`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-4"
      >
        <div className="w-14 h-14 gradient-brand rounded-2xl flex items-center justify-center mx-auto">
          <CheckCircle2 className="size-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-sm text-muted-foreground mt-2">
            We sent a password reset link. Check your inbox and click the link to continue.
          </p>
        </div>
        <Link href="/login">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="size-4" /> Back to sign in
          </Button>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Forgot your password?</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            startIcon={<Mail />}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <Button type="submit" variant="brand" className="w-full" loading={loading}>
          Send reset link
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}

function UpdatePasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<UpdateForm>({
    resolver: zodResolver(updateSchema),
  });

  const onSubmit = async (data: UpdateForm) => {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: data.password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated! Please sign in.");
    router.push("/login");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Set new password</h1>
        <p className="text-sm text-muted-foreground">Choose a strong password for your account.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Min. 8 characters"
            startIcon={<Lock />}
            endIcon={
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type={showPassword ? "text" : "password"}
            placeholder="Repeat password"
            startIcon={<Lock />}
            {...register("confirm")}
          />
          {errors.confirm && (
            <p className="text-xs text-destructive">{errors.confirm.message}</p>
          )}
        </div>

        <Button type="submit" variant="brand" className="w-full" loading={loading}>
          Update password
        </Button>
      </form>
    </motion.div>
  );
}

function Inner() {
  const searchParams = useSearchParams();
  const isUpdate = searchParams.get("mode") === "update" || typeof window !== "undefined"
    && window.location.pathname.includes("/update");

  if (isUpdate) return <UpdatePasswordForm />;
  return <RequestResetForm />;
}

export function ResetPasswordForm() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}

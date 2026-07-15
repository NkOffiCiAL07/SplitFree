"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Users, Receipt, Zap, LogIn, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";

const CATEGORY_EMOJI: Record<string, string> = {
  HOME: "🏠", TRIP: "✈️", COUPLE: "💑", FRIENDS: "👫", WORK: "💼", OTHER: "📦",
};

export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [group, setGroup] = useState<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "joining" | "joined" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch(`/api/join/${token}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) { setErrorMsg(j.error.message ?? j.error); setStatus("error"); }
        else { setGroup(j.data); setStatus("ready"); }
      })
      .catch(() => { setErrorMsg("Failed to load invite."); setStatus("error"); });
  }, [token]);

  const handleJoin = async () => {
    if (!user) {
      router.push(`/signup?redirect=/join/${token}`);
      return;
    }
    setStatus("joining");
    const res = await fetch(`/api/join/${token}`, { method: "POST" });
    const json = await res.json();
    if (json.error) {
      setErrorMsg(json.error.message ?? json.error);
      setStatus("error");
    } else {
      setStatus("joined");
      setTimeout(() => router.push(`/groups/${json.data.groupId}`), 1500);
    }
  };

  if (authLoading || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center">
          <Zap className="size-4 text-white" />
        </div>
        <span className="font-bold text-base">SplitFree</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {status === "error" ? (
          <div className="text-center space-y-3 p-8 rounded-2xl border bg-card">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto">
              <span className="text-2xl">❌</span>
            </div>
            <h2 className="text-lg font-bold">Invalid invite</h2>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button variant="brand" asChild className="w-full mt-2">
              <Link href="/">Go home</Link>
            </Button>
          </div>
        ) : status === "joined" ? (
          <div className="text-center space-y-3 p-8 rounded-2xl border bg-card">
            <div className="w-14 h-14 bg-green-100 dark:bg-green-900/20 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="size-7 text-green-600" />
            </div>
            <h2 className="text-lg font-bold">You&apos;re in!</h2>
            <p className="text-sm text-muted-foreground">Redirecting to the group…</p>
          </div>
        ) : group ? (
          <div className="rounded-2xl border bg-card overflow-hidden shadow-lg">
            {/* Group header */}
            <div className="gradient-brand p-6 text-center text-white">
              <div className="text-4xl mb-2">{CATEGORY_EMOJI[group.category] ?? "📦"}</div>
              <h1 className="text-xl font-bold">{group.name}</h1>
              {group.description && <p className="text-sm text-white/80 mt-1">{group.description}</p>}
            </div>

            <div className="p-6 space-y-5">
              <p className="text-center text-sm text-muted-foreground">
                You&apos;ve been invited to join this group on SplitFree
              </p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/50 p-3 text-center">
                  <Users className="size-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-lg font-bold">{group._count?.members ?? 0}</p>
                  <p className="text-xs text-muted-foreground">members</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3 text-center">
                  <Receipt className="size-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-lg font-bold">{group._count?.expenses ?? 0}</p>
                  <p className="text-xs text-muted-foreground">expenses</p>
                </div>
              </div>

              {user ? (
                <Button
                  variant="brand"
                  className="w-full"
                  onClick={handleJoin}
                  loading={status === "joining"}
                >
                  <CheckCircle2 className="size-4 mr-1.5" /> Join group
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button variant="brand" className="w-full" onClick={handleJoin}>
                    <LogIn className="size-4 mr-1.5" /> Sign up &amp; join
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Already have an account?{" "}
                    <Link href={`/login?redirect=/join/${token}`} className="text-primary hover:underline">Sign in</Link>
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}

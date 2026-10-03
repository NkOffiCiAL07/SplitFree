"use client";

import { BrandLogo } from "@/components/shared/brand-logo";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { m } from "framer-motion";
import { Users, Receipt, Zap, LogIn, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { APP_NAME } from "@/lib/app-config";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";

const CATEGORY_EMOJI: Record<string, string> = {
  HOME: "🏠", TRIP: "✈️", COUPLE: "💑", FRIENDS: "👫", WORK: "💼", OTHER: "📦",
};

const CONFETTI_COLORS = ["#ffffff", "#fbbf24", "#34d399", "#f472b6", "#818cf8", "#fb923c", "#60a5fa"];
const FLOAT_EMOJIS = ["🎉", "✨", "🥳", "💫", "🎊", "⭐", "🎈"];

function useParticles(count: number) {
  const [particles] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.9,
      duration: 1.4 + Math.random() * 1.8,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      w: 5 + Math.random() * 9,
      h: 6 + Math.random() * 14,
      rotate: Math.random() * 360,
    }))
  );
  return particles;
}

export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [group, setGroup] = useState<{ id: string; name: string; description?: string | null; category?: string; currency?: string; _count?: { members: number; expenses: number } } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "joining" | "joined" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const particles = useParticles(45);

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
    if (!user) { router.push(`/signup?redirect=/join/${token}`); return; }
    setStatus("joining");
    const res = await fetch(`/api/join/${token}`, { method: "POST" });
    const json = await res.json();
    if (json.error) {
      setErrorMsg(json.error.message ?? json.error);
      setStatus("error");
    } else {
      setStatus("joined");
      setTimeout(() => router.push(`/groups/${json.data.groupId}`), 2800);
    }
  };

  /* ── Celebration screen ── */
  if (status === "joined") {
    return (
      <div className="fixed inset-0 gradient-brand overflow-hidden flex flex-col items-center justify-center">
        {/* Confetti rain */}
        {particles.map((p) => (
          <m.div
            key={p.id}
            className="absolute rounded-sm pointer-events-none"
            style={{ left: `${p.x}%`, top: 0, width: p.w, height: p.h, backgroundColor: p.color }}
            initial={{ y: -80, opacity: 1, rotate: p.rotate }}
            animate={{ y: "110vh", opacity: [1, 1, 0.4, 0], rotate: p.rotate + 540 }}
            transition={{ duration: p.duration, delay: p.delay, ease: "easeIn", repeat: Infinity, repeatDelay: 0.3 }}
          />
        ))}

        {/* Center content */}
        <div className="relative z-10 flex flex-col items-center gap-6 text-center px-8">
          {/* Check with pulse rings */}
          <m.div
            className="relative flex items-center justify-center"
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}
          >
            {[1, 2, 3].map((ring) => (
              <m.div
                key={ring}
                className="absolute rounded-full border-2 border-white/25"
                style={{ width: 96, height: 96 }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.5 + ring * 0.7, opacity: [0, 0.55, 0] }}
                transition={{ duration: 1.6, delay: ring * 0.22, repeat: Infinity, repeatDelay: 0.6 }}
              />
            ))}
            <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center ring-4 ring-white/30">
              <CheckCircle2 className="size-14 text-white drop-shadow-lg" />
            </div>
          </m.div>

          {/* Floating emojis */}
          {FLOAT_EMOJIS.map((emoji, i) => (
            <m.span
              key={i}
              className="absolute text-3xl pointer-events-none select-none"
              initial={{ opacity: 0, y: 0, x: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: [-10, -70 - i * 18, -130 - i * 28],
                x: [(i - 3) * 38, (i - 3) * 58, (i - 3) * 75],
                scale: [0, 1.4, 1, 0],
              }}
              transition={{ delay: 0.25 + i * 0.09, duration: 1.9 }}
            >
              {emoji}
            </m.span>
          ))}

          {/* Headline */}
          <m.div
            className="space-y-2"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, type: "spring", stiffness: 180 }}
          >
            <h1 className="text-4xl font-black text-white tracking-tight">You&apos;re in! 🎉</h1>
            <p className="text-white/80 text-lg">
              Welcome to <span className="font-bold text-white">{group?.name}</span>
            </p>
            <p className="text-white/50 text-sm">{APP_NAME} — split expenses, not friendships</p>
          </m.div>

          {/* Pulsing dots + caption */}
          <m.div
            className="flex flex-col items-center gap-3 mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
          >
            <div className="flex gap-1.5">
              {[0, 1, 2].map((d) => (
                <m.div
                  key={d}
                  className="w-2 h-2 rounded-full bg-white"
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.25, 0.8] }}
                  transition={{ duration: 0.85, repeat: Infinity, delay: d * 0.27 }}
                />
              ))}
            </div>
            <p className="text-white/50 text-sm">Taking you to the group…</p>
          </m.div>
        </div>
      </div>
    );
  }

  /* ── Loading ── */
  if (authLoading || status === "loading") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4">
        <m.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-12 h-12 gradient-brand rounded-2xl flex items-center justify-center shadow-lg"
        >
          <Zap className="size-6 text-white" />
        </m.div>
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </m.div>
      </div>
    );
  }

  /* ── Invite card ── */
  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center p-4">
      <Link href="/" className="mb-10">
        <BrandLogo size={36} />
      </Link>

      <m.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        className="w-full max-w-sm"
      >
        {status === "error" ? (
          <div className="text-center space-y-3 p-8 rounded-2xl border bg-card shadow-lg">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto text-2xl">❌</div>
            <h2 className="text-lg font-bold">Invalid invite</h2>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button variant="brand" asChild className="w-full mt-2"><Link href="/">Go home</Link></Button>
          </div>
        ) : group ? (
          <div className="rounded-2xl border bg-card overflow-hidden shadow-xl">
            {/* Group hero */}
            <div className="gradient-brand p-8 text-center text-white relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/10 pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-44 h-44 rounded-full bg-white/10 pointer-events-none" />
              <div className="relative z-10">
                <m.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.12 }}
                  className="text-5xl mb-3"
                >
                  {CATEGORY_EMOJI[group.category ?? "OTHER"] ?? "📦"}
                </m.div>
                <m.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl font-bold"
                >
                  {group.name}
                </m.h1>
                {group.description && (
                  <m.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.28 }}
                    className="text-sm text-white/80 mt-1.5"
                  >
                    {group.description}
                  </m.p>
                )}
              </div>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-center text-sm text-muted-foreground">
                You&apos;ve been invited to join this group on{" "}
                <span className="font-semibold text-foreground">{APP_NAME}</span>
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/50 p-3 text-center">
                  <Users className="size-4 mx-auto mb-1 text-primary" />
                  <p className="text-lg font-bold">{group._count?.members ?? 0}</p>
                  <p className="text-xs text-muted-foreground">members</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3 text-center">
                  <Receipt className="size-4 mx-auto mb-1 text-primary" />
                  <p className="text-lg font-bold">{group._count?.expenses ?? 0}</p>
                  <p className="text-xs text-muted-foreground">expenses</p>
                </div>
              </div>

              {user ? (
                <Button variant="brand" className="w-full gap-2" onClick={handleJoin} loading={status === "joining"}>
                  <Sparkles className="size-4" /> Join {group.name}
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button variant="brand" className="w-full gap-2" onClick={handleJoin}>
                    <LogIn className="size-4" /> Sign up &amp; join
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
      </m.div>
    </div>
  );
}

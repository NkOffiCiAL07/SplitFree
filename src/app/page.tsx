"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Zap, Users, BarChart3, Shield, Smartphone,
  ArrowRight, Check, SplitSquareHorizontal, Play, Star,
  Globe, RefreshCw, Sparkles, Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const features = [
  {
    icon: Users,
    title: "Groups & Friends",
    description: "Create groups for trips, home, or any occasion. Track debts with anyone — no more awkward money talks.",
    color: "from-violet-500 to-purple-600",
    bg: "bg-violet-500/8",
  },
  {
    icon: SplitSquareHorizontal,
    title: "Smart Splitting",
    description: "Split equally, by exact amount, percentage, or custom shares. Every real-world scenario covered.",
    color: "from-blue-500 to-indigo-600",
    bg: "bg-blue-500/8",
  },
  {
    icon: BarChart3,
    title: "Spending Analytics",
    description: "Visualize your spending patterns with beautiful charts. Know exactly where your money goes.",
    color: "from-emerald-500 to-teal-600",
    bg: "bg-emerald-500/8",
  },
  {
    icon: Zap,
    title: "Debt Simplification",
    description: "Our minimum cash-flow algorithm reduces 10 payments to just 3. Fewer transfers, less hassle.",
    color: "from-amber-500 to-orange-600",
    bg: "bg-amber-500/8",
  },
  {
    icon: RefreshCw,
    title: "Recurring Expenses",
    description: "Set rent, subscriptions, or EMIs on auto-pilot. Never manually re-enter a monthly expense again.",
    color: "from-rose-500 to-pink-600",
    bg: "bg-rose-500/8",
  },
  {
    icon: Globe,
    title: "Multi-Currency",
    description: "Traveling abroad? Switch currencies per group. Your home currency stays the default everywhere else.",
    color: "from-cyan-500 to-sky-600",
    bg: "bg-cyan-500/8",
  },
  {
    icon: Smartphone,
    title: "Works Everywhere",
    description: "Install on any device like a native app. Fast, lightweight, and works great on mobile.",
    color: "from-indigo-500 to-violet-600",
    bg: "bg-indigo-500/8",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "Your data is encrypted at rest and never sold. No ads, no upsells — free forever, period.",
    color: "from-green-500 to-emerald-600",
    bg: "bg-green-500/8",
  },
];

const steps = [
  {
    number: "01",
    icon: Users,
    title: "Create a group",
    description: "Add your roommates, travel buddies, or friends in seconds. Share an invite link — they join instantly.",
  },
  {
    number: "02",
    icon: SplitSquareHorizontal,
    title: "Log expenses",
    description: "Add any expense and choose how to split — equal, exact amounts, percentages, or weighted shares.",
  },
  {
    number: "03",
    icon: Zap,
    title: "Settle up",
    description: "See exactly who owes what. Our algorithm simplifies debts to the fewest possible transfers.",
  },
];

const testimonials = [
  {
    text: "Finally ditched Splitwise! SplitFree has everything I need and the debt simplification saved us 6 extra bank transfers on our Goa trip alone.",
    name: "Ananya S.",
    role: "Product Designer, Bangalore",
    avatar: "A",
    color: "bg-violet-500",
    stars: 5,
  },
  {
    text: "Love that it's genuinely free — no premium popups every time I open the app. The analytics tab helped me realize we were spending ₹8k/month on food delivery.",
    name: "Rohan M.",
    role: "Software Engineer, Pune",
    avatar: "R",
    color: "bg-emerald-500",
    stars: 5,
  },
  {
    text: "My flatmates and I use this every month. Setting up recurring expenses for rent and internet took 2 minutes and now it just happens automatically.",
    name: "Kavya T.",
    role: "CA Student, Mumbai",
    avatar: "K",
    color: "bg-rose-500",
    stars: 5,
  },
];

const stats = [
  { value: "5,000+", label: "Expenses tracked" },
  { value: "500+", label: "Groups created" },
  { value: "15+", label: "Currencies supported" },
  { value: "₹0", label: "Cost. Forever." },
];


const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function DemoButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDemo = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/demo-login", { method: "POST" });
      const json = await res.json();
      if (json.error) { toast.error("Demo not available right now"); return; }
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: json.email, password: json.password });
      if (error) { toast.error("Demo login failed"); return; }
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="xl"
      className="w-full sm:w-auto px-8 h-12 text-base gap-2"
      onClick={handleDemo}
      disabled={loading}
    >
      <Play className="size-4" />
      {loading ? "Loading demo…" : "Try demo — no signup"}
    </Button>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 gradient-brand rounded-lg flex items-center justify-center">
              <Zap className="size-3.5 text-white" />
            </div>
            <span className="font-bold text-base">SplitFree</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="hidden sm:flex" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button variant="brand" size="sm" asChild>
              <Link href="/signup"><span className="hidden sm:inline">Get started free</span><span className="sm:hidden">Sign up</span></Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16 pb-28 px-4">
        {/* Background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-violet-500/10 rounded-full blur-3xl" />
          <div className="absolute top-24 right-1/4 w-[500px] h-[500px] bg-indigo-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] bg-purple-500/6 rounded-full blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.018] dark:opacity-[0.035]"
            style={{ backgroundImage: "radial-gradient(circle, #6d28d9 1px, transparent 1px)", backgroundSize: "32px 32px" }}
          />
        </div>

        <motion.div
          initial="hidden"
          animate="show"
          variants={container}
          className="max-w-3xl mx-auto text-center space-y-6"
        >
          <motion.h1
            variants={item}
            className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] text-balance"
          >
            Split expenses,{" "}
            <span className="gradient-brand-text">not friendships.</span>
          </motion.h1>

          <motion.p
            variants={item}
            className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed"
          >
            The free, beautiful alternative to Splitwise. Track shared costs, simplify debts, and settle up — zero ads, zero paywalls, forever.
          </motion.p>

          <motion.div variants={item} className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button variant="brand" size="xl" className="w-full sm:w-auto px-8 h-12 text-base" asChild>
              <Link href="/signup">
                Start splitting for free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <DemoButton />
          </motion.div>

          <motion.div
            variants={item}
            className="flex items-center justify-center gap-8 pt-2 text-xs text-muted-foreground"
          >
            {["No credit card", "Free forever", "Mobile friendly"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check className="size-3.5 text-green-500" />
                {t}
              </span>
            ))}
          </motion.div>
        </motion.div>

        {/* Dashboard preview */}
        <motion.div
          initial={{ opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-5xl mx-auto mt-16"
        >
          <div className="rounded-2xl border bg-card shadow-[0_32px_80px_-16px_rgba(109,40,217,0.18)] dark:shadow-[0_32px_80px_-16px_rgba(109,40,217,0.3)] overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b bg-muted/40">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <div className="flex-1 mx-6 bg-background/80 border rounded-md px-3 py-1 text-[11px] text-muted-foreground text-center max-w-xs mx-auto">
                splitfree.app/dashboard
              </div>
            </div>
            {/* Mock dashboard */}
            <div className="p-5 space-y-4 bg-background/50">
              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Owed to You", value: "₹2,400", color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10 border-green-500/20" },
                  { label: "You Owe Others", value: "₹850", color: "text-red-500 dark:text-red-400", bg: "bg-red-500/10 border-red-500/20" },
                  { label: "Active Groups", value: "4", color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
                  { label: "Net Balance", value: "+₹1,550", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`rounded-xl border p-3 sm:p-3.5 space-y-1 ${bg}`}>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground">{label}</p>
                    <p className={`text-base sm:text-lg font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
              {/* Main content */}
              <div className="rounded-xl border bg-card p-4">
                <p className="text-xs font-medium mb-3 text-muted-foreground">Recent expenses</p>
                <div className="space-y-2">
                  {[
                    { emoji: "🍔", name: "Dinner at Barbeque Nation", amount: "₹1,800", share: "your share −₹600", color: "text-red-500" },
                    { emoji: "🏨", name: "Hotel booking — Goa trip", amount: "₹6,500", share: "you lent +₹2,166", color: "text-green-600 dark:text-green-400" },
                    { emoji: "🚗", name: "Ola cab to airport", amount: "₹340", share: "your share −₹170", color: "text-red-500" },
                  ].map(({ emoji, name, amount, share, color }) => (
                    <div key={name} className="flex items-center gap-2.5 py-1.5 border-b border-border/40 last:border-0">
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-sm flex-shrink-0">{emoji}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{name}</p>
                        <p className={`text-[10px] ${color}`}>{share}</p>
                      </div>
                      <p className="text-xs font-semibold flex-shrink-0">{amount}</p>
                    </div>
                  ))}
                </div>
                {/* Who owes who — inline row below on mobile, hidden on very small */}
                <div className="mt-3 pt-3 border-t flex items-center justify-between gap-3">
                  <p className="text-[10px] font-medium text-muted-foreground shrink-0">Balances</p>
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {[
                      { name: "Rahul", amount: "+₹850", color: "bg-emerald-500" },
                      { name: "Priya", amount: "−₹320", color: "bg-rose-400" },
                      { name: "Aditya", amount: "+₹700", color: "bg-emerald-500" },
                    ].map(({ name, amount, color }) => (
                      <div key={name} className="flex items-center gap-1 shrink-0">
                        <div className={`w-5 h-5 rounded-full ${color} flex items-center justify-center text-[8px] text-white font-bold`}>{name[0]}</div>
                        <span className={`text-[10px] font-semibold ${amount.startsWith("+") ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>{amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Stats bar */}
      <section className="border-y bg-muted/30 py-12 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map(({ value, label }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <p className="text-3xl font-bold gradient-brand-text">{value}</p>
              <p className="text-sm text-muted-foreground mt-1">{label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <p className="text-sm font-medium text-violet-600 dark:text-violet-400 mb-2 flex items-center justify-center gap-1.5">
              <span className="w-4 h-px bg-violet-500/50" />
              How it works
              <span className="w-4 h-px bg-violet-500/50" />
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold">Up and running in minutes</h2>
            <p className="text-muted-foreground mt-3 max-w-md mx-auto">No setup, no configuration — just create a group and start splitting.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-10 left-[calc(16.6%+2rem)] right-[calc(16.6%+2rem)] h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            {steps.map(({ number, icon: Icon, title, description }, i) => (
              <motion.div
                key={number}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.12 }}
                className="text-center relative group"
              >
                <div className="w-20 h-20 gradient-brand rounded-2xl flex flex-col items-center justify-center mx-auto mb-5 shadow-lg shadow-violet-500/25 relative z-10 transition-transform group-hover:-translate-y-1 duration-200">
                  <span className="text-[10px] font-bold text-white/70 leading-none">{number}</span>
                  <Icon className="size-6 text-white mt-1" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <p className="text-sm font-medium text-violet-600 dark:text-violet-400 mb-2 flex items-center justify-center gap-1.5">
              <span className="w-4 h-px bg-violet-500/50" />
              Features
              <span className="w-4 h-px bg-violet-500/50" />
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Everything you need, nothing you don&apos;t</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              All the power of expensive expense-tracking apps — completely free, no strings attached.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map(({ icon: Icon, title, description, color, bg }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="group rounded-2xl border bg-card p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
              >
                <div className={`w-11 h-11 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center mb-4 shadow-sm transition-transform group-hover:scale-110 duration-200`}>
                  <Icon className="size-5 text-white" />
                </div>
                <h3 className="font-semibold mb-1.5">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <p className="text-sm font-medium text-violet-600 dark:text-violet-400 mb-2 flex items-center justify-center gap-1.5">
              <span className="w-4 h-px bg-violet-500/50" />
              Loved by users
              <span className="w-4 h-px bg-violet-500/50" />
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold">Real people, real savings</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map(({ text, name, role, avatar, color, stars }, i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="rounded-2xl border bg-card p-6 flex flex-col gap-4 hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: stars }).map((_, j) => (
                    <Star key={j} className="size-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <div className="relative">
                  <Quote className="absolute -top-1 -left-1 size-5 text-violet-500/20" />
                  <p className="text-sm text-muted-foreground leading-relaxed pl-3">{text}</p>
                </div>
                <div className="flex items-center gap-3 mt-auto pt-2 border-t">
                  <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-xs text-white font-bold flex-shrink-0`}>
                    {avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="text-[11px] text-muted-foreground">{role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative rounded-3xl overflow-hidden"
          >
            {/* Gradient background */}
            <div className="absolute inset-0 gradient-brand opacity-90" />
            <div className="absolute inset-0">
              <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
              <div
                className="absolute inset-0 opacity-10"
                style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
              />
            </div>
            <div className="relative text-center px-8 py-16 text-white">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-medium mb-6">
                <Sparkles className="size-3" />
                Free forever · No credit card needed
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 tracking-tight">
                Stop chasing your friends for money.
              </h2>
              <p className="text-white/80 text-lg mb-8 max-w-lg mx-auto leading-relaxed">
                Join thousands of groups already splitting smarter. Takes 30 seconds to set up.
              </p>
              <Button
                variant="secondary"
                size="xl"
                className="px-10 h-12 text-base font-semibold bg-white text-violet-700 hover:bg-white/90 border-0"
                asChild
              >
                <Link href="/signup">
                  Get started — it&apos;s free
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10 px-4 bg-muted/20">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-6">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-7 h-7 gradient-brand rounded-lg flex items-center justify-center">
                <Zap className="size-3.5 text-white" />
              </div>
              <div>
                <span className="font-bold text-sm">SplitFree</span>
                <p className="text-[10px] text-muted-foreground">Free expense splitting for everyone</p>
              </div>
            </Link>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
              <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            </div>
          </div>
          <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} SplitFree. Built with ❤️ for people who hate awkward money conversations.</p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span>All systems operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

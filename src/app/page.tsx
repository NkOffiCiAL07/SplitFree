"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Zap, Users, Receipt, BarChart3, Shield, Smartphone,
  ArrowRight, Check, Star, SplitSquareHorizontal, Wallet, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const features = [
  {
    icon: Users,
    title: "Groups & Friends",
    description: "Create groups for trips, home, or any occasion. Track debts with anyone — no more awkward money talks.",
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: SplitSquareHorizontal,
    title: "Smart Splitting",
    description: "Split equally, by exact amount, percentage, or custom shares. Every scenario covered.",
    color: "from-blue-500 to-indigo-600",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "Visualize your spending patterns with beautiful charts. Know exactly where your money goes.",
    color: "from-emerald-500 to-teal-600",
  },
  {
    icon: Zap,
    title: "Debt Simplification",
    description: "Our smart algorithm minimizes transactions. Instead of 10 payments, settle with just 3.",
    color: "from-amber-500 to-orange-600",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "Your data is encrypted and never sold. No ads, no upsells — free forever, period.",
    color: "from-rose-500 to-pink-600",
  },
  {
    icon: Smartphone,
    title: "Works Everywhere",
    description: "PWA-ready — install on any device. Works offline, syncs when you're back online.",
    color: "from-cyan-500 to-sky-600",
  },
];

const steps = [
  {
    number: "01",
    title: "Create a group",
    description: "Add your roommates, travel buddies, or friends to a shared group in seconds.",
  },
  {
    number: "02",
    title: "Log expenses",
    description: "Add any expense and choose how to split it — equal, exact, or by percentage.",
  },
  {
    number: "03",
    title: "Settle up",
    description: "See exactly who owes what. Record payments and clear all debts with one tap.",
  },
];

const comparison = [
  { feature: "Unlimited groups", us: true, them: false },
  { feature: "All split types", us: true, them: false },
  { feature: "Analytics & reports", us: true, them: false },
  { feature: "Debt simplification", us: true, them: false },
  { feature: "Export to CSV / PDF", us: true, them: false },
  { feature: "Zero ads", us: true, them: false },
  { feature: "Free forever", us: true, them: false },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

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
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button variant="brand" size="sm" asChild>
              <Link href="/signup">Get started free</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-28 px-4">
        {/* Background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-violet-500/8 rounded-full blur-3xl" />
          <div className="absolute top-32 right-1/4 w-[400px] h-[400px] bg-indigo-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-purple-500/6 rounded-full blur-3xl" />
          {/* Dot grid */}
          <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
            style={{ backgroundImage: "radial-gradient(circle, #6d28d9 1px, transparent 1px)", backgroundSize: "32px 32px" }}
          />
        </div>

        <motion.div
          initial="hidden"
          animate="show"
          variants={container}
          className="max-w-3xl mx-auto text-center space-y-6"
        >
          <motion.div variants={item}>
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-xs rounded-full">
              <Star className="size-3 fill-amber-400 text-amber-400" />
              Free forever · No ads · Open source
            </Badge>
          </motion.div>

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
            The free, beautiful alternative to Splitwise. Track shared costs, simplify debts, and settle up — zero ads, zero paywalls.
          </motion.p>

          <motion.div variants={item} className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button variant="brand" size="xl" className="w-full sm:w-auto px-8 h-12 text-base" asChild>
              <Link href="/signup">
                Start splitting for free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">No credit card required</p>
          </motion.div>

          <motion.div
            variants={item}
            className="flex items-center justify-center gap-8 pt-2 text-xs text-muted-foreground"
          >
            {["No credit card", "Free forever", "Works offline"].map((t) => (
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
          <div className="rounded-2xl border bg-card shadow-[0_32px_80px_-16px_rgba(109,40,217,0.15)] dark:shadow-[0_32px_80px_-16px_rgba(109,40,217,0.25)] overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b bg-muted/40">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <div className="flex-1 mx-6 bg-background/80 border rounded-md px-3 py-1 text-[11px] text-muted-foreground text-center max-w-xs mx-auto">
                splitfree-xi.vercel.app/dashboard
              </div>
            </div>
            {/* Mock dashboard */}
            <div className="p-5 space-y-4 bg-background/50">
              {/* Stat cards */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Total Owed", value: "₹2,400", color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
                  { label: "You Owe", value: "₹850", color: "text-red-500 dark:text-red-400", bg: "bg-red-500/10" },
                  { label: "Groups", value: "4", color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10" },
                  { label: "Net Balance", value: "+₹1,550", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`rounded-xl border p-3.5 space-y-1 ${bg}`}>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className={`text-lg font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
              {/* Main content */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 rounded-xl border bg-card p-4">
                  <p className="text-xs font-medium mb-3 text-muted-foreground">Recent expenses</p>
                  <div className="space-y-2">
                    {[
                      { emoji: "🍔", name: "Dinner at Barbeque Nation", amount: "₹1,800", share: "-₹600", color: "text-red-500" },
                      { emoji: "🏨", name: "Hotel booking — Goa trip", amount: "₹6,500", share: "+₹2,166", color: "text-green-600" },
                      { emoji: "🚗", name: "Ola cab to airport", amount: "₹340", share: "-₹170", color: "text-red-500" },
                    ].map(({ emoji, name, amount, share, color }) => (
                      <div key={name} className="flex items-center gap-2.5 py-1.5">
                        <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-sm">{emoji}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold">{amount}</p>
                          <p className={`text-[10px] ${color}`}>{share}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs font-medium mb-3 text-muted-foreground">Balances</p>
                  <div className="space-y-2.5">
                    {[
                      { name: "Rahul", amount: "+₹850", color: "bg-green-500" },
                      { name: "Priya", amount: "-₹320", color: "bg-red-400" },
                      { name: "Aditya", amount: "+₹700", color: "bg-green-500" },
                    ].map(({ name, amount, color }) => (
                      <div key={name} className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full ${color} flex items-center justify-center text-[9px] text-white font-bold`}>
                          {name[0]}
                        </div>
                        <span className="text-xs flex-1">{name}</span>
                        <span className={`text-[11px] font-semibold ${amount.startsWith("+") ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>{amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
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
            <p className="text-sm font-medium text-violet-600 dark:text-violet-400 mb-2">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Up and running in minutes</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-8 left-[calc(16.6%+1rem)] right-[calc(16.6%+1rem)] h-px bg-border" />
            {steps.map(({ number, title, description }, i) => (
              <motion.div
                key={number}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.12 }}
                className="text-center relative"
              >
                <div className="w-16 h-16 gradient-brand rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-violet-500/25 relative z-10">
                  <span className="text-xl font-bold text-white">{number}</span>
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
            <p className="text-sm font-medium text-violet-600 dark:text-violet-400 mb-2">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Everything you need, nothing you don't</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              All the power of expensive expense apps — completely free.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ icon: Icon, title, description, color }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="group rounded-2xl border bg-card p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className={`w-11 h-11 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center mb-4 shadow-sm`}>
                  <Icon className="size-5 text-white" />
                </div>
                <h3 className="font-semibold mb-1.5">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-24 px-4">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-sm font-medium text-violet-600 dark:text-violet-400 mb-2">Why SplitFree?</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Premium features, zero cost</h2>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border overflow-hidden"
          >
            <div className="grid grid-cols-3 bg-muted/50 px-6 py-3 text-xs font-semibold text-muted-foreground border-b">
              <span>Feature</span>
              <span className="text-center text-violet-600 dark:text-violet-400">SplitFree</span>
              <span className="text-center">Splitwise Free</span>
            </div>
            {comparison.map(({ feature, us, them }, i) => (
              <div key={feature} className={`grid grid-cols-3 px-6 py-3.5 text-sm items-center ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                <span className="text-foreground">{feature}</span>
                <span className="flex justify-center">
                  {us ? <Check className="size-4 text-green-500" /> : <X className="size-4 text-muted-foreground/40" />}
                </span>
                <span className="flex justify-center">
                  {them ? <Check className="size-4 text-green-500" /> : <X className="size-4 text-muted-foreground/40" />}
                </span>
              </div>
            ))}
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-center mt-8"
          >
            <Button variant="brand" size="lg" asChild>
              <Link href="/signup">
                Get started free — it takes 30 seconds
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10 px-4 bg-muted/20">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 gradient-brand rounded-lg flex items-center justify-center">
              <Zap className="size-3 text-white" />
            </div>
            <span className="font-medium text-foreground">SplitFree</span>
            <span>· Free expense splitting for everyone</span>
          </div>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">Sign up</Link>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

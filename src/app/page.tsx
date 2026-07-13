"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Zap, Users, Receipt, BarChart3, Shield, Smartphone,
  ArrowRight, Check, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const features = [
  {
    icon: Users,
    title: "Groups & Friends",
    description: "Create groups for trips, home, or any occasion. Track debts with anyone.",
  },
  {
    icon: Receipt,
    title: "Smart Splitting",
    description: "Split equally, by exact amount, percentage, or custom shares — your choice.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "Visualize your spending patterns and see where your money goes.",
  },
  {
    icon: Zap,
    title: "Debt Simplification",
    description: "Minimize transactions with our smart algorithm. Fewer payments, less hassle.",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "Your data is encrypted and never sold. Free forever, no ads.",
  },
  {
    icon: Smartphone,
    title: "Works Everywhere",
    description: "PWA-ready — install on any device and use it offline.",
  },
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
      <section className="relative overflow-hidden pt-20 pb-24 px-4">
        {/* Background glow */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-500/10 rounded-full blur-3xl" />
          <div className="absolute top-20 right-1/4 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial="hidden"
          animate="show"
          variants={container}
          className="max-w-4xl mx-auto text-center space-y-6"
        >
          <motion.div variants={item}>
            <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs mb-6">
              <Star className="size-3 fill-amber-400 text-amber-400" />
              Free forever · No ads · Open source
            </Badge>
          </motion.div>

          <motion.h1
            variants={item}
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-balance"
          >
            Split expenses,{" "}
            <span className="gradient-brand-text">not friendships.</span>
          </motion.h1>

          <motion.p
            variants={item}
            className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance"
          >
            The beautiful, free alternative to Splitwise. Track shared expenses
            with groups and friends — zero ads, zero paywalls, zero friction.
          </motion.p>

          <motion.div variants={item} className="flex justify-center pt-2">
            <Button variant="brand" size="xl" asChild>
              <Link href="/signup">
                Start splitting for free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </motion.div>

          <motion.div
            variants={item}
            className="flex items-center justify-center gap-6 pt-4 text-xs text-muted-foreground"
          >
            {["No credit card", "Free forever", "Works offline"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check className="size-3.5 text-green-500" />
                {t}
              </span>
            ))}
          </motion.div>
        </motion.div>

        {/* App preview mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 20 }}
          transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
          className="max-w-4xl mx-auto mt-16 relative"
        >
          <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden">
            {/* Fake browser chrome */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b bg-muted/50">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <div className="flex-1 mx-4 bg-background rounded px-3 py-1 text-xs text-muted-foreground text-center">
                splitfree.app/dashboard
              </div>
            </div>
            {/* Fake dashboard content */}
            <div className="p-6 grid grid-cols-4 gap-3 min-h-[220px]">
              {["Total Owed", "You Owe", "Groups", "Expenses"].map((label, i) => (
                <div key={label} className="rounded-xl border bg-background p-4 space-y-2">
                  <div className="h-2 w-16 skeleton rounded" />
                  <div className="h-5 w-20 skeleton rounded" />
                  <div className="h-2 w-12 skeleton rounded" />
                </div>
              ))}
              <div className="col-span-3 rounded-xl border bg-background p-4">
                <div className="h-2 w-24 skeleton rounded mb-4" />
                <div className="h-32 skeleton rounded-lg" />
              </div>
              <div className="rounded-xl border bg-background p-4">
                <div className="h-2 w-16 skeleton rounded mb-4" />
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-7 h-7 skeleton rounded-full" />
                      <div className="flex-1 space-y-1">
                        <div className="h-2 w-full skeleton rounded" />
                        <div className="h-1.5 w-2/3 skeleton rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold mb-3">Everything you need</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              All the features of Splitwise Premium, completely free.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, title, description }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                className="rounded-2xl border bg-card p-6 hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 gradient-brand rounded-xl flex items-center justify-center mb-4">
                  <Icon className="size-5 text-white" />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      {/* CTA */}
      <section className="py-24 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto text-center rounded-3xl gradient-brand p-12 relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 left-4 w-48 h-48 bg-white rounded-full blur-2xl" />
            <div className="absolute bottom-4 right-4 w-64 h-64 bg-white rounded-full blur-3xl" />
          </div>
          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-white mb-3">
              Start splitting today
            </h2>
            <p className="text-white/80 mb-8 text-balance">
              Join thousands of people who use SplitFree to manage shared
              expenses — no subscription required.
            </p>
            <Button
              size="xl"
              className="bg-white text-violet-700 hover:bg-white/90 font-semibold"
              asChild
            >
              <Link href="/signup">
                Create free account
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 gradient-brand rounded flex items-center justify-center">
              <Zap className="size-3 text-white" />
            </div>
            <span>SplitFree © 2024</span>
          </div>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { BrandLogo, BrandMark } from "@/components/shared/brand-logo";
import Link from "next/link";
import {
  Zap, Users, BarChart3, Shield, ArrowRight, Check, SplitSquareHorizontal, Globe, RefreshCw, Sparkles,
  WifiOff, QrCode, FileUp, History, Bell, UsersRound, ChevronDown, Smartphone, IndianRupee,
  Home, Receipt, UserPlus, Signal, Wifi, BatteryFull, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { DownloadPanel } from "@/components/landing/download-panel";
import { Reveal } from "@/components/landing/reveal";
import { SettleFlow } from "@/components/landing/settle-flow";
import { SplitTryout } from "@/components/landing/split-tryout";
import { PhoneDemo } from "@/components/landing/phone-demo";
import { IosNotify } from "@/components/landing/ios-notify";
import { ContinuityPill } from "@/components/landing/continuity-pill";
import { TripCard, type TripCardData } from "@/components/landing/trip-card";
import { ChatProblem, MomentsGrid, type ChatLine, type Moment } from "@/components/landing/moments";
import { MobileMenu } from "@/components/landing/mobile-menu";
import { OfflineSync } from "@/components/landing/offline-sync";
import { SplitwiseBanner } from "@/components/landing/splitwise-banner";
import { RotatingWords } from "@/components/landing/rotating-words";
import { AndroidDownloadButton, IosComingSoon } from "@/components/landing/store-badges";
import { APP_NAME } from "@/lib/app-config";
import { CURRENCY_CODES } from "@/lib/currencies";
import { brandCopy } from "@/lib/brand-copy";
import { regionFor } from "@/lib/region";

/** One small, real-looking picture per feature group (decorative) */
function GroupVisual({ id, sample }: { id: "split" | "settle" | "anywhere" | "yours"; sample: Sample }) {
  const box = "rounded-2xl border bg-background/60 p-3 text-xs";
  if (id === "split") {
    return (
      <div aria-hidden="true" data-visual={id} className={box}>
        <p className="mb-2 flex justify-between font-medium text-muted-foreground"><span>{sample.bill.title}</span><span className="tabular-nums text-foreground">{sample.bill.total}</span></p>
        <ul className="grid grid-cols-3 gap-2">
          {sample.bill.shares.map((s) => <li key={s.name} className="rounded-lg bg-muted/60 px-2 py-1.5 text-center"><span className="block text-muted-foreground">{s.name}</span><b className="tabular-nums">{s.amount}</b></li>)}
        </ul>
      </div>
    );
  }
  if (id === "settle") {
    return (
      <div aria-hidden="true" data-visual={id} className={`${box} flex items-center justify-between gap-2`}>
        <span className="rounded-lg bg-muted/60 px-2.5 py-1.5 font-semibold tabular-nums">10 payments</span>
        <ArrowRight className="size-4 text-violet-500" />
        <span className="rounded-lg bg-violet-500/15 px-2.5 py-1.5 font-semibold tabular-nums text-[#4f48e6] dark:text-[#a5a0ff]">3 payments</span>
      </div>
    );
  }
  if (id === "anywhere") {
    return (
      <div aria-hidden="true" data-visual={id} className={`${box} flex flex-wrap items-center gap-2`}>
        <span className="flex items-center gap-1 rounded-lg bg-amber-500/15 px-2.5 py-1.5 font-semibold text-amber-700 dark:text-amber-300"><WifiOff className="size-3.5" /> Offline</span>
        <ArrowRight className="size-3.5 text-muted-foreground" />
        <span className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-semibold text-emerald-700 dark:text-emerald-300"><Check className="size-3.5" /> Synced</span>
        <span className="ml-auto tabular-nums text-muted-foreground">INR · USD · EUR</span>
      </div>
    );
  }
  return (
    <div aria-hidden="true" data-visual={id} className={`${box} flex flex-wrap items-center gap-2`}>
      <span className="rounded-lg bg-muted/60 px-2.5 py-1.5 font-semibold">Settings → Export my data</span>
      <span className="rounded-lg bg-muted/60 px-2.5 py-1.5 font-semibold">Settings → Delete account</span>
    </div>
  );
}

/** Four big ideas, with the smaller features inside each */
const groupsFor = (feature4Title: string) => [
  { id: "split" as const, icon: SplitSquareHorizontal, color: "from-violet-500 to-indigo-600", title: "Split", lead: "Any bill, any way — and it always adds up exactly.", items: ["Equal", "Exact amounts", "Percentages", "Shares", "Several payers", "Recurring expenses", "Spending insights"] },
  { id: "settle" as const, icon: Zap, color: "from-amber-500 to-orange-600", title: "Settle", lead: "Fewer payments, paid the easy way.", items: [feature4Title, "Smart settle-up", "Gentle reminders", "Group budgets"] },
  { id: "anywhere" as const, icon: Globe, color: "from-sky-500 to-cyan-600", title: "Anywhere", lead: "On the trip, on the train, in any currency.", items: ["Works offline", `${CURRENCY_CODES.length} currencies`, "Android app", "iPhone soon", "Join by QR", "Splitwise import"] },
  { id: "yours" as const, icon: Shield, color: "from-emerald-500 to-teal-600", title: "Yours", lead: "Your money, your data.", items: ["No ads", "No selling your data", "Edit history", "Export or delete anytime"] },
];

/** The page's sections, for the header and the phone menu */
const NAV = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#download", label: "Download" },
];

const steps = [
  { number: "01", icon: UsersRound, title: "Create a group", description: "Add roommates, travel buddies or friends. Share an invite link or show a QR code — they join instantly." },
  { number: "02", icon: SplitSquareHorizontal, title: "Log expenses", description: "Add a bill and choose how to split it. Type “dinner 900 with Asha” and quick-add does the rest." },
  { number: "03", icon: Zap, title: "Settle up", description: "See exactly who pays whom. Pay by UPI, record it, and the balance clears." },
];

const faqs = [
  { q: "Is it really free?", a: `Yes. ${APP_NAME} has no ads and no paywalls.` },
  { q: "How do I install the Android app?", a: "Tap Download for Android, open the file, and allow “Install unknown apps” for your browser when Android asks (one-time). It's a direct download for now, so Android may show a standard warning for apps installed outside the Play Store." },
  { q: "Why is Android a direct download?", a: "It is the quickest way to get the app and its updates to you. Because it is installed from this site instead of the Play Store, Android shows a standard warning for apps from outside the store — that is normal for any direct download, and it is the only reason it appears." },
  { q: "What about iPhone?", a: "A native iOS app is coming soon. Until then, open the site in Safari and tap Share → Add to Home Screen: you get the full app, offline mode included." },
  { q: "Does it work without internet?", a: "Yes. You can look at your last-seen balances and add expenses or payments offline. They're stored on your device and synced automatically when you reconnect — without ever being duplicated." },
  { q: "Will my data be the same on web and Android?", a: "Yes — it's one account. Sign in on either and everything is there." },
];

/** Everything on the page that is a number, a name or an India-only idea (UPI), so the English version can say it in its own way. */
interface Sample {
  owed: string; owe: string;
  people: { name: string; note: string; amount: string; tone: string; bg: string }[];
  recent: { emoji: string; name: string; share: string; tone: string; amount: string }[];
  received: string; trip: string;
  bill: { title: string; total: string; shares: { name: string; amount: string }[] };
  payments: { from: string; to: string; amount: string }[];
  payChip: string;
  step3: string;
  featuresLead: string;
  exactLine: string;
  feature4: { icon: React.ElementType; title: string; description: string; color: string };
  tripCard: TripCardData;
  chat: ChatLine[];
  chatAnswer: string;
  moments: Moment[];
}

const RED = "text-[#e5485d] dark:text-rose-400";
const GREEN = "text-[#16a36a] dark:text-emerald-400";

const SAMPLE_IN: Sample = {
  owed: "₹1,190", owe: "₹1,200",
  people: [
    { name: "Himanshu", note: "you owe", amount: "₹1,200", tone: RED, bg: "bg-rose-400" },
    { name: "Divyansh", note: "owes you", amount: "₹850", tone: GREEN, bg: "bg-emerald-500" },
    { name: "Prakhar", note: "owes you", amount: "₹340", tone: GREEN, bg: "bg-indigo-500" },
  ],
  recent: [
    { emoji: "🍔", name: "Dinner at Barbeque Nation", share: "you owe ₹600", tone: RED, amount: "₹1,800" },
    { emoji: "🏨", name: "Hotel — Goa trip", share: "you lent ₹2,166", tone: GREEN, amount: "₹6,500" },
    { emoji: "🚗", name: "Ola cab to airport", share: "you owe ₹170", tone: RED, amount: "₹340" },
    { emoji: "☕", name: "Chai at Pune station", share: "you lent ₹60", tone: GREEN, amount: "₹120" },
  ],
  received: "₹850 · UPI", trip: "Goa trip",
  bill: { title: "Dinner at Barbeque Nation", total: "₹1,800", shares: [{ name: "You", amount: "₹600" }, { name: "Divyansh", amount: "₹600" }, { name: "Prakhar", amount: "₹600" }] },
  payments: [{ from: "Rohan", to: "Ananya", amount: "₹2,400" }, { from: "Kavya", to: "Ananya", amount: "₹1,150" }, { from: "Aditya", to: "Rohan", amount: "₹600" }],
  payChip: "UPI",
  step3: "See exactly who pays whom. Pay by UPI, record it, and the balance clears.",
  featuresLead: "Built around how people in India actually share money — and it handles the awkward cases too.",
  exactLine: "Splits always add up to the exact paisa — no rupee ever appears or vanishes.",
  tripCard: { name: "Goa trip", emoji: "🏝️", total: "₹18,450", people: 4, youGet: "₹2,840", from: "from 3 people" },
  chat: [
    { who: "Rohan", text: "Guys, who paid for the hotel?" },
    { who: "Kavya", text: "Bhai ₹650 bhej dena, yaad se" },
    { who: "Aditya", text: "Wait, who owes me from the cab?" },
    { who: "Ananya", text: "I'll make a spreadsheet 😩" },
  ],
  chatAnswer: "Splitr keeps the tally, does the awkward math, and tells everyone exactly what to pay — so nobody has to ask.",
  moments: [
    { emoji: "🏝️", title: "Goa trip", meta: "₹18,450 · 4 people", example: "Hotel ₹8,400 ÷ 4 = ₹2,100 each", net: "₹2,840", tone: "get" },
    { emoji: "🏠", title: "Flat rent", meta: "₹32,000 · 3 people", example: "Rent added every month, split three ways", net: "₹10,667", tone: "owe" },
    { emoji: "☕", title: "Chai-nashta", meta: "₹420 · 6 people", example: "Chai for the whole table, one tap", net: "₹70", tone: "owe" },
    { emoji: "💍", title: "Shaadi kharcha", meta: "₹64,000 · 8 people", example: "Gifts and travel, split with cousins", net: "₹8,000", tone: "get" },
    { emoji: "🍕", title: "Weekend dinner", meta: "₹1,800 · 4 people", example: "Bill ₹1,800, ₹450 each", net: "₹450", tone: "owe" },
    { emoji: "🏏", title: "Cricket night", meta: "₹2,400 · 10 people", example: "Snacks and a turf booking, settled", net: "₹2,160", tone: "get" },
  ],
  feature4: { icon: IndianRupee, title: "UPI in one tap", description: "Save your UPI ID and friends can pay you straight from GPay, PhonePe or Paytm.", color: "from-emerald-500 to-teal-600" },
};

const SAMPLE_INTL: Sample = {
  owed: "$33", owe: "$32",
  people: [
    { name: "Mia", note: "you owe", amount: "$32", tone: RED, bg: "bg-rose-400" },
    { name: "Liam", note: "owes you", amount: "$24", tone: GREEN, bg: "bg-emerald-500" },
    { name: "Noah", note: "owes you", amount: "$9", tone: GREEN, bg: "bg-indigo-500" },
  ],
  recent: [
    { emoji: "🍔", name: "Dinner at Luigi's", share: "you owe $15", tone: RED, amount: "$45" },
    { emoji: "🏨", name: "Hotel — Lisbon trip", share: "you lent $54", tone: GREEN, amount: "$162" },
    { emoji: "🚗", name: "Uber to airport", share: "you owe $9", tone: RED, amount: "$18" },
    { emoji: "☕", name: "Coffee at the station", share: "you lent $3", tone: GREEN, amount: "$6" },
  ],
  received: "$20 · Settled", trip: "Lisbon trip",
  bill: { title: "Dinner at Luigi's", total: "$45", shares: [{ name: "You", amount: "$15" }, { name: "Liam", amount: "$15" }, { name: "Noah", amount: "$15" }] },
  payments: [{ from: "Noah", to: "Ava", amount: "$24" }, { from: "Mia", to: "Ava", amount: "$12" }, { from: "Liam", to: "Noah", amount: "$6" }],
  payChip: "Pay",
  step3: "See exactly who pays whom. Pay however you like, record it, and the balance clears.",
  featuresLead: "Built around how friends actually share money — and it handles the awkward cases too.",
  exactLine: "Splits always add up to the exact cent — no money ever appears or vanishes.",
  tripCard: { name: "Lisbon trip", emoji: "🏝️", total: "$920", people: 4, youGet: "$140", from: "from 3 people" },
  chat: [
    { who: "Mia", text: "Wait, who paid for the hotel?" },
    { who: "Liam", text: "Can you Venmo me $42? Thanks!" },
    { who: "Noah", text: "Who owes me from the cab?" },
    { who: "Ava", text: "I'll make a spreadsheet 😩" },
  ],
  chatAnswer: "Splitr keeps the tally, does the awkward math, and tells everyone exactly what to pay — so nobody has to ask.",
  moments: [
    { emoji: "🏝️", title: "Weekend trip", meta: "$920 · 4 people", example: "Hotel $420 ÷ 4 = $105 each", net: "$140", tone: "get" },
    { emoji: "🏠", title: "Flat rent", meta: "$1,800 · 3 people", example: "Rent added every month, split three ways", net: "$600", tone: "owe" },
    { emoji: "☕", title: "Coffee runs", meta: "$24 · 6 people", example: "Coffee for the whole table", net: "$4", tone: "owe" },
    { emoji: "🎁", title: "Group gifts", meta: "$210 · 7 people", example: "A birthday gift, split with the team", net: "$30", tone: "owe" },
    { emoji: "🍕", title: "Weekend dinner", meta: "$120 · 4 people", example: "Bill $120, $30 each", net: "$30", tone: "owe" },
    { emoji: "🚗", title: "Road trips", meta: "$340 · 5 people", example: "Fuel and snacks, settled", net: "$68", tone: "owe" },
  ],
  feature4: { icon: Send, title: "Invite & remind on WhatsApp", description: "Send an invite or a friendly nudge on WhatsApp in one tap — the message is already written for you.", color: "from-emerald-500 to-teal-600" },
};

/**
 * The landing page. `international` is the English version for visitors outside India (the Hinglish lines and rupee
 * examples only make sense there): the host serves it at the same address through a rewrite, so both stay static pages.
 */
export function LandingView({ international = false }: { international?: boolean }) {
  const copy = brandCopy(regionFor(international ? "US" : null));
  const sample = international ? SAMPLE_INTL : SAMPLE_IN;
  const groups = groupsFor(sample.feature4.title);
  return (
    <div className="min-h-dvh overflow-x-clip bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-[#f5f7fb]/80 text-slate-900 backdrop-blur-xl dark:border-white/10 dark:bg-[#0a0720]/80 dark:text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/">
            <BrandLogo size={34} />
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-slate-600 md:flex dark:text-white/70" aria-label="Sections">
            {NAV.map((l) => <a key={l.href} href={l.href} className="transition-colors hover:text-slate-900 dark:hover:text-white">{l.label}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-900/5 dark:text-white/80 dark:hover:bg-white/10">Sign in</Link>
            <Button variant="brand" size="sm" asChild className="max-sm:hidden">
              <Link href="/signup">Get started</Link>
            </Button>
            <MobileMenu links={NAV} />
          </div>
        </div>
      </header>

      {/* Hero — a soft off-white canvas lit by ambient indigo/violet light (a deep-indigo night scene in dark mode) */}
      <section data-testid="hero" className="hero-light relative isolate overflow-hidden bg-[#f5f7fb] px-4 pb-24 pt-10 text-slate-900 sm:pb-28 sm:pt-20 dark:bg-[#090a0f] dark:text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(99,91,255,0.22),transparent_38%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(99,91,255,0.20),transparent_38%)]" />
          <div className="lg-blob -left-24 top-8 h-[460px] w-[460px] bg-sky-300/20 sm:bg-sky-300/40 dark:bg-cyan-400/10" />
          <div className="lg-blob lg-blob-2 -right-20 top-1/4 h-[520px] w-[520px] bg-violet-300/25 sm:bg-violet-300/40 dark:bg-indigo-500/20" />
          <div className="lg-blob lg-blob-3 bottom-[-120px] left-1/4 h-[420px] w-[420px] bg-indigo-300/40 dark:bg-violet-500/15" />
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="min-w-0 space-y-7 text-center lg:text-left">
            <a
              href="#download"
              className="anim-fade-up lg-glass-dark inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20"
            >
              <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">NEW</span>
              Android app is here — iOS coming soon
              <ArrowRight className="size-3" />
            </a>

            <h1 className="anim-fade-up text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl xl:text-7xl" style={{ animationDelay: "60ms" }}>
              {copy.line1}{" "}
              <span className="lg-text-shimmer bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent dark:from-cyan-200 dark:via-white dark:to-fuchsia-200">{copy.line2}</span>
            </h1>

            <p className="anim-fade-up mx-auto max-w-xl text-base leading-relaxed text-white/75 sm:text-xl lg:mx-0" style={{ animationDelay: "120ms" }}>
              {copy.subline}
            </p>
            <p className="anim-fade-up text-base text-white/70" style={{ animationDelay: "150ms" }}>
              Made for{" "}
              <RotatingWords words={copy.occasions} className="font-semibold text-white" />
            </p>

            <div className="anim-fade-up flex flex-wrap items-center justify-center gap-3 lg:justify-start" style={{ animationDelay: "210ms" }}>
              <Link href="/signup" data-testid="hero-primary" className="group inline-flex h-12 items-center gap-2 rounded-xl bg-[#5b57e8] px-5 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:-translate-y-px hover:bg-[#4f4bd4] dark:bg-[#7c72ff] dark:text-slate-950 dark:hover:bg-[#8d84ff]">
                Start splitting <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a href="#how-it-works" data-testid="hero-secondary" className="inline-flex h-12 items-center rounded-xl border border-slate-300 px-5 text-base font-semibold text-slate-800 transition-colors hover:bg-slate-900/5 dark:border-white/20 dark:text-white dark:hover:bg-white/10">
                See how it works
              </a>
            </div>

            <div className="anim-fade-up flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start" style={{ animationDelay: "250ms" }}>
              <AndroidDownloadButton tone="dark" />
              <IosNotify />
            </div>

            <div className="anim-fade-up flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/70 lg:justify-start" style={{ animationDelay: "300ms" }}>
              {["Free, no ads", "No credit card", "Same account on web & Android"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-300" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div id="product" className="anim-fade-up relative scroll-mt-20" style={{ animationDelay: "200ms" }}>
            <div className="pointer-events-none absolute -left-52 top-36 z-10 hidden min-[1700px]:block anim-float-slow"><TripCard t={sample.tripCard} /></div>
            <PhoneDemo
              // (only plain data crosses to the browser: the full sample also holds an icon component, which cannot)
              s={{ owed: sample.owed, owe: sample.owe, people: sample.people, recent: sample.recent, received: sample.received, trip: sample.trip, payments: sample.payments, payChip: sample.payChip, bill: sample.bill }}
            />
          </div>
        </div>

        <div className="anim-fade-up mx-auto mt-20 grid max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,36rem)_1fr] lg:gap-16" style={{ animationDelay: "320ms" }}>
          <SplitTryout symbol={international ? "$" : "₹"} defaultAmount={international ? "120" : "2400"} currency={international ? "USD" : "INR"} />
          <div className="text-center lg:text-left">
            <p className="mb-2 text-sm font-medium text-[#635bff] dark:text-[#8b83ff]">Try it right here</p>
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">Split a bill in three taps.</h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground lg:mx-0">Change the bill, the number of friends or the way you split. It&apos;s the same maths the app uses, so the shares always add up to the exact amount.</p>
          </div>
        </div>

        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-background" />
      </section>

      {/* Switching from Splitwise */}
      <SplitwiseBanner />

      {/* Ten payments become three (animated): one of the strongest points, so it comes early */}
      <SettleFlow symbol={international ? "$" : "₹"} />

      <ChatProblem lines={sample.chat} answer={sample.chatAnswer} />
      <MomentsGrid moments={sample.moments} />


      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-16 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center sm:mb-14">
            <p className="mb-2 flex items-center justify-center gap-1.5 text-sm font-medium text-[#635bff] dark:text-[#8b83ff]">
              <span className="h-px w-4 bg-violet-500/50" /> How it works <span className="h-px w-4 bg-violet-500/50" />
            </p>
            <h2 className="text-3xl font-bold sm:text-4xl">Up and running in minutes</h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">No setup, no learning curve — create a group and start splitting.</p>
          </div>
          <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
            <div className="absolute left-[calc(16.6%+2rem)] right-[calc(16.6%+2rem)] top-10 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" />
            {steps.map(({ number, icon: Icon, title, description }, i) => (
              <Reveal key={number} delay={i * 120} className="group relative text-center">
                <div className="relative z-10 mx-auto mb-4 flex size-16 sm:mb-5 sm:size-20 flex-col items-center justify-center rounded-2xl gradient-brand shadow-lg shadow-violet-500/25 transition-transform duration-200 group-hover:-translate-y-1">
                  <span className="text-[10px] font-bold leading-none text-white/70">{number}</span>
                  <Icon className="mt-1 size-6 text-white" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{number === "03" ? sample.step3 : description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <OfflineSync />

      {/* Android download */}
      <section id="download" className="scroll-mt-16 px-4 pb-16 sm:pb-20">
        <div className="mx-auto max-w-5xl">
          <Reveal className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-700 via-indigo-700 to-purple-800 p-8 text-white shadow-2xl shadow-violet-900/30 sm:p-12">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="lg-blob -left-16 -top-16 h-80 w-80 bg-cyan-400/40" />
              <div className="lg-blob lg-blob-2 -bottom-24 -right-10 h-80 w-80 bg-fuchsia-400/40" />
              <div className="lg-blob lg-blob-3 left-1/2 top-1/3 h-60 w-60 bg-indigo-300/30" />
            </div>
            <div className="relative">
              <div className="mb-8 max-w-2xl">
                <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                  <Smartphone className="size-3.5" /> Android app · iPhone coming soon
                </p>
                <h2 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">Take {APP_NAME} in your pocket</h2>
                <p className="text-lg leading-relaxed text-white/80">
                  Add an expense the moment the bill arrives — even without signal. Same account, same groups, one tap from your home screen.
                </p>
              </div>
              <DownloadPanel />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative scroll-mt-16 overflow-hidden bg-gradient-to-b from-violet-50/70 via-muted/30 to-sky-50/60 px-4 py-24 dark:from-violet-950/20 dark:via-transparent dark:to-sky-950/10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="lg-blob -left-20 top-10 h-72 w-72 bg-violet-400/20" />
          <div className="lg-blob lg-blob-2 -right-16 top-1/2 h-80 w-80 bg-sky-300/25" />
          <div className="lg-blob lg-blob-3 bottom-0 left-1/3 h-64 w-64 bg-fuchsia-300/20" />
        </div>
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <p className="mb-2 flex items-center justify-center gap-1.5 text-sm font-medium text-[#635bff] dark:text-[#8b83ff]">
              <span className="h-px w-4 bg-violet-500/50" /> Features <span className="h-px w-4 bg-violet-500/50" />
            </p>
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">Everything you need, nothing you don&apos;t</h2>
            <p className="mx-auto max-w-xl text-muted-foreground">{sample.featuresLead}</p>
          </div>
          <div data-testid="feature-groups" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {groups.map(({ id, icon: Icon, color, title, lead, items }, i) => (
              <Reveal key={title} delay={(i % 2) * 90}>
                <article className="bento-card group flex h-full flex-col rounded-3xl border border-white/70 bg-white/70 p-7 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl dark:border-white/10 dark:bg-white/5">
                  <div className={`mb-4 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${color} shadow-md ring-1 ring-white/40 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}>
                    <Icon className="size-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{lead}</p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {items.map((it) => <li key={it} className="rounded-full border bg-background/70 px-3 py-1 text-xs font-medium">{it}</li>)}
                  </ul>
                  <div className="mt-auto pt-5"><GroupVisual id={id} sample={sample} /></div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Money you can trust */}
      <section className="px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="max-sm:text-center">
            <p className="mb-2 flex items-center gap-1.5 max-sm:justify-center text-sm font-medium text-[#635bff] dark:text-[#8b83ff]">
              <span className="h-px w-4 bg-violet-500/50" /> Careful with money
            </p>
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Because it&apos;s your money, the numbers have to be right</h2>
            <ul className="space-y-3 text-muted-foreground">
              {[
                sample.exactLine,
                "Mixed currencies are never added together by mistake: each debt stays in its own currency.",
                "Offline entries are saved on your device and can't be duplicated when they sync.",
                "Green means you're owed, red means you owe — clear at a glance.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-green-500/15"><Check className="size-3 text-[#16a36a] dark:text-emerald-400" /></span>
                  <span className="text-sm leading-relaxed sm:text-base">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative scroll-mt-16 overflow-hidden bg-gradient-to-b from-sky-50/60 to-violet-50/60 px-4 py-24 dark:from-transparent dark:to-violet-950/20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="lg-blob -right-10 top-10 h-64 w-64 bg-violet-300/30" />
          <div className="lg-blob lg-blob-2 -left-10 bottom-10 h-64 w-64 bg-sky-300/30" />
        </div>
        <div className="relative mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Questions, answered</h2>
          </div>
          <div className="space-y-3">
            {faqs.map(({ q, a }) => (
              <details key={q} className="lg-glass group rounded-2xl px-5 py-4 transition-shadow open:shadow-lg">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="relative overflow-hidden rounded-3xl">
            <div className="absolute inset-0 bg-gradient-to-br from-[#4f48e6] to-[#635bff]" />
            <div className="absolute inset-0">
              <div className="absolute left-0 top-0 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute bottom-0 right-0 size-64 translate-x-1/2 translate-y-1/2 rounded-full bg-white/10 blur-3xl" />
            </div>
            <div className="relative px-8 py-16 text-center text-white">
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Stop chasing your friends for money.</h2>
              <p className="mx-auto mb-8 max-w-lg text-lg leading-relaxed text-white/80">Split it. Settle it. Move on.</p>
              <Link href="/signup" data-testid="final-cta" className="group mb-6 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-7 text-base font-semibold text-slate-900 shadow-lg transition-all hover:-translate-y-px">
                Start splitting <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <p className="mb-4 text-sm text-white/70">Free on the web and Android — iOS coming soon.</p>
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <AndroidDownloadButton tone="light" />
                <IosComingSoon tone="light" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/20 px-4 pb-24 pt-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <Link href="/" className="flex items-center gap-3">
              <BrandLogo size={32} />
              <p className="hidden text-[10px] text-muted-foreground sm:block">Free expense splitting for everyone</p>
            </Link>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <Link href="/login" className="transition-colors hover:text-foreground">Sign in</Link>
              <a href="#download" className="transition-colors hover:text-foreground">Android app</a>
              <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
              <Link href="/support" className="transition-colors hover:text-foreground">Support</Link>
            </div>
          </div>
          <div className="flex flex-col items-center justify-between gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row">
            <p>© {new Date().getFullYear()} {APP_NAME}. Built for people who hate awkward money conversations.</p>
            <p>Web · Android · iOS coming soon</p>
          </div>
        </div>
      </footer>
      <ContinuityPill />
    </div>
  );
}

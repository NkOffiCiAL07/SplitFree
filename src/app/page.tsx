import { BrandLogo, BrandMark } from "@/components/shared/brand-logo";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Zap, Users, BarChart3, Shield, ArrowRight, Check, SplitSquareHorizontal, Globe, RefreshCw, Sparkles,
  WifiOff, QrCode, FileUp, History, Bell, UsersRound, ChevronDown, Smartphone, IndianRupee,
  Home, Receipt, UserPlus, Signal, Wifi, BatteryFull,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { DownloadPanel } from "@/components/landing/download-panel";
import { Reveal } from "@/components/landing/reveal";
import { RotatingWords } from "@/components/landing/rotating-words";
import { AndroidDownloadButton, IosComingSoon } from "@/components/landing/store-badges";
import { APP_NAME } from "@/lib/app-config";
import { CURRENCY_CODES } from "@/lib/currencies";
import { HEADLINE_LINE_1, HEADLINE_LINE_2, SUBLINE, OCCASIONS } from "@/lib/brand-copy";

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME} — Split expenses, not friendships` },
  description: "Free expense splitting for groups and friends, built for India: UPI, offline mode and smart settle-up. Available on the web and as an Android app — iOS coming soon.",
};

const features = [
  { icon: Users, title: "Groups & friends", description: "Trips, flats, couples, office lunches — track who owes whom, with anyone.", color: "from-violet-500 to-purple-600" },
  { icon: SplitSquareHorizontal, title: "Every way to split", description: "Equally, by exact amounts, percentages or shares — and several people can pay one bill.", color: "from-blue-500 to-indigo-600" },
  { icon: Zap, title: "Smart settle-up", description: "Debts are simplified into the fewest possible payments, so ten transfers become three.", color: "from-amber-500 to-orange-600" },
  { icon: IndianRupee, title: "UPI in one tap", description: "Save your UPI ID and friends can pay you straight from GPay, PhonePe or Paytm.", color: "from-emerald-500 to-teal-600" },
  { icon: WifiOff, title: "Works offline", description: "No signal on the trip? Add expenses and payments anyway — they sync safely when you're back online.", color: "from-rose-500 to-pink-600" },
  { icon: Globe, title: `${CURRENCY_CODES.length} currencies`, description: "Each debt stays exact in its own currency, while your totals are shown in your home currency.", color: "from-cyan-500 to-sky-600" },
  { icon: FileUp, title: "Bring your Splitwise history", description: "Import your Splitwise CSV export and carry on where you left off.", color: "from-indigo-500 to-violet-600" },
  { icon: History, title: "Nothing is a mystery", description: "Every expense has its edit history, comments and who changed what.", color: "from-fuchsia-500 to-purple-600" },
  { icon: RefreshCw, title: "Recurring expenses", description: "Rent, Wi-Fi, subscriptions and EMIs added automatically every month.", color: "from-lime-500 to-green-600" },
  { icon: BarChart3, title: "Spending insights", description: "See where the money goes by month and category, plus group budgets.", color: "from-sky-500 to-blue-600" },
  { icon: Bell, title: "Gentle reminders", description: "Nudge someone who owes you with a tap — one polite reminder a day, never spam.", color: "from-orange-500 to-red-500" },
  { icon: Shield, title: "Private by design", description: "No ads and no selling your data. Your account works the same on the web and on Android.", color: "from-green-500 to-emerald-600" },
];

const steps = [
  { number: "01", icon: UsersRound, title: "Create a group", description: "Add roommates, travel buddies or friends. Share an invite link and they join instantly." },
  { number: "02", icon: SplitSquareHorizontal, title: "Log expenses", description: "Add a bill and choose how to split it. Type “dinner 900 with Asha” and quick-add does the rest." },
  { number: "03", icon: Zap, title: "Settle up", description: "See exactly who pays whom. Pay by UPI, record it, and the balance clears." },
];

const faqs = [
  { q: "Is it really free?", a: `Yes. ${APP_NAME} has no ads and no paywalls.` },
  { q: "How do I install the Android app?", a: "Tap Download for Android, open the file, and allow “Install unknown apps” for your browser when Android asks (one-time). It's a direct download for now, so Android may show a standard warning for apps installed outside the Play Store." },
  { q: "How can I check the file is genuine?", a: "It's a signed release. The download section shows its SHA-256 checksum — compare it with the file on your device (for example with a checksum app) to be sure it's untouched." },
  { q: "What about iPhone?", a: "A native iOS app is coming soon. Until then, open the site in Safari and tap Share → Add to Home Screen: you get the full app, offline mode included." },
  { q: "Does it work without internet?", a: "Yes. You can look at your last-seen balances and add expenses or payments offline. They're stored on your device and synced automatically when you reconnect — without ever being duplicated." },
  { q: "Will my data be the same on web and Android?", a: "Yes — it's one account. Sign in on either and everything is there." },
];

const chips = ["UPI pay links", "Offline mode", "Multi-currency", "Smart settle-up", "Splitwise import", "Android app", "No ads"];

function PhoneMock() {
  const people = [
    { name: "Himanshu", note: "you owe", amount: "₹1,200", tone: "text-red-600 dark:text-red-400", bg: "bg-rose-400" },
    { name: "Divyansh", note: "owes you", amount: "₹850", tone: "text-green-600 dark:text-green-400", bg: "bg-emerald-500" },
    { name: "Prakhar", note: "owes you", amount: "₹340", tone: "text-green-600 dark:text-green-400", bg: "bg-indigo-500" },
  ];
  const recent = [
    { emoji: "🍔", name: "Dinner at Barbeque Nation", share: "you owe ₹600", tone: "text-red-600 dark:text-red-400", amount: "₹1,800" },
    { emoji: "🏨", name: "Hotel — Goa trip", share: "you lent ₹2,166", tone: "text-green-600 dark:text-green-400", amount: "₹6,500" },
    { emoji: "🚗", name: "Ola cab to airport", share: "you owe ₹170", tone: "text-red-600 dark:text-red-400", amount: "₹340" },
    { emoji: "☕", name: "Chai at Pune station", share: "you lent ₹60", tone: "text-green-600 dark:text-green-400", amount: "₹120" },
  ];
  return (
    <div className="relative mx-auto w-[260px] sm:w-[290px]" aria-hidden="true">
      <div className="absolute -inset-10 -z-10 rounded-full bg-gradient-to-br from-violet-500/30 via-indigo-500/20 to-fuchsia-500/20 blur-3xl" />

      {/* Phone body: titanium-style frame, side buttons, real 9:19.5 proportions */}
      <div className="relative rounded-[2.9rem] border-[7px] border-zinc-900 bg-zinc-900 shadow-[0_40px_90px_-20px_rgba(76,29,149,0.55)] dark:border-zinc-700 dark:bg-zinc-700">
        <span className="absolute -left-[10px] top-24 h-9 w-[3px] rounded-l bg-zinc-800 dark:bg-zinc-600" />
        <span className="absolute -left-[10px] top-40 h-14 w-[3px] rounded-l bg-zinc-800 dark:bg-zinc-600" />
        <span className="absolute -left-[10px] top-[14.5rem] h-14 w-[3px] rounded-l bg-zinc-800 dark:bg-zinc-600" />
        <span className="absolute -right-[10px] top-36 h-20 w-[3px] rounded-r bg-zinc-800 dark:bg-zinc-600" />

        <div className="relative flex aspect-[9/19.5] flex-col overflow-hidden rounded-[2.3rem] bg-background">
          {/* status bar + camera island */}
          <div className="flex items-center justify-between px-6 pb-1 pt-3 text-[10px] font-semibold">
            <span>9:41</span>
            <span className="absolute left-1/2 top-2.5 h-[18px] w-[78px] -translate-x-1/2 rounded-full bg-zinc-900 dark:bg-black" />
            <span className="flex items-center gap-1"><Signal className="size-3" /><Wifi className="size-3" /><BatteryFull className="size-3.5" /></span>
          </div>

          {/* the app screen */}
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 px-3.5 pb-2 pt-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] text-muted-foreground">Good evening</p>
                <p className="text-[13px] font-bold leading-tight">Your balances</p>
              </div>
              <BrandMark size={28} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-2">
                <p className="text-[8px] text-muted-foreground">Owed to you</p>
                <p className="text-[15px] font-bold leading-tight text-green-600 dark:text-green-400">₹1,190</p>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-2">
                <p className="text-[8px] text-muted-foreground">You owe</p>
                <p className="text-[15px] font-bold leading-tight text-red-600 dark:text-red-400">₹1,200</p>
              </div>
            </div>

            <div className="rounded-xl border bg-card px-2.5 py-1.5">
              <p className="mb-0.5 text-[9px] font-semibold text-muted-foreground">Balances</p>
              {people.map((r) => (
                <div key={r.name} className="flex items-center gap-2 py-1">
                  <div className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${r.bg}`}>{r.name[0]}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium leading-tight">{r.name}</p>
                    <p className="text-[8.5px] leading-tight text-muted-foreground">{r.note}</p>
                  </div>
                  <p className={`text-[11px] font-semibold ${r.tone}`}>{r.amount}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border bg-card px-2.5 py-1.5">
              <p className="mb-0.5 text-[9px] font-semibold text-muted-foreground">Recent</p>
              {recent.map((e) => (
                <div key={e.name} className="flex items-center gap-2 py-1">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted text-[12px]">{e.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10.5px] font-medium leading-tight">{e.name}</p>
                    <p className={`text-[8.5px] leading-tight ${e.tone}`}>{e.share}</p>
                  </div>
                  <p className="text-[10.5px] font-semibold">{e.amount}</p>
                </div>
              ))}
            </div>

            <div className="mt-auto rounded-xl gradient-brand py-2 text-center text-[11px] font-semibold text-white">Settle up</div>
          </div>

          {/* bottom navigation + home indicator */}
          <div className="border-t bg-background/95 px-3 pb-1.5 pt-1.5">
            <div className="flex items-center justify-around text-[8px] text-muted-foreground">
              {[
                { icon: Home, label: "Home", active: true },
                { icon: Users, label: "Groups" },
                { icon: Receipt, label: "Expenses" },
                { icon: UserPlus, label: "Friends" },
              ].map(({ icon: Icon, label, active }) => (
                <div key={label} className={`flex flex-col items-center gap-0.5 ${active ? "text-violet-600 dark:text-violet-400" : ""}`}>
                  <Icon className="size-4" />
                  <span className={active ? "font-semibold" : ""}>{label}</span>
                </div>
              ))}
            </div>
            <div className="mx-auto mt-1.5 h-1 w-20 rounded-full bg-zinc-900/80 dark:bg-zinc-200/80" />
          </div>
        </div>
      </div>

      <div className="anim-float lg-glass absolute -left-[132px] top-24 hidden rounded-2xl px-3 py-2 sm:block">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold"><Check className="size-3.5 text-green-500" /> Payment received</p>
        <p className="text-[10px] text-muted-foreground">₹850 · UPI</p>
      </div>
      <div className="anim-float-slow lg-glass absolute -right-[130px] top-64 hidden rounded-2xl px-3 py-2 sm:block">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold"><WifiOff className="size-3.5 text-violet-500" /> Offline — saved</p>
        <p className="text-[10px] text-muted-foreground">Syncs when you&apos;re back</p>
      </div>
      <div className="anim-float lg-glass absolute -left-[118px] bottom-28 hidden rounded-2xl px-3 py-2 sm:block">
        <p className="text-[11px] font-semibold">10 payments → 3</p>
        <p className="text-[10px] text-muted-foreground">Debts simplified</p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/">
            <BrandLogo size={34} />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex" aria-label="Sections">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#download" className="transition-colors hover:text-foreground">Android app</a>
            <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="brand" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-4 pb-20 pt-14 sm:pt-20">
        <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
          <div className="lg-blob left-[8%] top-10 h-[420px] w-[420px] bg-violet-400/35" />
          <div className="lg-blob lg-blob-2 right-[6%] top-24 h-[480px] w-[480px] bg-sky-300/35" />
          <div className="lg-blob lg-blob-3 bottom-[-80px] left-1/3 h-[380px] w-[380px] bg-fuchsia-300/30" />
          <div
            className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]"
            style={{ backgroundImage: "radial-gradient(circle, #6d28d9 1px, transparent 1px)", backgroundSize: "32px 32px" }}
          />
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="min-w-0 space-y-7 text-center lg:text-left">
            <a
              href="#download"
              className="anim-fade-up inline-flex items-center gap-2 rounded-full border bg-card/70 px-3.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-colors hover:bg-card"
            >
              <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">NEW</span>
              Android app is here — iOS coming soon
              <ArrowRight className="size-3" />
            </a>

            <h1 className="anim-fade-up text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl xl:text-7xl" style={{ animationDelay: "60ms" }}>
              {HEADLINE_LINE_1}{" "}
              <span className="gradient-brand-text">{HEADLINE_LINE_2}</span>
            </h1>

            <p className="anim-fade-up mx-auto max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl lg:mx-0" style={{ animationDelay: "120ms" }}>
              {SUBLINE}
            </p>
            <p className="anim-fade-up text-base text-muted-foreground" style={{ animationDelay: "150ms" }}>
              Made for{" "}
              <RotatingWords words={OCCASIONS} className="font-semibold text-foreground" />
            </p>

            <div className="anim-fade-up flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start" style={{ animationDelay: "240ms" }}>
              <AndroidDownloadButton />
              <IosComingSoon />
            </div>

            <div className="anim-fade-up flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground lg:justify-start" style={{ animationDelay: "300ms" }}>
              {["Free, no ads", "No credit card", "Same account on web & Android"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-green-500" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="anim-fade-up" style={{ animationDelay: "200ms" }}>
            <PhoneMock />
          </div>
        </div>
      </section>

      {/* Feature ticker */}
      <section className="relative overflow-hidden border-y bg-muted/30 py-5" aria-label="Highlights">
        <div className="flex w-max lg-marquee gap-3 px-3 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
          {[0, 1].map((copy) => (
            <ul key={copy} className="flex shrink-0 gap-3" aria-hidden={copy === 1 ? "true" : undefined}>
              {[...chips, ...chips].map((c, i) => (
                <li key={`${c}-${i}`} className="lg-glass flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground/80">
                  <Sparkles className="size-3.5 text-violet-500" />
                  {c}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-14 text-center">
            <p className="mb-2 flex items-center justify-center gap-1.5 text-sm font-medium text-violet-600 dark:text-violet-400">
              <span className="h-px w-4 bg-violet-500/50" /> How it works <span className="h-px w-4 bg-violet-500/50" />
            </p>
            <h2 className="text-3xl font-bold sm:text-4xl">Up and running in minutes</h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">No setup, no learning curve — create a group and start splitting.</p>
          </div>
          <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="absolute left-[calc(16.6%+2rem)] right-[calc(16.6%+2rem)] top-10 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" />
            {steps.map(({ number, icon: Icon, title, description }, i) => (
              <Reveal key={number} delay={i * 120} className="group relative text-center">
                <div className="relative z-10 mx-auto mb-5 flex size-20 flex-col items-center justify-center rounded-2xl gradient-brand shadow-lg shadow-violet-500/25 transition-transform duration-200 group-hover:-translate-y-1">
                  <span className="text-[10px] font-bold leading-none text-white/70">{number}</span>
                  <Icon className="mt-1 size-6 text-white" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Android download */}
      <section id="download" className="scroll-mt-16 px-4 pb-24">
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
          <div className="lg-blob -left-20 top-10 h-72 w-72 bg-violet-400/40" />
          <div className="lg-blob lg-blob-2 -right-16 top-1/2 h-80 w-80 bg-sky-300/45" />
          <div className="lg-blob lg-blob-3 bottom-0 left-1/3 h-64 w-64 bg-fuchsia-300/35" />
        </div>
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <p className="mb-2 flex items-center justify-center gap-1.5 text-sm font-medium text-violet-600 dark:text-violet-400">
              <span className="h-px w-4 bg-violet-500/50" /> Features <span className="h-px w-4 bg-violet-500/50" />
            </p>
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">Everything you need, nothing you don&apos;t</h2>
            <p className="mx-auto max-w-xl text-muted-foreground">Built around how people in India actually share money — and it handles the awkward cases too.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, description, color }, i) => (
              <Reveal key={title} delay={(i % 4) * 80}>
                <div className="lg-glass group h-full rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl">
                  <div className={`relative mb-4 flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-md shadow-black/10 ring-1 ring-white/40 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}>
                    <Icon className="size-5 text-white" />
                  </div>
                  <h3 className="relative mb-1.5 font-semibold">{title}</h3>
                  <p className="relative text-sm leading-relaxed text-muted-foreground">{description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Money you can trust */}
      <section className="px-4 py-24">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-violet-600 dark:text-violet-400">
              <span className="h-px w-4 bg-violet-500/50" /> Careful with money
            </p>
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Because it&apos;s your money, the numbers have to be right</h2>
            <ul className="space-y-3 text-muted-foreground">
              {[
                "Splits always add up to the exact paisa — no rupee ever appears or vanishes.",
                "Mixed currencies are never added together by mistake: each debt stays in its own currency.",
                "Offline entries are saved on your device and can't be duplicated when they sync.",
                "Green means you're owed, red means you owe — clear at a glance.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-green-500/15"><Check className="size-3 text-green-600 dark:text-green-400" /></span>
                  <span className="text-sm leading-relaxed sm:text-base">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg-glass rounded-3xl p-6">
            <p className="mb-4 text-xs font-medium text-muted-foreground">Goa trip · simplified</p>
            {[
              { from: "Rohan", to: "Ananya", amount: "₹2,400" },
              { from: "Kavya", to: "Ananya", amount: "₹1,150" },
              { from: "Aditya", to: "Rohan", amount: "₹600" },
            ].map((d) => (
              <div key={d.from} className="flex items-center gap-3 border-b py-3 last:border-0">
                <div className="flex size-8 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-600 dark:text-violet-300">{d.from[0]}</div>
                <p className="flex-1 text-sm"><span className="font-medium">{d.from}</span> pays <span className="font-medium">{d.to}</span></p>
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">{d.amount}</p>
                <span className="hidden items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium sm:flex"><QrCode className="size-3" /> UPI</span>
              </div>
            ))}
            <p className="mt-4 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">Seven payments between four friends became three. <span className="text-foreground">Example for illustration.</span></p>
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
      <section className="px-4 py-24">
        <div className="mx-auto max-w-3xl">
          <div className="relative overflow-hidden rounded-3xl">
            <div className="absolute inset-0 gradient-brand opacity-90" />
            <div className="absolute inset-0">
              <div className="absolute left-0 top-0 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute bottom-0 right-0 size-64 translate-x-1/2 translate-y-1/2 rounded-full bg-white/10 blur-3xl" />
            </div>
            <div className="relative px-8 py-16 text-center text-white">
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Stop chasing your friends for money.</h2>
              <p className="mx-auto mb-8 max-w-lg text-lg leading-relaxed text-white/80">Free on the web and Android — iOS coming soon.</p>
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <AndroidDownloadButton tone="light" />
                <IosComingSoon tone="light" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/20 px-4 py-10">
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
    </div>
  );
}

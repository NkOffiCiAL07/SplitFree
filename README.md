# SplitFree

A production-ready, open-source alternative to Splitwise. Split expenses with friends and groups — free forever, no ads, no paywalls.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Prisma 7 · Supabase (Auth + PostgreSQL) · Vercel

---

## Features

- **Google OAuth + Email/Password** authentication with password reset
- **Groups** — create, invite members, track balances per group
- **Expenses** — add/edit/delete with Equal / Exact / Percentage / Shares splits
- **Recurring expenses** — flag any expense as recurring
- **Debt simplification** — minimum cash flow algorithm to minimise transactions
- **Settle up** — record payments, view history
- **Friends** — connect with friends across groups
- **Analytics** — 6-month spending overview with bar + pie charts (Recharts)
- **Activity feed** — all notifications in one place
- **Search** — global ⌘K command palette (cmdk)
- **CSV export** — download all your expenses
- **Dark / Light / System** theme (next-themes)
- **PWA** — installable, offline shell, push notification support
- **Fully responsive** — desktop sidebar + mobile bottom nav

---

## Local Development

### 1. Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier is enough)

### 2. Clone & install

```bash
git clone https://github.com/NkOffiCiAL07/SplitFree.git
cd SplitFree
npm install
```

### 3. Set up Supabase

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Go to **Project Settings → API** and copy:
   - Project URL
   - `anon public` key
   - `service_role` key (keep secret)
3. Go to **Project Settings → Database → Connection string** and copy the **Transaction mode** URL (port 6543)
4. Go to **Authentication → Providers** and enable:
   - **Email** (on by default)
   - **Google** — add your OAuth credentials from [Google Cloud Console](https://console.cloud.google.com)
5. Under **Authentication → URL Configuration**, add your redirect URL:
   - Development: `http://localhost:3000/auth/callback`
   - Production: `https://your-domain.vercel.app/auth/callback`

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Transaction mode for Prisma (port 6543)
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
# Direct for migrations (port 5432)
DIRECT_URL=postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

### 5. Push database schema

```bash
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to Supabase
```

### 6. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploy to Vercel

### Steps

1. Push to GitHub
2. Import at [vercel.com/new](https://vercel.com/new)
3. Add all env vars under **Project → Settings → Environment Variables**
4. Deploy — `vercel.json` already sets `buildCommand` to run `prisma generate` before `next build`
5. After first deploy, push the schema once from your local machine:

```bash
DATABASE_URL="<prod-transaction-url>" DIRECT_URL="<prod-direct-url>" npx prisma db push
```

### Required environment variables on Vercel

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API |
| `DATABASE_URL` | Supabase → Settings → Database → Transaction mode |
| `DIRECT_URL` | Supabase → Settings → Database → Direct connection |

---

## Project structure

```
src/
  app/
    (auth)/           # Login, signup, reset-password pages
    (dashboard)/      # All authenticated app pages
    api/              # REST API routes
    auth/callback/    # Supabase OAuth + recovery callback
  components/
    ui/               # Primitive components (Button, Card, Input…)
    layout/           # Sidebar, TopNav, MobileNav, CommandPalette
    dashboard/        # Dashboard widgets + onboarding
    shared/           # ThemeProvider, QueryProvider, EmptyState
  hooks/              # React Query + Supabase hooks
  lib/
    algorithms/       # Debt simplification, split calculation
    supabase/         # Client / server / middleware helpers
    validations/      # Zod schemas
    api-helpers.ts    # requireAuth, ok, err
    prisma.ts         # Prisma singleton
    utils.ts          # Shared utilities
  stores/             # Zustand UI stores
  types/              # TypeScript types
prisma/
  schema.prisma       # Database schema (9 models)
public/
  manifest.json       # PWA manifest
  sw.js               # Service worker (cache-first + network-first)
```

---

## Key implementation notes

- **Amounts in cents** — all monetary values are stored as integers (cents) to avoid floating-point issues. `toCents()` / `fromCents()` / `formatCurrency()` handle conversion.
- **Debt simplification** — `src/lib/algorithms/debt-simplification.ts` implements the minimum cash flow greedy algorithm (O(n²)).
- **Split types** — Equal (remainder to payer), Exact (dollar amounts), Percentage (must sum to 100), Shares (proportional).
- **Auth proxy** — `src/proxy.ts` (Next.js 16 convention replaces `middleware.ts`) refreshes Supabase sessions on every request.
- **Prisma 7** — connection URL lives in `prisma.config.ts`, not in the schema `datasource` block.

---

## Scripts

```bash
npm run dev          # Dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # TypeScript check
npm run db:generate  # Generate Prisma client
npm run db:push      # Sync schema to DB
npm run db:migrate   # Create & apply migration
npm run db:studio    # Prisma Studio GUI
```

---

## License

MIT

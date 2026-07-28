-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 1. Add EXPENSE_COMMENTED to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EXPENSE_COMMENTED';

-- 2. Add BudgetPeriod enum
DO $$ BEGIN
  CREATE TYPE "BudgetPeriod" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3. Create expense_comments table
CREATE TABLE IF NOT EXISTS expense_comments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS expense_comments_expense_id_idx ON expense_comments(expense_id);

-- 4. Create budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT,
  amount INTEGER NOT NULL,
  period "BudgetPeriod" NOT NULL DEFAULT 'MONTHLY',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, group_id, category)
);
CREATE INDEX IF NOT EXISTS budgets_user_id_idx ON budgets(user_id);
CREATE INDEX IF NOT EXISTS budgets_group_id_idx ON budgets(group_id);

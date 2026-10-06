-- CreateTable
CREATE TABLE IF NOT EXISTS "expense_reactions" (
    "id" TEXT NOT NULL,
    "expense_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expense_reactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "expense_reactions_expense_id_user_id_emoji_key" ON "expense_reactions"("expense_id", "user_id", "emoji");
CREATE INDEX IF NOT EXISTS "expense_reactions_expense_id_idx" ON "expense_reactions"("expense_id");
DO $$ BEGIN
  ALTER TABLE "expense_reactions" ADD CONSTRAINT "expense_reactions_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "expense_reactions" ADD CONSTRAINT "expense_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Who added each expense (only they can edit it). Nullable: very old rows fall back to the payer in code.
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "created_by_id" TEXT;

-- Backfill from the "expense created" activity entry, so existing expenses keep their real owner
UPDATE "expenses" e
SET "created_by_id" = a."user_id"
FROM "activities" a
WHERE a."expense_id" = e."id" AND a."type" = 'EXPENSE_CREATED' AND e."created_by_id" IS NULL;

-- Anything still unknown (imports, recurring copies, pruned activity): the payer
UPDATE "expenses" SET "created_by_id" = "paid_by_id" WHERE "created_by_id" IS NULL;

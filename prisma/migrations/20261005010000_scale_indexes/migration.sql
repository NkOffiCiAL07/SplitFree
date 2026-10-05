-- Indexes for the queries that run on every page load, so they stay fast as data grows
CREATE INDEX IF NOT EXISTS "activities_user_id_created_at_idx" ON "activities" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "expenses_group_id_date_idx" ON "expenses" ("group_id", "date" DESC);
CREATE INDEX IF NOT EXISTS "expenses_is_recurring_idx" ON "expenses" ("is_recurring");

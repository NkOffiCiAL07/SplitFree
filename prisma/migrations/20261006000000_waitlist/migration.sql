-- CreateTable
CREATE TABLE IF NOT EXISTS "waitlist" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'ios',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_email_key" ON "waitlist"("email");

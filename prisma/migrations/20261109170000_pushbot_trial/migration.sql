-- idempotent: safe to re-run
-- Visitors on aultrum.co.uk who asked to try a Pushbot by text.

CREATE TABLE IF NOT EXISTS "PushbotTrial" (
    "id" TEXT NOT NULL,
    "pushbotId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "replies" INTEGER NOT NULL DEFAULT 0,
    "stoppedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushbotTrial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PushbotTrial_phone_createdAt_idx" ON "PushbotTrial"("phone", "createdAt");
CREATE INDEX IF NOT EXISTS "PushbotTrial_ipHash_createdAt_idx" ON "PushbotTrial"("ipHash", "createdAt");
CREATE INDEX IF NOT EXISTS "PushbotTrial_createdAt_idx" ON "PushbotTrial"("createdAt");

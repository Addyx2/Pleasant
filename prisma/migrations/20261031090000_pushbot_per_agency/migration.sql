-- idempotent: safe to re-run
-- A Pushbot per agency, with a number of its own; office staff's mobiles;
-- office jobs held for a YES code; office conversations in SmsMessage.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mobile" TEXT;
ALTER TABLE "SmsMessage" ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE TABLE IF NOT EXISTS "Pushbot" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Pushbot',
    "tone" TEXT NOT NULL DEFAULT 'friendly',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "officeTexts" BOOLEAN NOT NULL DEFAULT true,
    "waveSize" INTEGER NOT NULL DEFAULT 5,
    "waveGapMins" INTEGER NOT NULL DEFAULT 15,
    "number" TEXT,
    "numberSid" TEXT,
    "numberStatus" TEXT NOT NULL DEFAULT 'none',
    "numberError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Pushbot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PushbotAction" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doneAt" TIMESTAMP(3),
    CONSTRAINT "PushbotAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Pushbot_agencyId_key" ON "Pushbot"("agencyId");
CREATE INDEX IF NOT EXISTS "Pushbot_number_idx" ON "Pushbot"("number");
CREATE INDEX IF NOT EXISTS "PushbotAction_userId_status_idx" ON "PushbotAction"("userId", "status");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Pushbot_agencyId_fkey') THEN
    ALTER TABLE "Pushbot" ADD CONSTRAINT "Pushbot_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PushbotAction_agencyId_fkey') THEN
    ALTER TABLE "PushbotAction" ADD CONSTRAINT "PushbotAction_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PushbotAction_userId_fkey') THEN
    ALTER TABLE "PushbotAction" ADD CONSTRAINT "PushbotAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- idempotent: safe to re-run
-- Pushbots: campaigns text offers in waves; offers remember their campaign; carers can opt out of texts.

ALTER TABLE "StaffProfile" ADD COLUMN IF NOT EXISTS "smsOptOutAt" TIMESTAMP(3);

ALTER TABLE "PushbotCampaign" ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "nextWaveAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "outcome" TEXT,
ADD COLUMN IF NOT EXISTS "startedById" TEXT,
ADD COLUMN IF NOT EXISTS "wave" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "waveGapMins" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN IF NOT EXISTS "waveSize" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "ShiftOffer" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;

CREATE INDEX IF NOT EXISTS "ShiftOffer_campaignId_idx" ON "ShiftOffer"("campaignId");

-- idempotent: safe to re-run
-- Each stored signature's SHA-256, so any later change to the image no longer matches.

ALTER TABLE "Timesheet" ADD COLUMN IF NOT EXISTS "candidateSignatureSha256" TEXT,
ADD COLUMN IF NOT EXISTS "clientAuthSignatureSha256" TEXT;

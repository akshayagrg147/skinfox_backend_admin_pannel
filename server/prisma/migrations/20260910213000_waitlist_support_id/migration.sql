-- Add a short, customer-facing support reference while retaining the
-- unguessable public token for authenticated reservation actions.
ALTER TABLE "WaitlistReservation" ADD COLUMN "waitlistId" TEXT;

UPDATE "WaitlistReservation"
SET "waitlistId" = 'SFWL-' || EXTRACT(YEAR FROM "createdAt")::INTEGER || '-' || UPPER(SUBSTRING(md5("publicToken"), 1, 10));

ALTER TABLE "WaitlistReservation" ALTER COLUMN "waitlistId" SET NOT NULL;

CREATE UNIQUE INDEX "WaitlistReservation_waitlistId_key" ON "WaitlistReservation"("waitlistId");

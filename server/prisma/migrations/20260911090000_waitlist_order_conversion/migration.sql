-- Waitlist-to-order conversion keeps an immutable commercial snapshot on the order.
ALTER TABLE "Order"
  ADD COLUMN "balancePaidAt" TIMESTAMP(3),
  ADD COLUMN "completionDeadlineAt" TIMESTAMP(3),
  ADD COLUMN "conversionSnapshot" JSONB,
  ADD COLUMN "convertedAt" TIMESTAMP(3),
  ADD COLUMN "mrpSubtotalPaise" INTEGER,
  ADD COLUMN "pricingMode" TEXT,
  ADD COLUMN "pricingPercent" INTEGER,
  ADD COLUMN "remainingBalancePaise" INTEGER,
  ADD COLUMN "reservationCreditPaise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'storefront',
  ADD COLUMN "waitlistDiscountPaise" INTEGER,
  ADD COLUMN "waitlistReservationId" TEXT,
  ALTER COLUMN "shippingAddress" DROP NOT NULL;

ALTER TABLE "WaitlistReservation"
  ADD COLUMN "pricingMode" TEXT NOT NULL DEFAULT 'exact_revealed_price',
  ADD COLUMN "pricingValuePaise" INTEGER;

CREATE UNIQUE INDEX "Order_waitlistReservationId_key" ON "Order"("waitlistReservationId");

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_waitlistReservationId_fkey"
  FOREIGN KEY ("waitlistReservationId") REFERENCES "WaitlistReservation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

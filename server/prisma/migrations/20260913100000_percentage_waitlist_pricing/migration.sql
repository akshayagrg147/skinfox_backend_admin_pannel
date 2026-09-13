-- New waitlist reservations use the admin-configured percentage of each
-- product's MRP by default. Existing rows retain their stored pricing mode.
ALTER TABLE "WaitlistReservation"
  ALTER COLUMN "pricingMode" SET DEFAULT 'discount_off_mrp';

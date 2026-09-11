-- Preserve the current revealed-price entitlement for reservations created before
-- pricing snapshots were introduced. Future reservations write this at creation.
UPDATE "WaitlistReservation" AS reservation
SET "pricingValuePaise" = COALESCE(
  (SELECT NULLIF(setting."value"->>'founderPricePaise', '')::INTEGER
   FROM "StoreSetting" AS setting
   WHERE setting."key" = 'waitlist-config'),
  59900)
WHERE reservation."pricingMode" = 'exact_revealed_price'
  AND reservation."pricingValuePaise" IS NULL;

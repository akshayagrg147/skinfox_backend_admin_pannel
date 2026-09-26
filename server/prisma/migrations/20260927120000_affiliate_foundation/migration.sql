-- Phase 2 affiliate foundation. Existing orders, payments, products, coupons,
-- and customer records remain the source of truth; these tables add only
-- affiliate-specific configuration and financial metadata.

CREATE TYPE "AffiliateCommissionStatus" AS ENUM ('pending', 'approved', 'available', 'withdrawal_requested', 'processing', 'paid', 'cancelled', 'rejected', 'reversed', 'refunded');
CREATE TYPE "AffiliateCommissionRuleType" AS ENUM ('percentage', 'fixed');
CREATE TYPE "AffiliateCommissionRuleScope" AS ENUM ('global', 'affiliate', 'product', 'category', 'campaign');
CREATE TYPE "AffiliateCampaignStatus" AS ENUM ('draft', 'scheduled', 'active', 'paused', 'expired', 'archived');

ALTER TYPE "AffiliateRedemptionStatus" ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE "AffiliateRedemptionStatus" ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE "AffiliateRedemptionStatus" ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE "AffiliateRedemptionStatus" ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE "Affiliate"
  ADD COLUMN "publicId" TEXT,
  ADD COLUMN "instagramHandle" TEXT,
  ADD COLUMN "youtubeChannel" TEXT,
  ADD COLUMN "websiteUrl" TEXT,
  ADD COLUMN "otherSocialProfiles" JSONB,
  ADD COLUMN "audienceSize" INTEGER,
  ADD COLUMN "promotionMethod" TEXT,
  ADD COLUMN "country" TEXT DEFAULT 'India',
  ADD COLUMN "address" JSONB,
  ADD COLUMN "bankDetailsEncrypted" TEXT,
  ADD COLUMN "bankAccountLast4" TEXT,
  ADD COLUMN "bankIfscLast4" TEXT,
  ADD COLUMN "termsVersion" TEXT,
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);

WITH numbered AS (
  SELECT "id", 'SKX' || LPAD(ROW_NUMBER() OVER (ORDER BY "createdAt", "id")::TEXT, 6, '0') AS "publicId"
  FROM "Affiliate"
)
UPDATE "Affiliate" AS affiliate
SET "publicId" = numbered."publicId"
FROM numbered
WHERE affiliate."id" = numbered."id";

ALTER TABLE "Affiliate" ALTER COLUMN "publicId" SET NOT NULL;
CREATE UNIQUE INDEX "Affiliate_publicId_key" ON "Affiliate"("publicId");

CREATE TABLE "AffiliateSequence" (
  "id" TEXT NOT NULL,
  "nextValue" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateSequence_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AffiliateSequence" ("id", "nextValue")
SELECT 'affiliate', COALESCE(MAX(SUBSTRING("publicId" FROM 4)::INTEGER), 0) + 1
FROM "Affiliate"
ON CONFLICT ("id") DO UPDATE SET "nextValue" = EXCLUDED."nextValue";

ALTER TABLE "AffiliateReferralClick"
  ADD COLUMN "sessionId" TEXT,
  ADD COLUMN "landingUrl" TEXT,
  ADD COLUMN "productSlug" TEXT,
  ADD COLUMN "utmSource" TEXT,
  ADD COLUMN "utmMedium" TEXT,
  ADD COLUMN "utmCampaign" TEXT,
  ADD COLUMN "utmTerm" TEXT,
  ADD COLUMN "utmContent" TEXT,
  ADD COLUMN "metadata" JSONB;

ALTER TABLE "AffiliateAttribution"
  ADD COLUMN "status" "AffiliateCommissionStatus" NOT NULL DEFAULT 'available',
  ADD COLUMN "eligibleAmountPaise" INTEGER,
  ADD COLUMN "commissionType" "AffiliateCommissionRuleType" NOT NULL DEFAULT 'percentage',
  ADD COLUMN "commissionRateBps" INTEGER,
  ADD COLUMN "ruleSnapshot" JSONB,
  ADD COLUMN "holdUntil" TIMESTAMP(3),
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "availableAt" TIMESTAMP(3),
  ADD COLUMN "reversedAt" TIMESTAMP(3),
  ADD COLUMN "clickId" TEXT,
  ADD COLUMN "attributionExpiresAt" TIMESTAMP(3),
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "AffiliateRedemptionRequest"
  ADD COLUMN "transactionId" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "failureReason" TEXT;

CREATE TABLE "AffiliateLink" (
  "id" TEXT NOT NULL,
  "affiliateId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT,
  "targetPath" TEXT NOT NULL,
  "productId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AffiliateLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateCampaign" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "AffiliateCampaignStatus" NOT NULL DEFAULT 'draft',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "productIds" TEXT[] NOT NULL,
  "categoryIds" TEXT[] NOT NULL,
  "affiliateIds" TEXT[] NOT NULL,
  "couponId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AffiliateCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateCommissionRule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "scope" "AffiliateCommissionRuleScope" NOT NULL,
  "type" "AffiliateCommissionRuleType" NOT NULL,
  "rateBps" INTEGER,
  "fixedAmountPaise" INTEGER,
  "eligibleBasis" TEXT NOT NULL DEFAULT 'discounted_product_subtotal',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "affiliateId" TEXT,
  "productId" TEXT,
  "categoryId" TEXT,
  "campaignId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AffiliateCommissionRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateCommissionItem" (
  "id" TEXT NOT NULL,
  "attributionId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "eligibleAmountPaise" INTEGER NOT NULL,
  "commissionPaise" INTEGER NOT NULL,
  "refundedAmountPaise" INTEGER NOT NULL DEFAULT 0,
  "status" "AffiliateCommissionStatus" NOT NULL DEFAULT 'available',
  "ruleSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AffiliateCommissionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AffiliateLink_code_key" ON "AffiliateLink"("code");
CREATE INDEX "AffiliateLink_affiliateId_active_createdAt_idx" ON "AffiliateLink"("affiliateId", "active", "createdAt");
CREATE INDEX "AffiliateLink_productId_idx" ON "AffiliateLink"("productId");
CREATE INDEX "AffiliateCampaign_status_startsAt_endsAt_idx" ON "AffiliateCampaign"("status", "startsAt", "endsAt");
CREATE INDEX "AffiliateCommissionRule_scope_active_startsAt_endsAt_idx" ON "AffiliateCommissionRule"("scope", "active", "startsAt", "endsAt");
CREATE INDEX "AffiliateCommissionRule_affiliateId_active_idx" ON "AffiliateCommissionRule"("affiliateId", "active");
CREATE INDEX "AffiliateCommissionRule_productId_active_idx" ON "AffiliateCommissionRule"("productId", "active");
CREATE INDEX "AffiliateCommissionRule_categoryId_active_idx" ON "AffiliateCommissionRule"("categoryId", "active");
CREATE INDEX "AffiliateCommissionRule_campaignId_active_idx" ON "AffiliateCommissionRule"("campaignId", "active");
CREATE UNIQUE INDEX "AffiliateAttribution_clickId_key" ON "AffiliateAttribution"("clickId");
CREATE INDEX "AffiliateAttribution_status_holdUntil_idx" ON "AffiliateAttribution"("status", "holdUntil");
CREATE INDEX "AffiliateReferralClick_visitorHash_createdAt_idx" ON "AffiliateReferralClick"("visitorHash", "createdAt");
CREATE UNIQUE INDEX "AffiliateCommissionItem_attributionId_orderItemId_key" ON "AffiliateCommissionItem"("attributionId", "orderItemId");
CREATE INDEX "AffiliateCommissionItem_status_createdAt_idx" ON "AffiliateCommissionItem"("status", "createdAt");

ALTER TABLE "AffiliateLink" ADD CONSTRAINT "AffiliateLink_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateLink" ADD CONSTRAINT "AffiliateLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AffiliateCommissionRule" ADD CONSTRAINT "AffiliateCommissionRule_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateCommissionRule" ADD CONSTRAINT "AffiliateCommissionRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateCommissionRule" ADD CONSTRAINT "AffiliateCommissionRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateCommissionRule" ADD CONSTRAINT "AffiliateCommissionRule_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AffiliateCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateAttribution" ADD CONSTRAINT "AffiliateAttribution_clickId_fkey" FOREIGN KEY ("clickId") REFERENCES "AffiliateReferralClick"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AffiliateCommissionItem" ADD CONSTRAINT "AffiliateCommissionItem_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "AffiliateAttribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateCommissionItem" ADD CONSTRAINT "AffiliateCommissionItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

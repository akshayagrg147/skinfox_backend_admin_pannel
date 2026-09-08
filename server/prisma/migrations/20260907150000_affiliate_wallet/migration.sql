CREATE TYPE "AffiliateStatus" AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TYPE "AffiliateWalletEntryType" AS ENUM ('commission', 'redemption_request', 'redemption_reversal');
CREATE TYPE "AffiliateRedemptionStatus" AS ENUM ('requested', 'paid', 'rejected');

ALTER TABLE "Cart" ADD COLUMN "affiliateId" TEXT;

CREATE TABLE "Affiliate" (
  "id" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT NOT NULL,
  "panEncrypted" TEXT NOT NULL,
  "panLast4" TEXT NOT NULL,
  "whatsappNumber" TEXT,
  "city" TEXT,
  "state" TEXT,
  "payoutUpiId" TEXT,
  "status" "AffiliateStatus" NOT NULL DEFAULT 'pending',
  "referralCode" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateSession" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "affiliateId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateOtpChallenge" (
  "id" TEXT NOT NULL,
  "affiliateId" TEXT,
  "phone" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateOtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateReferralClick" (
  "id" TEXT NOT NULL,
  "affiliateId" TEXT NOT NULL,
  "cartId" TEXT,
  "referralCode" TEXT NOT NULL,
  "visitorHash" TEXT,
  "landingPath" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateReferralClick_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateAttribution" (
  "id" TEXT NOT NULL,
  "affiliateId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "referralCode" TEXT NOT NULL,
  "commissionPaise" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateAttribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateRedemptionRequest" (
  "id" TEXT NOT NULL,
  "affiliateId" TEXT NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "status" "AffiliateRedemptionStatus" NOT NULL DEFAULT 'requested',
  "payoutUpiId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateRedemptionRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateWalletEntry" (
  "id" TEXT NOT NULL,
  "affiliateId" TEXT NOT NULL,
  "type" "AffiliateWalletEntryType" NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "attributionId" TEXT,
  "redemptionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateWalletEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Affiliate_email_key" ON "Affiliate"("email");
CREATE UNIQUE INDEX "Affiliate_phone_key" ON "Affiliate"("phone");
CREATE UNIQUE INDEX "Affiliate_referralCode_key" ON "Affiliate"("referralCode");
CREATE UNIQUE INDEX "AffiliateSession_tokenHash_key" ON "AffiliateSession"("tokenHash");
CREATE UNIQUE INDEX "AffiliateAttribution_orderId_key" ON "AffiliateAttribution"("orderId");
CREATE UNIQUE INDEX "AffiliateWalletEntry_attributionId_key" ON "AffiliateWalletEntry"("attributionId");
CREATE INDEX "Cart_affiliateId_updatedAt_idx" ON "Cart"("affiliateId", "updatedAt");
CREATE INDEX "Affiliate_status_createdAt_idx" ON "Affiliate"("status", "createdAt");
CREATE INDEX "AffiliateSession_affiliateId_expiresAt_idx" ON "AffiliateSession"("affiliateId", "expiresAt");
CREATE INDEX "AffiliateOtpChallenge_phone_createdAt_idx" ON "AffiliateOtpChallenge"("phone", "createdAt");
CREATE INDEX "AffiliateOtpChallenge_expiresAt_verifiedAt_idx" ON "AffiliateOtpChallenge"("expiresAt", "verifiedAt");
CREATE INDEX "AffiliateReferralClick_affiliateId_createdAt_idx" ON "AffiliateReferralClick"("affiliateId", "createdAt");
CREATE INDEX "AffiliateReferralClick_cartId_createdAt_idx" ON "AffiliateReferralClick"("cartId", "createdAt");
CREATE INDEX "AffiliateAttribution_affiliateId_createdAt_idx" ON "AffiliateAttribution"("affiliateId", "createdAt");
CREATE INDEX "AffiliateWalletEntry_affiliateId_createdAt_idx" ON "AffiliateWalletEntry"("affiliateId", "createdAt");
CREATE INDEX "AffiliateRedemptionRequest_affiliateId_status_createdAt_idx" ON "AffiliateRedemptionRequest"("affiliateId", "status", "createdAt");

ALTER TABLE "Cart" ADD CONSTRAINT "Cart_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AffiliateSession" ADD CONSTRAINT "AffiliateSession_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateOtpChallenge" ADD CONSTRAINT "AffiliateOtpChallenge_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AffiliateReferralClick" ADD CONSTRAINT "AffiliateReferralClick_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateAttribution" ADD CONSTRAINT "AffiliateAttribution_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AffiliateAttribution" ADD CONSTRAINT "AffiliateAttribution_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AffiliateRedemptionRequest" ADD CONSTRAINT "AffiliateRedemptionRequest_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AffiliateRedemptionRequest" ADD CONSTRAINT "AffiliateRedemptionRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AffiliateWalletEntry" ADD CONSTRAINT "AffiliateWalletEntry_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AffiliateWalletEntry" ADD CONSTRAINT "AffiliateWalletEntry_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "AffiliateAttribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AffiliateWalletEntry" ADD CONSTRAINT "AffiliateWalletEntry_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "AffiliateRedemptionRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

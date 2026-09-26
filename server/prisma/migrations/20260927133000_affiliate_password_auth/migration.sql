-- Email/password sign-in is optional so existing affiliate applications can
-- continue using the configured mobile OTP flow until they set a password.
ALTER TABLE "Affiliate" ADD COLUMN "passwordHash" TEXT;

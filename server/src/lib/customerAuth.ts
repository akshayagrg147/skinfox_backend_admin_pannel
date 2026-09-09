import { hashToken } from './crypto.js'

type Environment = Record<string, string | undefined>

const positiveInteger = (value: string | undefined, fallback: number, maximum: number) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback
}

export const normalizeIndianPhone = (value: string) => {
  const compact = value.trim().replace(/[\s()-]/g, '')
  const withoutCountryCode = compact.startsWith('+91') ? compact.slice(3) : compact.startsWith('91') && compact.length === 12 ? compact.slice(2) : compact
  return /^[6-9]\d{9}$/.test(withoutCountryCode) ? withoutCountryCode : null
}

export const customerSessionTtlDays = (env: Environment = process.env) => positiveInteger(env.CUSTOMER_SESSION_TTL_DAYS, 30, 90)

// Affiliate OTP is intentionally configured independently from customer auth.
// A production storefront can use Firebase while the affiliate portal remains
// on its existing provider until that migration is explicitly enabled.
export const affiliateOtpConfig = (env: Environment = process.env) => {
  const mode = env.AFFILIATE_OTP_MODE ?? (env.NODE_ENV === 'production' ? 'disabled' : 'static')
  const code = env.AFFILIATE_TEST_OTP ?? (env.NODE_ENV === 'production' ? '' : '123456')
  return {
    mode,
    code,
    exposeTestCode: env.AFFILIATE_OTP_EXPOSE_TEST_CODE === 'true',
    ttlMinutes: positiveInteger(env.AFFILIATE_OTP_TTL_MINUTES, 10, 30),
    maxAttempts: positiveInteger(env.AFFILIATE_OTP_MAX_ATTEMPTS, 5, 10),
    resendSeconds: positiveInteger(env.AFFILIATE_OTP_RESEND_SECONDS, 60, 300),
    sessionTtlDays: positiveInteger(env.AFFILIATE_SESSION_TTL_DAYS, 30, 90),
  }
}

export const affiliateStaticOtpIsConfigured = (config = affiliateOtpConfig()) => config.mode === 'static' && /^\d{6}$/.test(config.code)

// The OTP is never stored in clear text, even in static local-test mode.
export const hashAffiliateOtp = (code: string) => hashToken(`affiliate-otp:${code}`)

import { describe, expect, it } from 'vitest'
import { affiliateOtpConfig, affiliateStaticOtpIsConfigured, customerSessionTtlDays, hashAffiliateOtp, normalizeIndianPhone } from './customerAuth.js'

describe('customer authentication configuration', () => {
  it('normalizes supported Indian mobile input without accepting invalid numbers', () => {
    expect(normalizeIndianPhone('9876543210')).toBe('9876543210')
    expect(normalizeIndianPhone('+91 98765 43210')).toBe('9876543210')
    expect(normalizeIndianPhone('1234567890')).toBeNull()
    expect(normalizeIndianPhone('98765')).toBeNull()
  })

  it('keeps affiliate OTP settings independent from customer Firebase auth', () => {
    const config = affiliateOtpConfig({ NODE_ENV: 'development', AFFILIATE_OTP_MODE: 'static', AFFILIATE_TEST_OTP: '654321' })
    expect(affiliateStaticOtpIsConfigured(config)).toBe(true)
    expect(affiliateStaticOtpIsConfigured(affiliateOtpConfig({ NODE_ENV: 'production' }))).toBe(false)
    expect(hashAffiliateOtp('654321')).not.toContain('654321')
    expect(customerSessionTtlDays({ CUSTOMER_SESSION_TTL_DAYS: '45' })).toBe(45)
  })
})

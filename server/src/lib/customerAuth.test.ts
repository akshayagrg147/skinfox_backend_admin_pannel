import { describe, expect, it } from 'vitest'
import { customerOtpConfig, hashCustomerOtp, normalizeIndianPhone, staticOtpIsConfigured } from './customerAuth.js'

describe('customer OTP test configuration', () => {
  it('normalizes supported Indian mobile input without accepting invalid numbers', () => {
    expect(normalizeIndianPhone('9876543210')).toBe('9876543210')
    expect(normalizeIndianPhone('+91 98765 43210')).toBe('9876543210')
    expect(normalizeIndianPhone('1234567890')).toBeNull()
    expect(normalizeIndianPhone('98765')).toBeNull()
  })

  it('only enables a six digit static code when explicitly configured', () => {
    const config = customerOtpConfig({ NODE_ENV: 'production', CUSTOMER_OTP_MODE: 'static', CUSTOMER_TEST_OTP: '654321' })
    expect(staticOtpIsConfigured(config)).toBe(true)
    expect(staticOtpIsConfigured(customerOtpConfig({ NODE_ENV: 'production' }))).toBe(false)
    expect(hashCustomerOtp('654321')).not.toContain('654321')
  })
})

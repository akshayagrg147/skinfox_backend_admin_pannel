import { describe, expect, it } from 'vitest'
import { parseStoredWaitlistSettings, waitlistDefaultsFromEnv, waitlistSettingsSchema } from './waitlistConfig.js'

describe('waitlist configuration', () => {
  it('uses safe environment defaults', () => {
    expect(waitlistDefaultsFromEnv({})).toEqual({ enabled: true, depositPaise: 9900, discountPercent: 25, termsVersion: '2026-09-10' })
  })

  it('normalises environment limits', () => {
    expect(waitlistDefaultsFromEnv({ WAITLIST_ENABLED: 'false', WAITLIST_DEPOSIT_PAISE: '10', WAITLIST_DISCOUNT_PERCENT: '99', WAITLIST_TERMS_VERSION: ' launch-1 ' })).toEqual({ enabled: false, depositPaise: 100, discountPercent: 90, termsVersion: 'launch-1' })
  })

  it('rejects unsafe admin values', () => {
    expect(waitlistSettingsSchema.safeParse({ enabled: true, depositPaise: 0, discountPercent: 100, termsVersion: '' }).success).toBe(false)
  })

  it('falls back when persisted settings are invalid', () => {
    const fallback = waitlistDefaultsFromEnv({})
    expect(parseStoredWaitlistSettings({ enabled: 'yes' }, fallback)).toEqual(fallback)
  })
})

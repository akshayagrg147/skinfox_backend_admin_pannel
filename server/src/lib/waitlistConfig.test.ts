import { describe, expect, it } from 'vitest'
import { calculateWaitlistDepositPaise, createWaitlistId, parseStoredWaitlistSettings, waitlistDefaultsFromEnv, waitlistSettingsSchema } from './waitlistConfig.js'

describe('waitlist configuration', () => {
  const launchDefaults = { refundable: false, stage: 'waitlist', founderCapacity: 200, founderPricePaise: 59900, launchPricePaise: 64900, regularPricePaise: 70000 }

  it('uses safe environment defaults', () => {
    expect(waitlistDefaultsFromEnv({})).toEqual({ enabled: true, depositPaise: 9900, discountPercent: 25, termsVersion: '2026-09-10-nonrefundable', ...launchDefaults })
  })

  it('normalises environment limits', () => {
    expect(waitlistDefaultsFromEnv({ WAITLIST_ENABLED: 'false', WAITLIST_DEPOSIT_PAISE: '10', WAITLIST_DISCOUNT_PERCENT: '99', WAITLIST_TERMS_VERSION: ' launch-1 ' })).toEqual({ enabled: false, depositPaise: 100, discountPercent: 90, termsVersion: 'launch-1', ...launchDefaults, stage: 'launch' })
  })

  it('rejects unsafe admin values', () => {
    expect(waitlistSettingsSchema.safeParse({ enabled: true, depositPaise: 0, discountPercent: 100, termsVersion: '' }).success).toBe(false)
  })

  it('falls back when persisted settings are invalid', () => {
    const fallback = waitlistDefaultsFromEnv({})
    expect(parseStoredWaitlistSettings({ enabled: 'yes' }, fallback)).toEqual(fallback)
  })

  it('upgrades legacy persisted settings with the Founding 200 defaults', () => {
    const fallback = waitlistDefaultsFromEnv({})
    expect(parseStoredWaitlistSettings({ enabled: true, depositPaise: 9900, discountPercent: 25, termsVersion: 'legacy' }, fallback)).toEqual(fallback)
  })

  it('does not allow the waitlist reservation fee to be configured as refundable', () => {
    expect(waitlistSettingsSchema.safeParse({ ...waitlistDefaultsFromEnv({}), refundable: true }).success).toBe(false)
  })

  it('keeps the launch price ladder in increasing order', () => {
    expect(waitlistSettingsSchema.safeParse({ ...waitlistDefaultsFromEnv({}), founderPricePaise: 65000, launchPricePaise: 59900 }).success).toBe(false)
  })

  it('calculates the reservation fee per product unit', () => {
    expect(calculateWaitlistDepositPaise(9900, [2, 3])).toBe(49500)
  })

  it('rejects invalid quantities and unsafe totals', () => {
    expect(() => calculateWaitlistDepositPaise(9900, [0])).toThrow('Invalid waitlist deposit calculation input.')
    expect(() => calculateWaitlistDepositPaise(10_000_000, Array.from({ length: 26 }, () => 8))).toThrow('Waitlist deposit total is too large.')
  })

  it('creates a readable customer support reference', () => {
    expect(createWaitlistId(new Date('2026-09-10T00:00:00.000Z'))).toMatch(/^SFWL-2026-[A-F0-9]{10}$/)
  })
})

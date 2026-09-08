import { describe, expect, it } from 'vitest'
import { affiliateCommissionPaise, isValidPan, MINIMUM_AFFILIATE_REDEMPTION_PAISE } from './affiliate.js'

describe('affiliate rules', () => {
  it('credits ten percent of discounted selling value, excluding delivery charges', () => {
    expect(affiliateCommissionPaise(70_000, 10_000)).toBe(6_000)
    expect(affiliateCommissionPaise(10_000, 15_000)).toBe(0)
  })

  it('requires a valid PAN format and a five-hundred-rupee redemption floor', () => {
    expect(isValidPan('ABCDE1234F')).toBe(true)
    expect(isValidPan('ABCDE12345')).toBe(false)
    expect(MINIMUM_AFFILIATE_REDEMPTION_PAISE).toBe(50_000)
  })
})

import { describe, expect, it } from 'vitest'
import { affiliateCommissionPaise, calculateAffiliateCommission, isValidPan, MINIMUM_AFFILIATE_REDEMPTION_PAISE, selectAffiliateCommissionRule } from './affiliate.js'

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

  it('selects the documented rule precedence instead of database order', () => {
    const startsAt = new Date('2026-01-01T00:00:00.000Z')
    const rules = [
      { id: 'global', scope: 'global' as const, type: 'percentage' as const, rateBps: 1_000, startsAt },
      { id: 'product', scope: 'product' as const, type: 'percentage' as const, rateBps: 1_500, startsAt },
      { id: 'campaign', scope: 'campaign' as const, type: 'percentage' as const, rateBps: 2_000, startsAt },
      { id: 'affiliate', scope: 'affiliate' as const, type: 'percentage' as const, rateBps: 1_200, startsAt },
    ]
    expect(selectAffiliateCommissionRule(rules, new Date('2026-09-27T00:00:00.000Z'))?.id).toBe('campaign')
  })

  it('calculates percentage and fixed commissions in paise without exceeding the eligible value', () => {
    const startsAt = new Date('2026-01-01T00:00:00.000Z')
    expect(calculateAffiliateCommission(90_000, { id: 'p', scope: 'product', type: 'percentage', rateBps: 1_500, startsAt })).toEqual({ eligibleAmountPaise: 90_000, commissionPaise: 13_500 })
    expect(calculateAffiliateCommission(90_000, { id: 'f', scope: 'campaign', type: 'fixed', fixedAmountPaise: 100_000, startsAt })).toEqual({ eligibleAmountPaise: 90_000, commissionPaise: 90_000 })
  })
})

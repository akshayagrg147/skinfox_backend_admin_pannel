import { describe, expect, it } from 'vitest'
import { calculateCart, calculateDiscount, isValidPincode } from './pricing.js'

describe('pricing invariants', () => {
  it('keeps null-priced products out of payable checkout', () => {
    const quote = calculateCart([{ quantity: 1, unitPricePaise: null, purchaseState: 'coming_soon' }])
    expect(quote.subtotalPaise).toBe(0)
    expect(quote.totalPaise).toBe(0)
    expect(quote.purchaseEligible).toBe(false)
    expect(quote.validationMessages[0]).toMatch(/coming soon/i)
  })

  it('calculates GST, shipping and COD in paise', () => {
    const quote = calculateCart([{ quantity: 2, unitPricePaise: 60000 }], null, true, true)
    expect(quote.subtotalPaise).toBe(120000)
    expect(quote.taxPaise).toBe(18305)
    expect(quote.shippingPaise).toBe(0)
    expect(quote.codPaise).toBe(4900)
    expect(quote.totalPaise).toBe(143205)
  })

  it('caps coupon discounts and rejects inactive or below-minimum coupons', () => {
    const now = new Date()
    const coupon = { type: 'percentage' as const, value: 25, minSpendPaise: 10000, active: true, startsAt: new Date(now.getTime() - 1000), endsAt: new Date(now.getTime() + 1000) }
    expect(calculateDiscount(20000, coupon)).toBe(5000)
    expect(calculateDiscount(5000, coupon)).toBe(0)
    expect(calculateDiscount(20000, { ...coupon, value: 200 })).toBe(20000)
  })

  it('validates six-digit Indian pincodes', () => {
    expect(isValidPincode('560001')).toBe(true)
    expect(isValidPincode('56001')).toBe(false)
    expect(isValidPincode('56000A')).toBe(false)
    expect(isValidPincode('000000')).toBe(false)
  })
})

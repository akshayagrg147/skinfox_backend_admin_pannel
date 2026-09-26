import { describe, expect, it } from 'vitest'
import { defaultLaunchPromotion, launchPromotionCommittedReservations, launchPromotionDiscount, launchPromotionEligibleSubtotal, launchPromotionStatus } from './launchPromotion.js'

describe('launch promotion', () => {
  it('defaults to a 40 percent, 500-order offer', () => {
    const promotion = defaultLaunchPromotion()
    expect(promotion.discountPercent).toBe(40)
    expect(promotion.maximumOrders).toBe(500)
    expect(promotion.offlineReservations).toBe(0)
  })

  it('stops exactly at capacity and discounts on the server calculation', () => {
    const promotion = defaultLaunchPromotion()
    expect(launchPromotionDiscount(10000, promotion, 499)).toBe(4000)
    expect(launchPromotionDiscount(10000, promotion, 500)).toBe(0)
    expect(launchPromotionStatus(promotion, 500)).toBe('completed')
  })

  it('counts confirmed offline reservations against launch capacity', () => {
    const promotion = { ...defaultLaunchPromotion(), offlineReservations: 12 }
    expect(launchPromotionCommittedReservations(promotion, 488)).toBe(500)
    expect(launchPromotionStatus(promotion, launchPromotionCommittedReservations(promotion, 488))).toBe('completed')
    expect(launchPromotionStatus(promotion, launchPromotionCommittedReservations(promotion, 487))).toBe('active')
  })

  it('does not apply the launch discount twice to catalogue sale prices', () => {
    expect(launchPromotionEligibleSubtotal([
      { quantity: 1, unitPricePaise: 83600, mrpPaise: 95000 },
      { quantity: 2, unitPricePaise: 70000, mrpPaise: 70000 },
      { quantity: 1, unitPricePaise: null, mrpPaise: 100000 },
    ])).toBe(140000)
  })
})

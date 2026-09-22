import { describe, expect, it } from 'vitest'
import { defaultLaunchPromotion, launchPromotionDiscount, launchPromotionEligibleSubtotal, launchPromotionStatus } from './launchPromotion.js'

describe('launch promotion', () => {
  it('defaults to a 50 percent, 500-order offer', () => {
    const promotion = defaultLaunchPromotion()
    expect(promotion.discountPercent).toBe(50)
    expect(promotion.maximumOrders).toBe(500)
  })

  it('stops exactly at capacity and discounts on the server calculation', () => {
    const promotion = defaultLaunchPromotion()
    expect(launchPromotionDiscount(10000, promotion, 499)).toBe(5000)
    expect(launchPromotionDiscount(10000, promotion, 500)).toBe(0)
    expect(launchPromotionStatus(promotion, 500)).toBe('completed')
  })

  it('does not apply the launch discount twice to catalogue sale prices', () => {
    expect(launchPromotionEligibleSubtotal([
      { quantity: 1, unitPricePaise: 83600, mrpPaise: 95000 },
      { quantity: 2, unitPricePaise: 70000, mrpPaise: 70000 },
      { quantity: 1, unitPricePaise: null, mrpPaise: 100000 },
    ])).toBe(140000)
  })
})

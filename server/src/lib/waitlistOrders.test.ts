import { describe, expect, it } from 'vitest'
import { calculateWaitlistOrderPricing } from './waitlistOrders.js'

const line = (quantity = 2) => ({ productId: 'rayyvia', productName: 'Rayyvia Sun Protect', productSlug: 'rayyvia-sun-protect', size: '60 g', quantity, mrpPaise: 70000 })

describe('waitlist order pricing', () => {
  it('calculates the 70% discount-off-MRP example with reservation credit', () => {
    const result = calculateWaitlistOrderPricing([line()], { mode: 'discount_off_mrp', percent: 70, reservationCreditPaise: 19800, shippingPaise: 5000 })
    expect(result.mrpSubtotalPaise).toBe(140000)
    expect(result.memberProductSubtotalPaise).toBe(42000)
    expect(result.waitlistDiscountPaise).toBe(98000)
    expect(result.remainingProductBalancePaise).toBe(22200)
    expect(result.finalAmountDuePaise).toBe(27200)
  })

  it('supports percentage-of-MRP pricing', () => {
    const result = calculateWaitlistOrderPricing([line(1)], { mode: 'percentage_of_mrp', percent: 70, reservationCreditPaise: 0 })
    expect(result.memberProductSubtotalPaise).toBe(49000)
  })

  it('supports exact revealed prices and multiple quantities', () => {
    const result = calculateWaitlistOrderPricing([{ ...line(1), exactPricePaise: 59900 }, { ...line(3), productId: 'coco', productName: 'Coco Kiss', productSlug: 'coco-kiss', size: '100 ml', mrpPaise: 80000, exactPricePaise: 64900 }], { mode: 'exact_revealed_price', reservationCreditPaise: 10000 })
    expect(result.memberProductSubtotalPaise).toBe(254600)
    expect(result.lines[1].lineTotalPaise).toBe(194700)
  })

  it('blocks an over-credit reservation instead of creating a negative balance', () => {
    expect(() => calculateWaitlistOrderPricing([line(1)], { mode: 'discount_off_mrp', percent: 70, reservationCreditPaise: 42001 })).toThrow('Reservation credit cannot exceed')
  })

  it('rejects unsafe or invalid pricing inputs', () => {
    expect(() => calculateWaitlistOrderPricing([line()], { mode: 'discount_off_mrp', percent: 100, reservationCreditPaise: 0 })).toThrow()
    expect(() => calculateWaitlistOrderPricing([], { mode: 'exact_revealed_price', reservationCreditPaise: 0 })).toThrow()
  })
})

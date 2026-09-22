import { describe, expect, it } from 'vitest'
import { formatCheckoutPaise } from './currency'

describe('formatCheckoutPaise', () => {
  it('keeps fractional rupees returned by shipping quotes', () => {
    expect(formatCheckoutPaise(69337)).toBe('₹693.37')
    expect(formatCheckoutPaise(4437)).toBe('₹44.37')
  })

  it('keeps whole checkout totals compact', () => {
    expect(formatCheckoutPaise(83600)).toBe('₹836')
  })
})

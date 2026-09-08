import { describe, expect, it } from 'vitest'
import { formatPrice, formatProductPrice, getQuizRecommendation, products } from './products'
import { getOfferPriceDetails } from '../components/ProductPrice'

describe('product catalogue', () => {
  it('contains a scalable set of uniquely identified actual products with visible pack sizes', () => {
    expect(products).toHaveLength(7)
    expect(new Set(products.map((product) => product.id)).size).toBe(products.length)
    expect(products.map((product) => product.id)).toEqual([
      'rayyvia-sun-protect',
      'coco-kiss-moisturizing-lotion',
      'acnfin-soft-face-wash',
      'hydrelle-dry-skin-specialist',
      'onion-shampoo',
      'intensive-scalp-hair-treatment',
      'onion-hair-oil',
    ])
    expect(products.every((product) => product.size.trim().length > 0)).toBe(true)
    expect(products.every((product) => product.image.startsWith('/products/') && product.imageAlt.length > 20)).toBe(true)
    expect(products.every((product) => product.imageScale <= 1)).toBe(true)
    expect(products.every((product) => product.media.length >= 2)).toBe(true)
    expect(products.every((product) => product.media[0].src === product.image)).toBe(true)
    expect(products.flatMap((product) => product.media).every((item) => item.src.startsWith('/products/') && item.alt.length > 12)).toBe(true)
    expect(products.find((product) => product.id === 'onion-shampoo')?.media.some((item) => item.type === 'video')).toBe(true)
  })

  it('distinguishes photographed MRP references from unconfirmed selling prices', () => {
    expect(formatPrice(1295)).toMatch(/₹1,295/)
    const expectedMrps = new Map([
      ['rayyvia-sun-protect', 700],
      ['acnfin-soft-face-wash', 760],
      ['hydrelle-dry-skin-specialist', 750],
    ])
    for (const product of products) {
      const expectedMrp = expectedMrps.get(product.id)
      if (expectedMrp) {
        expect(product).toMatchObject({ price: null, mrp: expectedMrp })
        expect(formatProductPrice(product)).toBe(`MRP ${formatPrice(expectedMrp)}`)
      } else {
        expect(formatProductPrice(product)).toBe('Price on launch')
      }
    }
  })

  it('calculates a real offer only when the selling price is lower than the MRP', () => {
    const offerProduct = { ...products[0], mrp: 700, price: 525 }
    expect(getOfferPriceDetails(offerProduct)).toMatchObject({ offerPrice: 525, mrp: 700, savings: 175, discountPercent: 25, hasOffer: true })
    expect(getOfferPriceDetails(offerProduct, 2)).toMatchObject({ offerPrice: 1050, mrp: 1400, savings: 350, discountPercent: 25, hasOffer: true })
    expect(getOfferPriceDetails({ ...offerProduct, price: 700 })).toMatchObject({ savings: 0, discountPercent: 0, hasOffer: false })
  })

  it('returns only existing products for every current-range finder focus', () => {
    for (const concern of ['Sun protection', 'Face cleansing', 'Gentle moisture', 'Cleansing', 'Oiling', 'Scalp care', 'Dry skin']) {
      const recommendations = getQuizRecommendation(concern)
      expect(recommendations.length).toBeGreaterThan(0)
      expect(recommendations.every((item) => products.some((product) => product.id === item.id))).toBe(true)
    }
    expect(getQuizRecommendation('Sun protection').map((item) => item.id)).toEqual(['rayyvia-sun-protect'])
    expect(getQuizRecommendation('Face cleansing').map((item) => item.id)).toEqual(['acnfin-soft-face-wash'])
    expect(getQuizRecommendation('Gentle moisture').map((item) => item.id)).toEqual(['coco-kiss-moisturizing-lotion'])
    expect(getQuizRecommendation('Cleansing').map((item) => item.id)).toEqual(['onion-shampoo'])
    expect(getQuizRecommendation('Scalp care').map((item) => item.id)).toEqual(['intensive-scalp-hair-treatment'])
  })

  it('does not carry any previous or legacy catalogue identifiers', () => {
    const ids = products.map((product) => product.id)
    for (const legacy of ['hydrelle-moisturising-lotion', 'acniv-soft-face-wash', 'coco-kiss-moisturising-lotion', 'hydrelle-pocket-lotion', 'soft-reset', 'waterglass']) {
      expect(ids).not.toContain(legacy)
    }
  })
})

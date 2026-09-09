import { describe, expect, it } from 'vitest'
import { productIsPurchasable, scoreCareFinderProducts } from './careFinder.js'

const available = (id: string, name = id) => ({ id, name, status: 'published', purchaseState: 'available', pricePaise: 70000, mrpPaise: 70000, variants: [{ purchaseState: 'available', pricePaise: 70000, mrpPaise: 70000, inventory: [{ availableQty: 50, reservedQty: 0 }] }] })

describe('care finder scoring', () => {
  it('matches multi-select answers, merges weights and keeps essential guidance', () => {
    const product = available('sun')
    const items = scoreCareFinderProducts([
      { productId: 'sun', answerKey: 'mainConcern', answerValue: 'sun_protection', weight: 30, metadata: { role: 'essential', reason: 'Daily protection' } },
      { productId: 'sun', answerKey: 'secondaryConcern', answerValue: 'sun_protection', weight: 12, metadata: { role: 'optional' } },
    ], [product], { mainConcern: 'sun_protection', secondaryConcern: ['sun_protection', 'dry_skin'] })
    expect(items[0].score).toBe(42)
    expect(items[0].metadata.role).toBe('essential')
    expect(items[0].matchedRules).toHaveLength(2)
  })

  it('excludes unpublished, unavailable and out-of-stock products', () => {
    expect(productIsPurchasable({ ...available('draft'), status: 'draft' })).toBe(false)
    expect(productIsPurchasable({ ...available('soon'), purchaseState: 'coming_soon' })).toBe(false)
    expect(productIsPurchasable({ ...available('empty'), variants: [{ purchaseState: 'available', pricePaise: 70000, inventory: [{ availableQty: 0, reservedQty: 0 }] }] })).toBe(false)
  })

  it('sorts by score and does not return a product with an avoid rule', () => {
    const first = available('first', 'First')
    const second = available('second', 'Second')
    const items = scoreCareFinderProducts([
      { productId: 'second', answerKey: 'careArea', answerValue: 'skin', weight: 3, metadata: { role: 'essential' } },
      { productId: 'first', answerKey: 'careArea', answerValue: 'skin', weight: 9, metadata: { role: 'essential', avoidIf: { sensitivity: ['sensitive'] } } },
    ], [first, second], { careArea: 'skin', sensitivity: 'sensitive' })
    expect(items.map((item) => item.product.id)).toEqual(['second'])
  })

  it('treats a concerning-symptom answer as an exclusion signal', () => {
    const product = available('sun')
    const items = scoreCareFinderProducts([{ productId: 'sun', answerKey: 'mainConcern', answerValue: 'sun_protection', weight: 30, metadata: { avoidIf: { sensitivity: ['concerning'] } } }], [product], { mainConcern: 'sun_protection', sensitivity: 'concerning' })
    expect(items).toEqual([])
  })
})

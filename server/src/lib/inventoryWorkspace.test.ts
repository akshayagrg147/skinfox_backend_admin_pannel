import { describe, expect, it } from 'vitest'
import { inventoryAdjustmentSchema, validateInventoryAdjustment } from './inventoryWorkspace.js'

describe('inventory adjustment safeguards', () => {
  it('rejects zero quantities and accepts signed whole-unit changes', () => {
    expect(() => inventoryAdjustmentSchema.parse({ variantId: 'v', locationId: 'l', quantity: 0, reason: 'Count' })).toThrow()
    expect(inventoryAdjustmentSchema.parse({ variantId: 'v', locationId: 'l', quantity: -2, reason: 'Cycle count correction' })).toMatchObject({ quantity: -2 })
  })

  it('prevents stale or invalid resulting counts', () => {
    const input = inventoryAdjustmentSchema.parse({ variantId: 'v', locationId: 'l', quantity: 4, reason: 'Receiving stock', expectedAvailableQty: 10, expectedReservedQty: 3 })
    expect(validateInventoryAdjustment({ availableQty: 10, reservedQty: 3 }, input)).toBe(14)
    expect(() => validateInventoryAdjustment({ availableQty: 9, reservedQty: 3 }, input)).toThrow(/changed/i)
    expect(() => validateInventoryAdjustment({ availableQty: 3, reservedQty: 3 }, { ...input, quantity: -1, expectedAvailableQty: 3, expectedReservedQty: 3 })).toThrow(/non-negative|reserved/i)
  })
})

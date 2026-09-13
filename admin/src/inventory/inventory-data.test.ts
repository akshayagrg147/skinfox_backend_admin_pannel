import { describe, expect, it } from 'vitest'
import { filterInventory, inventorySummary, movementLabel, stockFor, type InventoryRecord } from './inventory-data'

const row = (overrides: Partial<InventoryRecord> = {}): InventoryRecord => ({
  id: 'item-1', variantId: 'variant-1', locationId: 'location-1', availableQty: 10, reservedQty: 3, lowStockThreshold: 5,
  variant: { id: 'variant-1', sku: 'SFX-001', name: '50 g', size: '50 g', product: { id: 'product-1', name: 'Test cream', image: null, imageAlt: null, status: 'published', purchaseState: 'available' } },
  location: { id: 'location-1', name: 'Main warehouse', code: 'MAIN' }, ...overrides,
})

describe('inventory data helpers', () => {
  it('calculates available stock from on-hand minus reserved', () => {
    expect(stockFor(row())).toMatchObject({ tracked: true, onHand: 10, reserved: 3, free: 7, state: 'in_stock' })
    expect(stockFor(row({ availableQty: 4, reservedQty: 3 })).state).toBe('low_stock')
    expect(stockFor(row({ availableQty: 3, reservedQty: 3 })).state).toBe('out_of_stock')
  })

  it('summarises tracked rows without counting locations as extra SKUs', () => {
    expect(inventorySummary([row(), row({ id: 'item-2', locationId: 'location-2', location: { id: 'location-2', name: 'Overflow', code: 'OVERFLOW' } })])).toMatchObject({ skuCount: 1, locationCount: 2, onHand: 20, reserved: 6, free: 14 })
  })

  it('filters and sorts attention rows using operational status', () => {
    const healthy = row()
    const low = row({ id: 'item-2', variantId: 'variant-2', availableQty: 4, variant: { ...row().variant, id: 'variant-2', sku: 'SFX-002', product: { ...row().variant.product, id: 'product-2', name: 'Low cream' } } })
    expect(filterInventory([healthy, low], '', 'all', 'low_stock', 'attention')).toHaveLength(1)
    expect(filterInventory([healthy, low], '', 'all', 'all', 'attention')[0].id).toBe('item-2')
  })

  it('uses signed movement labels for the activity feed', () => {
    expect(movementLabel({ quantity: 12, type: 'adjustment' } as never)).toBe('+12 units')
    expect(movementLabel({ quantity: -2, type: 'sale' } as never)).toBe('−2 shipped')
  })
})

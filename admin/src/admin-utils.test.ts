import { describe, expect, it } from 'vitest'
import { availableScreens, canAccessScreen, defaultScreen, filterRows, formatAdminCell, withSearch } from './admin-utils'

describe('admin role navigation', () => {
  it('keeps privileged screens away from non-super-admin roles', () => {
    expect(canAccessScreen('ANALYST', 'audit')).toBe(true)
    expect(canAccessScreen('ANALYST', 'products')).toBe(false)
    expect(canAccessScreen('SUPPORT_AGENT', 'users')).toBe(false)
    expect(canAccessScreen('SUPER_ADMIN', 'media')).toBe(false)
    expect(canAccessScreen('CATALOG_MANAGER', 'media')).toBe(false)
    expect(defaultScreen('SUPPORT_AGENT')).toBe('orders')
    expect(availableScreens('UNKNOWN')).toEqual([])
  })
})

describe('admin tables', () => {
  const rows = [
    { id: '1', name: 'Rayyvia Sun Protect', status: 'coming_soon', metadata: { family: 'Skin' } },
    { id: '2', name: 'Onion Shampoo', status: 'published', metadata: { family: 'Hair' } },
  ]

  it('filters visible fields case-insensitively', () => {
    expect(filterRows(rows, ['name', 'status'], 'rayyvia')).toEqual([rows[0]])
    expect(filterRows(rows, ['metadata'], 'hair')).toEqual([rows[1]])
    expect(filterRows(rows, ['name'], 'missing')).toEqual([])
  })

  it('persists safe server-side search values in request paths', () => {
    expect(withSearch('/admin/products?limit=100', 'dry skin')).toBe('/admin/products?limit=100&q=dry%20skin')
    expect(withSearch('/admin/products', '   ')).toBe('/admin/products')
  })

  it('formats only paise fields as currency', () => {
    expect(formatAdminCell(7000, 'durationMs')).toBe('7,000')
    expect(formatAdminCell(7000, 'pricePaise')).toBe('₹70')
  })
})

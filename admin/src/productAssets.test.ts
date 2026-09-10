import { describe, expect, it } from 'vitest'
import { isProductImageAssetPath, makeProductSlug, splitAssetPaths } from './productAssets'

describe('admin product website assets', () => {
  it('accepts bundled product images and rejects uploads or external URLs', () => {
    expect(isProductImageAssetPath('/products/new-product.webp')).toBe(true)
    expect(isProductImageAssetPath('/products/range/new-product-front.png')).toBe(true)
    expect(isProductImageAssetPath('https://example.com/new-product.webp')).toBe(false)
    expect(isProductImageAssetPath('/uploads/new-product.webp')).toBe(false)
    expect(isProductImageAssetPath('/products/../private/new-product.webp')).toBe(false)
  })

  it('normalizes comma-separated gallery paths', () => {
    expect(splitAssetPaths(' /products/front.webp, /products/side.webp, ')).toEqual([
      '/products/front.webp',
      '/products/side.webp',
    ])
  })

  it('creates a clean product URL slug from its name', () => {
    expect(makeProductSlug('  SkinFox Daily Care +  ')).toBe('skinfox-daily-care')
  })
})

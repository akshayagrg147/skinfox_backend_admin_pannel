import { describe, expect, it } from 'vitest'
import { productImageAssetSchema, productMediaInputSchema } from './productAssets.js'

describe('product website assets', () => {
  it.each([
    '/products/new-product.webp',
    '/products/range/new-product-front.png',
    '/products/responsive/new-product-mobile.avif',
  ])('accepts bundled image path %s', (path) => {
    expect(productImageAssetSchema.safeParse(path).success).toBe(true)
  })

  it.each([
    'https://example.com/product.webp',
    '/uploads/product.webp',
    '/products/../private/product.webp',
    '/products/product.svg',
  ])('rejects non-product image path %s', (path) => {
    expect(productImageAssetSchema.safeParse(path).success).toBe(false)
  })

  it('allows a bundled product video with a bundled poster', () => {
    expect(productMediaInputSchema.safeParse({
      type: 'video',
      src: '/products/product-demo.mp4',
      poster: '/products/product-demo-poster.webp',
      alt: 'SkinFox product demonstration video',
    }).success).toBe(true)
  })
})

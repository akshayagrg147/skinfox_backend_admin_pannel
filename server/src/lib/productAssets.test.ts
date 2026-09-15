import { describe, expect, it } from 'vitest'
import { productImageAssetSchema, productImageSourceSchema, productMediaInputSchema } from './productAssets.js'

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

  it('allows HTTPS provider delivery URLs and verified local media URLs', () => {
    expect(productImageSourceSchema.safeParse('https://ik.imagekit.io/skinfox/products/product.webp').success).toBe(true)
    expect(productImageSourceSchema.safeParse('/api/v1/media/uploaded-product.webp').success).toBe(true)
  })

  it('requires a media asset reference for local uploaded product images', () => {
    const result = productMediaInputSchema.safeParse({
      type: 'image',
      src: '/api/v1/media/uploaded-product.webp',
      alt: 'SkinFox uploaded product image',
    })
    expect(result.success).toBe(false)
    expect(productMediaInputSchema.safeParse({
      type: 'image',
      src: '/api/v1/media/uploaded-product.webp',
      mediaAssetId: 'asset_123',
      alt: 'SkinFox uploaded product image',
    }).success).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { productImageSrcSet } from './productImages'

describe('product image source sets', () => {
  it('requests responsive ImageKit transformations for managed uploads', () => {
    expect(productImageSrcSet('https://ik.imagekit.io/skinfox/products/rayyvia.webp')).toBe(
      'https://ik.imagekit.io/skinfox/tr:w-320,q-80,f-auto/products/rayyvia.webp 320w, https://ik.imagekit.io/skinfox/tr:w-640,q-80,f-auto/products/rayyvia.webp 640w',
    )
  })

  it('keeps unknown sources on their original URL', () => {
    expect(productImageSrcSet('https://cdn.example.com/product.webp')).toBeUndefined()
  })
})

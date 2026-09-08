import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { products } from '../data/products'
import { ProductCard } from './ProductCard'

describe('ProductCard pricing', () => {
  it('keeps pricing in a dedicated commerce row below the product title', () => {
    const product = { ...products[0], mrp: 700, price: 525 }
    render(<ProductCard product={product} index={0} onView={vi.fn()} onAdd={vi.fn()} />)

    const title = screen.getAllByRole('button', { name: /rayyvia sun protect/i }).find((button) => button.classList.contains('product-card__title'))
    const pricing = screen.getByLabelText(/offer price ₹525.*mrp ₹700.*save ₹175/i)

    expect(title).toBeDefined()
    expect(pricing).toHaveClass('product-card__price')
    expect(title!).not.toContainElement(pricing)
    expect(pricing).toHaveTextContent('Offer price₹525MRP ₹700Save ₹175 · 25% off')
  })
})

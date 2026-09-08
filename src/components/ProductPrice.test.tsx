import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { products } from '../data/products'
import { ProductPrice } from './ProductPrice'

describe('ProductPrice', () => {
  it('shows the offer, crossed-out MRP, and savings only for a genuine discount', () => {
    const product = { ...products[0], mrp: 700, price: 525 }
    render(<ProductPrice product={product} />)

    expect(screen.getByText('Offer price')).toBeInTheDocument()
    expect(document.querySelector('.product-price__mrp')).toHaveTextContent('MRP ₹700')
    expect(screen.getByText('Save ₹175 · 25% off')).toBeInTheDocument()
    expect(screen.getByLabelText(/offer price ₹525.*mrp ₹700.*save ₹175/i)).toBeInTheDocument()
  })

  it('shows MRP and offer price without a savings claim when the values are equal', () => {
    render(<ProductPrice product={{ ...products[0], mrp: 700, price: 700 }} />)

    expect(screen.getByText('Offer price')).toBeInTheDocument()
    expect(screen.getByText(/MRP ₹700/)).toBeInTheDocument()
    expect(screen.queryByText(/off$/i)).not.toBeInTheDocument()
    expect(screen.getByText('₹700')).toBeInTheDocument()
  })
})

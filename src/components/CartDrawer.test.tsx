import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { products } from '../data/products'
import { CartDrawer } from './CartDrawer'

describe('CartDrawer waitlist pricing', () => {
  it('shows the per-unit deposit calculation and waits for explicit checkout', () => {
    const onCheckout = vi.fn()
    const onClose = vi.fn()

    render(<CartDrawer
      open
      lines={[{ product: products[0], quantity: 2 }, { product: products[1], quantity: 3 }]}
      onClose={onClose}
      onQuantity={vi.fn()}
      onRemove={vi.fn()}
      onCheckout={onCheckout}
      waitlistDepositPaise={9900}
    />)

    expect(screen.getByText(/reservation fee · ₹99 × 5/i)).toBeInTheDocument()
    expect(screen.getByText(/non-refundable waitlist reservation fee/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue to waitlist · ₹495/i })).toBeInTheDocument()
    expect(onCheckout).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /continue to waitlist · ₹495/i }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onCheckout).toHaveBeenCalledOnce()
  })
})

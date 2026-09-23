import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { products } from '../data/products'
import { CartDrawer } from './CartDrawer'

describe('CartDrawer pricing', () => {
  it('shows a normal cart subtotal and waits for explicit checkout', () => {
    const onCheckout = vi.fn()
    const onClose = vi.fn()
    const rayyvia = { ...products[0], price: 700 }
    const coco = { ...products[1], price: 800 }

    render(<CartDrawer
      open
      lines={[{ product: rayyvia, quantity: 2 }, { product: coco, quantity: 3 }]}
      onClose={onClose}
      onQuantity={vi.fn()}
      onRemove={vi.fn()}
      onCheckout={onCheckout}
    />)

    expect(screen.getByText('Subtotal')).toBeInTheDocument()
    expect(screen.getByText('₹3,800')).toBeInTheDocument()
    expect(screen.getByText(/complimentary delivery is unlocked/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /secure checkout/i })).toBeEnabled()
    expect(onCheckout).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /secure checkout/i }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onCheckout).toHaveBeenCalledOnce()
  })

  it('uses the API cart-line id for quantity and removal actions', () => {
    const onQuantity = vi.fn()
    const onRemove = vi.fn()
    const rayyvia = { ...products[0], price: 700 }

    render(<CartDrawer
      open
      lines={[{ id: 'cart-item-123', product: rayyvia, quantity: 2 }]}
      onClose={vi.fn()}
      onQuantity={onQuantity}
      onRemove={onRemove}
      onCheckout={vi.fn()}
    />)

    fireEvent.click(screen.getByRole('button', { name: /decrease rayyvia sun protect quantity/i }))
    fireEvent.click(screen.getByRole('button', { name: /remove rayyvia sun protect/i }))
    expect(onQuantity).toHaveBeenCalledWith('cart-item-123', 1)
    expect(onRemove).toHaveBeenCalledWith('cart-item-123')
  })
})

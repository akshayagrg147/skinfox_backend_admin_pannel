import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { formatPrice } from '../data/products'
import type { CartLine } from '../types'
import { ModalShell } from './ModalShell'
import { ProductVisual } from './ProductVisual'
import { ProductPrice } from './ProductPrice'

type CartDrawerProps = {
  open: boolean
  lines: CartLine[]
  onClose: () => void
  onQuantity: (id: string, quantity: number) => void
  onRemove: (id: string) => void
  onCheckout: () => void
  waitlistDepositPaise?: number
  waitlistDiscountPercent?: number
}

export function CartDrawer({ open, lines, onClose, onQuantity, onRemove, onCheckout, waitlistDepositPaise = 9900, waitlistDiscountPercent = 25 }: CartDrawerProps) {
  const hasPendingPrice = lines.some((line) => line.product.price === null)
  const subtotal = lines.reduce((sum, line) => sum + (line.product.price ?? 0) * line.quantity, 0)
  const threshold = 999
  const progress = Math.min((subtotal / threshold) * 100, 100)

  return (
    <ModalShell open={open} onClose={onClose} title="Shopping bag" drawer className="cart-drawer">
      <div className="drawer-heading">
        <span className="eyebrow">Your everyday essentials</span>
        <h2>Shopping bag <i>({lines.reduce((sum, line) => sum + line.quantity, 0)})</i></h2>
      </div>
      {lines.length === 0 ? (
        <div className="cart-empty">
          <span><ShoppingBag size={24} /></span>
          <h3>A little care starts here.</h3>
          <p>Explore skin, body and hair care, then add your favourites to your bag.</p>
          <button className="button button--dark" onClick={onClose}>Continue shopping</button>
        </div>
      ) : (
        <>
          {hasPendingPrice ? (
            <div className="shipping-meter shipping-meter--pending">
              <p>Prices will be revealed later. Join the priority waitlist now for a {waitlistDiscountPercent}% launch discount.</p>
            </div>
          ) : (
            <div className="shipping-meter">
              <p>{subtotal >= threshold ? 'Complimentary shipping unlocked.' : `${formatPrice(threshold - subtotal)} away from complimentary shipping.`}</p>
              <span><i style={{ width: `${progress}%` }} /></span>
            </div>
          )}
          <div className="cart-lines">
            {lines.map(({ product, quantity }) => (
              <article className="cart-line" key={product.id}>
                <div className="cart-line__visual" style={{ backgroundColor: product.tint }}><ProductVisual product={product} compact /></div>
                <div className="cart-line__body">
                  <div><h3>{product.name}</h3><p>{product.subtitle} · {product.size}</p></div>
                  <div className="cart-line__bottom">
                    <div className="quantity-control quantity-control--small" role="group" aria-label={`${product.name} quantity`}>
                      <button onClick={() => onQuantity(product.id, quantity - 1)} aria-label={`Decrease ${product.name} quantity`}><Minus size={13} /></button>
                      <span>{quantity}</span>
                      <button onClick={() => onQuantity(product.id, quantity + 1)} aria-label={`Increase ${product.name} quantity`}><Plus size={13} /></button>
                    </div>
                    <ProductPrice product={product} quantity={quantity} compact className="cart-line__price" />
                    <button className="remove-line" onClick={() => onRemove(product.id)} aria-label={`Remove ${product.name}`}><Trash2 size={15} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="cart-summary">
            <div><span>{hasPendingPrice ? 'Refundable deposit' : 'Subtotal'}</span><strong>{hasPendingPrice ? formatPrice(waitlistDepositPaise / 100) : formatPrice(subtotal)}</strong></div>
            <p>{hasPendingPrice ? 'Review the final prices later. Cancel before conversion for a full refund to your original payment method.' : 'Taxes included. Shipping calculated at checkout.'}</p>
            <button className="button button--copper" onClick={() => { onClose(); onCheckout() }}>
              {hasPendingPrice ? `Join priority waitlist · ${formatPrice(waitlistDepositPaise / 100)}` : 'Secure checkout'} <ArrowRight size={17} />
            </button>
          </div>
        </>
      )}
    </ModalShell>
  )
}

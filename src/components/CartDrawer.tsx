import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { formatPrice, formatProductPrice } from '../data/products'
import type { CartLine } from '../types'
import { ModalShell } from './ModalShell'
import { ProductVisual } from './ProductVisual'

type CartDrawerProps = {
  open: boolean
  lines: CartLine[]
  onClose: () => void
  onQuantity: (id: string, quantity: number) => void
  onRemove: (id: string) => void
  onCheckout: () => void
}

export function CartDrawer({ open, lines, onClose, onQuantity, onRemove, onCheckout }: CartDrawerProps) {
  const hasPendingPrice = lines.some((line) => line.product.price === null)
  const subtotal = lines.reduce((sum, line) => sum + (line.product.price ?? 0) * line.quantity, 0)
  const threshold = 999
  const progress = Math.min((subtotal / threshold) * 100, 100)

  return (
    <ModalShell open={open} onClose={onClose} title="Shopping bag" drawer className="cart-drawer">
      <div className="drawer-heading">
        <span className="eyebrow">Your SkinFox edit</span>
        <h2>Bag <i>({lines.reduce((sum, line) => sum + line.quantity, 0)})</i></h2>
      </div>
      {lines.length === 0 ? (
        <div className="cart-empty">
          <span><ShoppingBag size={24} /></span>
          <h3>Your ritual is waiting.</h3>
          <p>Add an essential or take the 60-second care finder to begin.</p>
          <button className="button button--dark" onClick={onClose}>Explore the edit</button>
        </div>
      ) : (
        <>
          {hasPendingPrice ? (
            <div className="shipping-meter shipping-meter--pending">
              <p>Launch prices are awaiting final confirmation. Your selection is saved in this local preview.</p>
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
                    <div className="quantity-control quantity-control--small">
                      <button onClick={() => onQuantity(product.id, quantity - 1)} aria-label={`Decrease ${product.name} quantity`}><Minus size={13} /></button>
                      <span>{quantity}</span>
                      <button onClick={() => onQuantity(product.id, quantity + 1)} aria-label={`Increase ${product.name} quantity`}><Plus size={13} /></button>
                    </div>
                    <strong>{product.price === null ? formatProductPrice(product) : formatPrice(product.price * quantity)}</strong>
                    <button className="remove-line" onClick={() => onRemove(product.id)} aria-label={`Remove ${product.name}`}><Trash2 size={15} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="cart-summary">
            <div><span>{hasPendingPrice ? 'Pricing status' : 'Subtotal'}</span><strong>{hasPendingPrice ? 'Confirm at launch' : formatPrice(subtotal)}</strong></div>
            <p>{hasPendingPrice ? 'No price or payment is collected in this preview.' : 'Taxes included. Shipping calculated at checkout.'}</p>
            <button className="button button--copper" onClick={() => { onClose(); onCheckout() }}>
              {hasPendingPrice ? 'Continue to launch preview' : 'Secure checkout'} <ArrowRight size={17} />
            </button>
          </div>
        </>
      )}
    </ModalShell>
  )
}

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
}

export function CartDrawer({ open, lines, onClose, onQuantity, onRemove, onCheckout }: CartDrawerProps) {
  const hasPendingPrice = lines.some((line) => line.product.price === null)
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0)
  const subtotal = lines.reduce((sum, line) => sum + (line.product.price ?? 0) * line.quantity, 0)
  const threshold = 2000
  const progress = Math.min((subtotal / threshold) * 100, 100)

  return (
    <ModalShell open={open} onClose={onClose} title="Shopping bag" drawer className="cart-drawer">
      <div className="drawer-heading">
        <span className="eyebrow">Your everyday essentials</span>
        <h2>Shopping bag <i>({totalQuantity})</i></h2>
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
          {!hasPendingPrice ? (
            <div className="shipping-meter">
              <p>{subtotal >= threshold ? 'Complimentary shipping unlocked.' : `${formatPrice(threshold - subtotal)} away from complimentary shipping.`}</p>
              <span><i style={{ width: `${progress}%` }} /></span>
            </div>
          ) : null}
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
            <div><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
            <p>{hasPendingPrice ? 'Some items are not available for purchase yet. Remove them to continue.' : subtotal >= threshold ? 'GST included. Complimentary delivery is unlocked.' : `GST included. Delivery is free on orders of ${formatPrice(threshold)} or more.`}</p>
            <button className="button button--copper" disabled={hasPendingPrice} onClick={() => { onClose(); onCheckout() }}>
              Secure checkout <ArrowRight size={17} />
            </button>
          </div>
        </>
      )}
    </ModalShell>
  )
}

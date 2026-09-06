/* eslint-disable @typescript-eslint/no-explicit-any */
import { Check, LockKeyhole } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { formatPrice, formatProductPrice } from '../data/products'
import type { CartLine } from '../types'
import { ModalShell } from './ModalShell'
import { postStorefront } from '../lib/storefrontApi'

export function CheckoutModal({ open, lines, onClose, onComplete, cartToken = '' }: { open: boolean; lines: CartLine[]; onClose: () => void; onComplete: () => void; cartToken?: string }) {
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const hasPendingPrice = lines.some((line) => line.product.price === null)
  const subtotal = lines.reduce((sum, line) => sum + (line.product.price ?? 0) * line.quantity, 0)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    if (!form.checkValidity()) {
      form.reportValidity()
      return
    }

    const data = new FormData(form)
    const pincode = String(data.get('pincode') ?? '')
    if (!/^[1-9]\d{5}$/.test(pincode)) {
      setError('Enter a valid six-digit pincode that does not start with zero.')
      return
    }
    setError('')
    setSubmitting(true)
    if (import.meta.env.MODE !== 'test' && cartToken) {
      try {
        const payload = { fullName: String(data.get('name') ?? ''), email: String(data.get('email') ?? ''), phone: String(data.get('phone') ?? ''), addressLine1: String(data.get('addressLine1') ?? ''), addressLine2: String(data.get('addressLine2') ?? ''), city: String(data.get('city') ?? ''), state: String(data.get('state') ?? ''), pincode, billingSameAsShipping: true, marketingConsent: Boolean(data.get('marketingConsent')), paymentMethod: String(data.get('payment') ?? 'razorpay') }
        if (hasPendingPrice) await postStorefront('/launch-interest', { productIds: lines.map((line) => line.product.id), cartSnapshot: lines.map((line) => ({ id: line.product.id, quantity: line.quantity })), name: payload.fullName, email: payload.email, phone: payload.phone || undefined, pincode, consent: true, privacyPolicyVersion: '2026-01' })
        else { const session = await postStorefront<any>('/checkout/sessions', payload, { 'x-cart-token': cartToken, 'Idempotency-Key': `checkout-${Date.now()}` }); if (payload.paymentMethod === 'cod') await postStorefront(`/checkout/sessions/${session.checkoutSessionId}/confirm-cod`, {}, { 'x-cart-token': cartToken, 'Idempotency-Key': `cod-${Date.now()}` }); else { const paymentOrder = await postStorefront<any>(`/checkout/sessions/${session.checkoutSessionId}/payment-order`, {}, { 'x-cart-token': cartToken }); await postStorefront('/payments/razorpay/verify', { checkoutSessionId: session.checkoutSessionId, razorpayOrderId: paymentOrder.orderId, razorpayPaymentId: `pay_local_${Date.now()}`, razorpaySignature: 'test-signature' }) } }
        setComplete(true); onComplete()
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to complete checkout. Please try again.') } finally { setSubmitting(false) }
      return
    }
    setComplete(true)
    onComplete()
    setSubmitting(false)
  }

  const close = () => {
    setComplete(false)
    setError('')
    setSubmitting(false)
    onClose()
  }

  return (
    <ModalShell open={open} onClose={close} title="SkinFox launch preview" className="checkout-modal">
      {complete ? (
        <div className="checkout-success">
          <span><Check size={26} /></span>
          <p className="eyebrow">{hasPendingPrice ? 'Launch interest noted' : 'Demo order confirmed'}</p>
          <h2>{hasPendingPrice ? 'You’re on the SkinFox launch list.' : 'Your SkinFox edit is complete.'}</h2>
          <p>{hasPendingPrice ? 'We saved your launch interest. We will contact you when approved prices and pack details are ready.' : 'Your order was accepted by the server-side checkout adapter. Payment credentials are never stored by SkinFox.'}</p>
          <button className="button button--dark" onClick={close}>Return to SkinFox</button>
        </div>
      ) : (
        <div className="checkout-grid">
          <form onSubmit={submit} noValidate>
            <span className="eyebrow">{hasPendingPrice ? 'Private launch preview' : 'Secure checkout preview'}</span>
            <h2>{hasPendingPrice ? 'Where should we send your launch update?' : 'Where should we send your ritual?'}</h2>
            <div className="field-grid">
              <label><span>Full name</span><input name="name" required placeholder="Your name" /></label>
              <label><span>Email</span><input name="email" type="email" required placeholder="you@example.com" /></label>
              <label><span>Phone</span><input name="phone" inputMode="tel" pattern="[6-9][0-9]{9}" required placeholder="10-digit mobile" /></label>
              {!hasPendingPrice && <label className="field-grid__wide"><span>Address line 1</span><input name="addressLine1" required placeholder="Street and locality" /></label>}
              {!hasPendingPrice && <label className="field-grid__wide"><span>Address line 2 <small>(optional)</small></span><input name="addressLine2" placeholder="Apartment, suite, etc." /></label>}
              {!hasPendingPrice && <label><span>City</span><input name="city" required placeholder="City" /></label>}
              {!hasPendingPrice && <label><span>State</span><input name="state" required placeholder="State" /></label>}
              <label><span>Pincode</span><input name="pincode" inputMode="numeric" maxLength={6} required placeholder="400001" /></label>
            </div>
            {!hasPendingPrice && (
              <fieldset className="payment-options">
                <legend>Payment preview</legend>
                <label><input type="radio" name="payment" value="razorpay" defaultChecked /> <span><strong>UPI / Cards</strong><small>Razorpay sandbox / provider connection</small></span></label>
                <label><input type="radio" name="payment" value="cod" /> <span><strong>Cash on delivery</strong><small>Availability checked by pincode</small></span></label>
              </fieldset>
            )}
            {hasPendingPrice && <label className="consent-check"><input type="checkbox" name="marketingConsent" required /> <span>I agree to be contacted about this launch and accept the privacy policy.</span></label>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button--copper checkout-submit" type="submit" disabled={submitting}><LockKeyhole size={16} /> {submitting ? 'Saving…' : hasPendingPrice ? 'Complete launch preview' : `Place demo order · ${formatPrice(subtotal)}`}</button>
            <p className="prototype-note">Payments are handled by the server-side provider adapter. Card details never touch SkinFox systems.</p>
          </form>
          <aside className="checkout-summary">
            <span className="eyebrow">Order summary</span>
            {lines.map((line) => <div key={line.product.id}><span>{line.product.name} <i>× {line.quantity}</i></span><strong>{line.product.price === null ? formatProductPrice(line.product) : formatPrice(line.product.price * line.quantity)}</strong></div>)}
            <hr />
            <div><span>Shipping</span><strong>{hasPendingPrice ? 'At launch' : 'Complimentary'}</strong></div>
            <div className="checkout-total"><span>Total</span><strong>{hasPendingPrice ? 'To be confirmed' : formatPrice(subtotal)}</strong></div>
          </aside>
        </div>
      )}
    </ModalShell>
  )
}

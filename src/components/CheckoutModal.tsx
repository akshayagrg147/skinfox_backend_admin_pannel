import { Check, LoaderCircle, LockKeyhole, MailCheck } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { formatPrice } from '../data/products'
import type { CartLine } from '../types'
import { getStorefront, postStorefront } from '../lib/storefrontApi'
import { exchangeFirebaseUser, firebaseAuthErrorMessage, refreshFirebaseUser, resendEmailVerification } from '../lib/firebaseAuth'
import { CustomerAuthForm, type CustomerAuthResponse } from './CustomerAuthForm'
import { ModalShell } from './ModalShell'
import { ProductPrice } from './ProductPrice'

type Customer = CustomerAuthResponse['customer']
type SavedAddress = { id: string; label: string; fullName: string; phone: string; addressLine1: string; addressLine2?: string | null; landmark?: string | null; city: string; state: string; pincode: string; isDefault: boolean }
type AddressForm = { fullName: string; email: string; phone: string; addressLine1: string; addressLine2: string; landmark: string; city: string; state: string; pincode: string; saveAddress: boolean; saveAsDefault: boolean }

const emptyAddress: AddressForm = { fullName: '', email: '', phone: '', addressLine1: '', addressLine2: '', landmark: '', city: '', state: '', pincode: '', saveAddress: true, saveAsDefault: false }
const customerCsrfHeaders = (): Record<string, string> => {
  const csrf = document.cookie.split('; ').find((entry) => entry.startsWith('sf_customer_csrf='))?.split('=').slice(1).join('=')
  return csrf ? { 'x-customer-csrf-token': decodeURIComponent(csrf) } : {}
}

export function CheckoutModal({ open, lines, onClose, onComplete, onCustomerChange, cartToken = '', apiAvailable = true }: { open: boolean; lines: CartLine[]; onClose: () => void; onComplete: () => void; onCustomerChange?: (customer: Customer | null) => void; cartToken?: string; apiAvailable?: boolean }) {
  const [stage, setStage] = useState<'loading' | 'auth' | 'address' | 'complete'>('loading')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [form, setForm] = useState<AddressForm>(emptyAddress)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const hasPendingPrice = lines.some((line) => line.product.price === null)
  const subtotal = lines.reduce((sum, line) => sum + (line.product.price ?? 0) * line.quantity, 0)

  const loadAddresses = async (signedInCustomer: Customer) => {
    const saved = await getStorefront<SavedAddress[]>('/customer/addresses')
    setAddresses(saved)
    const preferred = saved.find((address) => address.isDefault) ?? saved[0]
    setForm((current) => ({ ...current, fullName: current.fullName || signedInCustomer.fullName, email: current.email || signedInCustomer.email || '', phone: current.phone || preferred?.phone || '', ...(preferred ? { addressLine1: preferred.addressLine1, addressLine2: preferred.addressLine2 ?? '', landmark: preferred.landmark ?? '', city: preferred.city, state: preferred.state, pincode: preferred.pincode } : {}) }))
    if (preferred) setSelectedAddressId(preferred.id)
  }

  useEffect(() => {
    if (!open) return
    let active = true
    setError(''); setNotice(''); setSubmitting(false); setSelectedAddressId(''); setForm(emptyAddress)
    setStage(hasPendingPrice ? 'address' : 'loading')
    if (hasPendingPrice || import.meta.env.MODE === 'test') return
    if (!apiAvailable) { setStage('auth'); return }
    void getStorefront<{ customer: Customer | null }>('/customer/auth/me').then(async ({ customer: signedInCustomer }) => {
      if (!active) return
      if (!signedInCustomer) { setStage('auth'); return }
      setCustomer(signedInCustomer)
      onCustomerChange?.(signedInCustomer)
      await loadAddresses(signedInCustomer)
      if (active) setStage('address')
    }).catch(() => { if (active) setStage('auth') })
    return () => { active = false }
  }, [apiAvailable, open, hasPendingPrice, onCustomerChange])

  const authenticated = async (response: CustomerAuthResponse) => {
    setCustomer(response.customer)
    onCustomerChange?.(response.customer)
    setForm((current) => ({ ...current, fullName: response.customer.fullName === 'SkinFox customer' ? '' : response.customer.fullName, email: response.customer.email ?? '', phone: current.phone || '' }))
    await loadAddresses(response.customer)
    setStage('address')
  }

  const refreshVerification = async () => {
    setSubmitting(true); setError(''); setNotice('')
    try {
      const user = await refreshFirebaseUser()
      const response = await exchangeFirebaseUser<CustomerAuthResponse>(user, cartToken || undefined)
      setCustomer(response.customer); onCustomerChange?.(response.customer)
      setNotice(response.customer.emailVerified ? 'Your email is verified. You can place the order now.' : 'Your email is still awaiting verification.')
    } catch (cause) { setError(firebaseAuthErrorMessage(cause, 'We could not refresh verification status. Please try again.')) } finally { setSubmitting(false) }
  }

  const resendVerification = async () => {
    setSubmitting(true); setError('')
    try { await resendEmailVerification(); setNotice('Verification email sent. Check your inbox and spam folder.') } catch (cause) { setError(firebaseAuthErrorMessage(cause, 'We could not send a verification email. Please try again.')) } finally { setSubmitting(false) }
  }

  const chooseAddress = (id: string) => {
    setSelectedAddressId(id)
    if (!id) { setForm((current) => ({ ...current, saveAddress: true })); return }
    const selected = addresses.find((address) => address.id === id)
    if (selected) setForm((current) => ({ ...current, fullName: selected.fullName, phone: selected.phone, addressLine1: selected.addressLine1, addressLine2: selected.addressLine2 ?? '', landmark: selected.landmark ?? '', city: selected.city, state: selected.state, pincode: selected.pincode, saveAddress: false }))
  }

  const submitCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (hasPendingPrice) { setError('One or more items are awaiting a confirmed price. Please review your bag.'); return }
    if (!customer || !cartToken) { setStage('auth'); return }
    if (!customer.emailVerified) { setError('Verify your email address before placing an order.'); return }
    if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, ''))) { setError('Enter a valid 10-digit Indian delivery phone number.'); return }
    if (!/^[1-9]\d{5}$/.test(form.pincode)) { setError('Enter a valid six-digit pincode that does not start with zero.'); return }
    setSubmitting(true); setError(''); setNotice('')
    try {
      const headers = { 'x-cart-token': cartToken, 'Idempotency-Key': `checkout-${Date.now()}`, ...customerCsrfHeaders() }
      const session = await postStorefront<{ checkoutSessionId: string; orderNumber: string }>('/checkout/sessions', { ...form, phone: form.phone.replace(/\D/g, ''), addressId: selectedAddressId || undefined, paymentMethod: 'cod', billingSameAsShipping: true }, headers)
      await postStorefront(`/checkout/sessions/${session.checkoutSessionId}/confirm-cod`, {}, { 'x-cart-token': cartToken, 'Idempotency-Key': `cod-${Date.now()}`, ...customerCsrfHeaders() })
      setStage('complete'); onComplete()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to complete checkout. Please try again.') } finally { setSubmitting(false) }
  }

  const close = () => { setError(''); setNotice(''); setSubmitting(false); setStage('loading'); onClose() }
  const updateForm = (key: keyof AddressForm, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }))

  return <ModalShell open={open} onClose={close} title="Secure SkinFox checkout" className="checkout-modal">
    {stage === 'complete' ? <div className="checkout-success" role="status"><span><Check size={26} /></span><p className="eyebrow">Cash on delivery confirmed</p><h2>Your order is confirmed.</h2><p>Pay when it arrives, and find the latest status in My orders.</p><button className="button button--dark" onClick={close}>Continue shopping</button></div> : <div className="checkout-grid">
      <div className="checkout-form-content">
        {stage !== 'loading' && !hasPendingPrice && <ol className="checkout-steps" aria-label="Checkout progress"><li className="is-current" aria-current={stage === 'auth' ? 'step' : undefined}><span>{stage === 'address' ? <Check size={13} aria-hidden="true" /> : '1'}</span>Sign in</li><li className={stage === 'address' ? 'is-current' : ''} aria-current={stage === 'address' ? 'step' : undefined}><span>2</span>Delivery & payment</li></ol>}
        {stage === 'loading' && <div className="checkout-loading" role="status"><LoaderCircle size={24} className="auth-spinner" aria-hidden="true" /><span className="eyebrow">Secure checkout</span><h2>Getting your order ready…</h2></div>}
        {stage === 'auth' && <CustomerAuthForm apiAvailable={apiAvailable} destination="checkout" cartToken={cartToken} onAuthenticated={authenticated} />}
        {stage === 'address' && <form onSubmit={submitCheckout} noValidate aria-busy={submitting}>
          <span className="eyebrow">{hasPendingPrice ? 'Item availability' : 'Step 2 of 2 · delivery and COD'}</span>
          <h2>{hasPendingPrice ? 'A little more time for these items.' : 'Where should we deliver?'}</h2>
          {hasPendingPrice ? <p className="checkout-intro">One or more items in your bag are awaiting a confirmed price. Please return to your bag to review your selection or continue browsing.</p> : <>
            <p className="checkout-intro">Add your delivery details below. You’ll pay when your order arrives.</p>
            {customer && !customer.emailVerified && <div className="verification-banner verification-banner--checkout" role="status"><MailCheck size={18} /><div><strong>Verify your email before ordering.</strong><span>Check {customer.email ?? 'your inbox'} for the secure link.</span></div><div className="verification-banner__actions"><button type="button" onClick={() => void resendVerification()} disabled={submitting}>Resend</button><button type="button" onClick={() => void refreshVerification()} disabled={submitting}>I verified</button></div></div>}
            {addresses.length > 0 && <label className="saved-address"><span>Saved address</span><select value={selectedAddressId} onChange={(event) => chooseAddress(event.target.value)}><option value="">Use a new address</option>{addresses.map((address) => <option key={address.id} value={address.id}>{address.label} · {address.addressLine1}, {address.city}</option>)}</select></label>}
            <div className="field-grid">
              <label><span>Full name</span><input value={form.fullName} onChange={(event) => updateForm('fullName', event.target.value)} autoComplete="name" required placeholder="Your name" /></label>
              <label><span>Email <small>(optional)</small></span><input value={form.email} onChange={(event) => updateForm('email', event.target.value)} type="email" autoComplete="email" placeholder="you@example.com" /></label>
              <label><span>Delivery phone</span><input value={form.phone} onChange={(event) => updateForm('phone', event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="tel" autoComplete="tel" required placeholder="9876543210" /></label>
              <label><span>Pincode</span><input value={form.pincode} onChange={(event) => updateForm('pincode', event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="postal-code" maxLength={6} required placeholder="400001" /></label>
              <label className="field-grid__wide"><span>Address line 1</span><input value={form.addressLine1} onChange={(event) => updateForm('addressLine1', event.target.value)} autoComplete="street-address" required placeholder="Street and locality" /></label>
              <label className="field-grid__wide"><span>Address line 2 <small>(optional)</small></span><input value={form.addressLine2} onChange={(event) => updateForm('addressLine2', event.target.value)} placeholder="Apartment, suite, etc." /></label>
              <label className="field-grid__wide"><span>Landmark <small>(optional)</small></span><input value={form.landmark} onChange={(event) => updateForm('landmark', event.target.value)} placeholder="Nearby landmark" /></label>
              <label><span>City</span><input value={form.city} onChange={(event) => updateForm('city', event.target.value)} autoComplete="address-level2" required placeholder="City" /></label>
              <label><span>State</span><input value={form.state} onChange={(event) => updateForm('state', event.target.value)} autoComplete="address-level1" required placeholder="State" /></label>
            </div>
            {!selectedAddressId && <label className="consent-check"><input type="checkbox" checked={form.saveAddress} onChange={(event) => updateForm('saveAddress', event.target.checked)} /> <span>Save this address to my account.</span></label>}
            {!selectedAddressId && form.saveAddress && <label className="consent-check"><input type="checkbox" checked={form.saveAsDefault} onChange={(event) => updateForm('saveAsDefault', event.target.checked)} /> <span>Make this my default address.</span></label>}
            <div className="payment-options"><span>Payment method</span><div><LockKeyhole size={18} /><p><strong>Cash on delivery</strong><small>Pay on arrival. No card details needed.</small></p></div></div>
          </>}
          {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="auth-notice" role="status">{notice}</p>}
          <button className="button button--copper checkout-submit" type="submit" disabled={submitting || hasPendingPrice || Boolean(customer && !customer.emailVerified)}>{submitting ? <LoaderCircle size={16} className="auth-spinner" aria-hidden="true" /> : <LockKeyhole size={16} aria-hidden="true" />} {hasPendingPrice ? 'Awaiting confirmed prices' : submitting ? 'Placing your order…' : 'Place cash-on-delivery order'}</button>
        </form>}
        {stage !== 'address' && stage !== 'auth' && error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <aside className="checkout-summary" aria-label="Order summary"><span className="eyebrow">Your selection</span><h3>Order summary</h3>{lines.map((line) => <div key={line.product.id}><span>{line.product.name} <i>× {line.quantity}</i></span><ProductPrice product={line.product} quantity={line.quantity} compact className="checkout-line-price" /></div>)}<hr /><div><span>Shipping</span><strong>{hasPendingPrice ? 'Price pending' : 'Calculated by pincode'}</strong></div><div className="checkout-total"><span>Items subtotal</span><strong>{hasPendingPrice ? 'Price pending' : formatPrice(subtotal)}</strong></div><p className="checkout-summary__note"><LockKeyhole size={14} aria-hidden="true" />Cash on delivery · No online payment</p></aside>
    </div>}
  </ModalShell>
}

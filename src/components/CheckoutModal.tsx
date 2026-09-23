import { Check, LoaderCircle, LockKeyhole, MailCheck, Truck } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { formatPrice } from '../data/products'
import type { CartLine } from '../types'
import { deleteStorefront, getStorefront, postStorefront } from '../lib/storefrontApi'
import { formatCheckoutPaise } from '../lib/currency'
import { exchangeFirebaseUser, firebaseAuthErrorMessage, refreshFirebaseUser, resendEmailVerification } from '../lib/firebaseAuth'
import { openRazorpayCheckout } from '../lib/razorpay'
import { CustomerAuthForm, type CustomerAuthResponse } from './CustomerAuthForm'
import { ModalShell } from './ModalShell'
import { ProductPrice } from './ProductPrice'

type Customer = CustomerAuthResponse['customer']
type PaymentMethod = 'razorpay'
type SavedAddress = { id: string; label: string; fullName: string; phone: string; addressLine1: string; addressLine2?: string | null; landmark?: string | null; city: string; state: string; pincode: string; isDefault: boolean }
type AddressForm = { fullName: string; email: string; phone: string; addressLine1: string; addressLine2: string; landmark: string; city: string; state: string; pincode: string; saveAddress: boolean; saveAsDefault: boolean }
type AppliedCoupon = { code: string; status?: 'applied' | 'unavailable'; message?: string | null; promotion?: { name?: string; type?: string; value?: number; minSpendPaise?: number } }
type DeliveryEstimate = { estimatedDeliveryFrom?: string | null; estimatedDeliveryTo?: string | null; serviceable?: boolean }
type CheckoutQuote = DeliveryEstimate & { subtotalPaise: number; discountPaise: number; couponDiscountPaise?: number; launchDiscountPaise?: number; productTotalPaise?: number; taxBasePaise?: number; taxPaise: number; shippingPaise: number; codPaise: number; totalPaise: number; serviceability?: boolean; purchaseEligible?: boolean; appliedCoupon?: AppliedCoupon | null; promotion?: { discountPercent?: number; discountPaise?: number } | null }

const emptyAddress: AddressForm = { fullName: '', email: '', phone: '', addressLine1: '', addressLine2: '', landmark: '', city: '', state: '', pincode: '', saveAddress: true, saveAsDefault: false }
const checkoutPayload = (form: AddressForm, selectedAddressId: string, paymentMethod: PaymentMethod) => ({ ...form, phone: form.phone.replace(/\D/g, ''), addressId: selectedAddressId || undefined, paymentMethod, billingSameAsShipping: true })
const customerCsrfHeaders = (): Record<string, string> => {
  const csrf = document.cookie.split('; ').find((entry) => entry.startsWith('sf_customer_csrf='))?.split('=').slice(1).join('=')
  return csrf ? { 'x-customer-csrf-token': decodeURIComponent(csrf) } : {}
}
const formatDeliveryEstimate = (from?: string | null, to?: string | null) => {
  if (!from) return ''
  const format = (value: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
  const start = format(from)
  if (!to || new Date(to).toISOString() === new Date(from).toISOString()) return `By ${start}`
  return `${start} – ${format(to)}`
}

export function CheckoutModal({ open, lines, onClose, onComplete, onCustomerChange, onCartResponse, appliedCoupon = null, cartToken = '', apiAvailable = true, enabledPaymentMethods = ['razorpay'] }: { open: boolean; lines: CartLine[]; onClose: () => void; onComplete: () => void; onCustomerChange?: (customer: Customer | null) => void; onCartResponse?: (response: unknown) => void; appliedCoupon?: AppliedCoupon | null; cartToken?: string; apiAvailable?: boolean; enabledPaymentMethods?: PaymentMethod[] }) {
  const [stage, setStage] = useState<'loading' | 'auth' | 'address' | 'complete'>('loading')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [form, setForm] = useState<AddressForm>(emptyAddress)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const razorpayEnabled = enabledPaymentMethods.includes('razorpay')
  const [paymentMethod] = useState<PaymentMethod>('razorpay')
  const [pincodeLookup, setPincodeLookup] = useState<'idle' | 'loading' | 'found' | 'unavailable' | 'error'>('idle')
  const [pincodeMessage, setPincodeMessage] = useState('')
  const [deliveryEstimate, setDeliveryEstimate] = useState<DeliveryEstimate | null>(null)
  const [quote, setQuote] = useState<CheckoutQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [couponError, setCouponError] = useState('')
  const [couponBusy, setCouponBusy] = useState(false)
  const [couponRevision, setCouponRevision] = useState(0)
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
    setError(''); setNotice(''); setSubmitting(false); setSelectedAddressId(''); setForm(emptyAddress); setPincodeLookup('idle'); setPincodeMessage(''); setDeliveryEstimate(null); setQuote(null); setQuoteLoading(false); setCouponError(''); setCouponBusy(false)
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
  }, [apiAvailable, open, hasPendingPrice, onCustomerChange, razorpayEnabled])

  useEffect(() => { if (open) setCouponCode(appliedCoupon?.code ?? '') }, [appliedCoupon?.code, open])

  useEffect(() => {
    if (!open || stage !== 'address') return
    const pincode = form.pincode
    if (!/^[1-9]\d{5}$/.test(pincode)) {
      setPincodeLookup('idle')
      setPincodeMessage(pincode ? 'Enter all 6 digits to look up your location.' : '')
      setDeliveryEstimate(null)
      return
    }
    let active = true
    const timer = window.setTimeout(() => {
      setPincodeLookup('loading')
      setPincodeMessage('Looking up city and state…')
      void getStorefront<{ city?: string | null; state?: string | null; serviceable?: boolean } & DeliveryEstimate>(`/shipping/pincode/${pincode}`)
        .then((location) => {
          if (!active) return
          const city = location.city ?? ''
          const state = location.state ?? ''
          setForm((current) => ({ ...current, city, state }))
          setDeliveryEstimate(location.serviceable === false ? null : { estimatedDeliveryFrom: location.estimatedDeliveryFrom, estimatedDeliveryTo: location.estimatedDeliveryTo, serviceable: location.serviceable })
          if (city && state) {
            setPincodeLookup('found')
            setPincodeMessage(location.serviceable === false ? 'We do not deliver to this pincode yet.' : 'Location confirmed.')
          } else {
            setPincodeLookup('unavailable')
            setPincodeMessage('We could not identify this pincode. Check the number and try again.')
          }
        })
        .catch(() => {
          if (!active) return
          setPincodeLookup('error')
          setPincodeMessage('Location lookup is temporarily unavailable. Try again shortly.')
          setDeliveryEstimate(null)
        })
    }, 350)
    return () => { active = false; window.clearTimeout(timer) }
  }, [form.pincode, open, stage])

  useEffect(() => {
    const phone = form.phone.replace(/\D/g, '')
    const ready = open && stage === 'address' && !hasPendingPrice && Boolean(customer?.emailVerified) && Boolean(cartToken) && /^[6-9]\d{9}$/.test(phone) && /^[1-9]\d{5}$/.test(form.pincode) && form.fullName.trim().length >= 2 && form.addressLine1.trim().length >= 5 && form.city.trim().length >= 2 && form.state.trim().length >= 2
    if (!ready) {
      setQuote(null)
      setQuoteLoading(false)
      return
    }
    let active = true
    const timer = window.setTimeout(() => {
      setQuoteLoading(true)
      void postStorefront<CheckoutQuote>('/checkout/quote', checkoutPayload(form, selectedAddressId, paymentMethod), { 'x-cart-token': cartToken, ...customerCsrfHeaders() })
        .then((nextQuote) => { if (active) setQuote(nextQuote) })
        .catch(() => { if (active) setQuote(null) })
        .finally(() => { if (active) setQuoteLoading(false) })
    }, 350)
    return () => { active = false; window.clearTimeout(timer) }
  }, [cartToken, couponRevision, customer?.emailVerified, form, hasPendingPrice, open, paymentMethod, selectedAddressId, stage])

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
    if (!razorpayEnabled) { setError('Online payment is temporarily unavailable. Please try again shortly.'); return }
    if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, ''))) { setError('Enter a valid 10-digit Indian delivery phone number.'); return }
    if (!/^[1-9]\d{5}$/.test(form.pincode)) { setError('Enter a valid six-digit pincode that does not start with zero.'); return }
    if (!form.city || !form.state) { setError('Enter a valid pincode so we can confirm the delivery city and state.'); return }
    setSubmitting(true); setError(''); setNotice('')
    try {
      const headers = { 'x-cart-token': cartToken, 'Idempotency-Key': `checkout-${Date.now()}`, ...customerCsrfHeaders() }
      const session = await postStorefront<{ checkoutSessionId: string; orderNumber: string; quote?: CheckoutQuote }>('/checkout/sessions', checkoutPayload(form, selectedAddressId, paymentMethod), headers)
      if (session.quote) setQuote(session.quote)
      const paymentOrder = await postStorefront<{ orderNumber: string; amountPaise: number; currency: string; keyId: string; orderId: string; name: string; description: string; prefill?: { name?: string; email?: string; contact?: string } }>(`/checkout/sessions/${session.checkoutSessionId}/payment-order`, {}, { 'x-cart-token': cartToken, 'Idempotency-Key': `payment-order-${session.checkoutSessionId}`, ...customerCsrfHeaders() })
      const payment = await openRazorpayCheckout({ key: paymentOrder.keyId, amount: paymentOrder.amountPaise, currency: paymentOrder.currency, name: paymentOrder.name, description: paymentOrder.description, order_id: paymentOrder.orderId, prefill: paymentOrder.prefill, notes: { order: paymentOrder.orderNumber }, theme: { color: '#4e275e' } })
      await postStorefront('/payments/razorpay/verify', { razorpayOrderId: payment.razorpay_order_id, razorpayPaymentId: payment.razorpay_payment_id, razorpaySignature: payment.razorpay_signature }, { 'x-cart-token': cartToken, 'Idempotency-Key': `razorpay-verify-${payment.razorpay_payment_id}`, ...customerCsrfHeaders() })
      setStage('complete'); onComplete()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to complete checkout. Please try again.') } finally { setSubmitting(false) }
  }

  const close = () => { setError(''); setNotice(''); setSubmitting(false); setQuote(null); setQuoteLoading(false); setDeliveryEstimate(null); setStage('loading'); onClose() }
  const updateForm = (key: keyof AddressForm, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }))
  const updatePincode = (value: string) => {
    setForm((current) => ({ ...current, pincode: value, ...(current.pincode === value ? {} : { city: '', state: '' }) }))
    setPincodeLookup('idle')
    setPincodeMessage('')
  }
  const applyCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const code = couponCode.trim().toUpperCase()
    if (!code) { setCouponError('Enter a coupon code.'); return }
    if (!apiAvailable || !cartToken) { setCouponError('Coupons are checked through the secure checkout service. Please try again when it is available.'); return }
    setCouponBusy(true); setCouponError(''); setError('')
    try {
      const response = await postStorefront<unknown>(`/carts/${cartToken}/apply-coupon`, { code }, { 'x-cart-token': cartToken })
      onCartResponse?.(response)
      setCouponCode(code)
      setCouponRevision((current) => current + 1)
    } catch (cause) { setCouponError(cause instanceof Error ? cause.message : 'We could not apply that coupon. Please try again.') } finally { setCouponBusy(false) }
  }
  const removeCoupon = async () => {
    if (!apiAvailable || !cartToken) return
    setCouponBusy(true); setCouponError(''); setError('')
    try {
      const response = await deleteStorefront<unknown>(`/carts/${cartToken}/coupon`, { 'x-cart-token': cartToken })
      onCartResponse?.(response)
      setCouponCode('')
      setCouponRevision((current) => current + 1)
    } catch (cause) { setCouponError(cause instanceof Error ? cause.message : 'We could not remove that coupon. Please try again.') } finally { setCouponBusy(false) }
  }

  const productTotalPaise = quote ? Math.max(0, quote.subtotalPaise - quote.discountPaise) : Math.round(subtotal * 100)
  const visibleCoupon = quote?.appliedCoupon ?? appliedCoupon
  const couponDiscountPaise = quote?.couponDiscountPaise ?? 0
  const couponLabel = visibleCoupon?.promotion?.value ? `${visibleCoupon.code} · ${visibleCoupon.promotion.value}% off` : visibleCoupon?.code ?? ''
  const freeShippingUnlocked = Boolean(quote && quote.shippingPaise === 0 && productTotalPaise >= 200000)
  const shippingLabel = hasPendingPrice ? 'Price pending' : quoteLoading ? 'Calculating…' : quote?.serviceability === false ? 'Unavailable' : quote ? (quote.shippingPaise === 0 ? 'Free' : formatCheckoutPaise(quote.shippingPaise)) : 'Enter delivery details'
  const payableLabel = hasPendingPrice ? 'Price pending' : quote ? formatCheckoutPaise(quote.totalPaise) : quoteLoading ? 'Calculating…' : 'Enter delivery details'
  const deliveryEstimateLabel = formatDeliveryEstimate(quote?.estimatedDeliveryFrom ?? deliveryEstimate?.estimatedDeliveryFrom, quote?.estimatedDeliveryTo ?? deliveryEstimate?.estimatedDeliveryTo)

  return <ModalShell open={open} onClose={close} title="Secure SkinFox checkout" className="checkout-modal">
        {stage === 'complete' ? <div className="checkout-success" role="status"><span><Check size={26} /></span><p className="eyebrow">Payment confirmed</p><h2>Your order is confirmed.</h2><p>Your payment was received securely. Find the latest status in My orders.</p><button className="button button--dark" onClick={close}>Continue shopping</button></div> : <div className="checkout-grid">
      <div className="checkout-form-content">
        {stage !== 'loading' && !hasPendingPrice && <ol className="checkout-steps" aria-label="Checkout progress"><li className="is-current" aria-current={stage === 'auth' ? 'step' : undefined}><span>{stage === 'address' ? <Check size={13} aria-hidden="true" /> : '1'}</span>Sign in</li><li className={stage === 'address' ? 'is-current' : ''} aria-current={stage === 'address' ? 'step' : undefined}><span>2</span>Delivery & payment</li></ol>}
        {stage === 'loading' && <div className="checkout-loading" role="status"><LoaderCircle size={24} className="auth-spinner" aria-hidden="true" /><span className="eyebrow">Secure checkout</span><h2>Getting your order ready…</h2></div>}
        {stage === 'auth' && <CustomerAuthForm apiAvailable={apiAvailable} destination="checkout" cartToken={cartToken} onAuthenticated={authenticated} />}
        {stage === 'address' && <form onSubmit={submitCheckout} noValidate aria-busy={submitting}>
          <span className="eyebrow">{hasPendingPrice ? 'Item availability' : 'Step 2 of 2 · delivery and payment'}</span>
          <h2>{hasPendingPrice ? 'A little more time for these items.' : 'Where should we deliver?'}</h2>
          {hasPendingPrice ? <p className="checkout-intro">One or more items in your bag are awaiting a confirmed price. Please return to your bag to review your selection or continue browsing.</p> : <>
            <p className="checkout-intro">Add your delivery details below, then choose a secure payment method.</p>
            {customer && !customer.emailVerified && <div className="verification-banner verification-banner--checkout" role="status"><MailCheck size={18} /><div><strong>Verify your email before ordering.</strong><span>Check {customer.email ?? 'your inbox'} for the secure link.</span></div><div className="verification-banner__actions"><button type="button" onClick={() => void resendVerification()} disabled={submitting}>Resend</button><button type="button" onClick={() => void refreshVerification()} disabled={submitting}>I verified</button></div></div>}
            {addresses.length > 0 && <label className="saved-address"><span>Saved address</span><select value={selectedAddressId} onChange={(event) => chooseAddress(event.target.value)}><option value="">Use a new address</option>{addresses.map((address) => <option key={address.id} value={address.id}>{address.label} · {address.addressLine1}, {address.city}</option>)}</select></label>}
            <div className="field-grid">
              <label><span>Full name</span><input value={form.fullName} onChange={(event) => updateForm('fullName', event.target.value)} autoComplete="name" required placeholder="Your name" /></label>
              <label><span>Email <small>(optional)</small></span><input value={form.email} onChange={(event) => updateForm('email', event.target.value)} type="email" autoComplete="email" placeholder="you@example.com" /></label>
              <label><span>Delivery phone</span><input value={form.phone} onChange={(event) => updateForm('phone', event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="tel" autoComplete="tel" required placeholder="9876543210" /></label>
              <label><span>Pincode</span><input value={form.pincode} onChange={(event) => updatePincode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="postal-code" maxLength={6} required placeholder="400001" aria-describedby="pincode-status" /><small id="pincode-status" className={`pincode-status pincode-status--${pincodeLookup}`} aria-live="polite">{pincodeMessage}</small>{deliveryEstimateLabel && pincodeLookup === 'found' && <small className="delivery-estimate" role="status"><Truck size={13} aria-hidden="true" /> Estimated delivery: {deliveryEstimateLabel}</small>}</label>
              <label className="field-grid__wide"><span>Address line 1</span><input value={form.addressLine1} onChange={(event) => updateForm('addressLine1', event.target.value)} autoComplete="street-address" required placeholder="Street and locality" /></label>
              <label className="field-grid__wide"><span>Address line 2 <small>(optional)</small></span><input value={form.addressLine2} onChange={(event) => updateForm('addressLine2', event.target.value)} placeholder="Apartment, suite, etc." /></label>
              <label className="field-grid__wide"><span>Landmark <small>(optional)</small></span><input value={form.landmark} onChange={(event) => updateForm('landmark', event.target.value)} placeholder="Nearby landmark" /></label>
              <label><span>City <small>(from pincode)</small></span><input value={form.city} readOnly aria-readonly="true" className="field-readonly" autoComplete="address-level2" required placeholder="City will appear automatically" /></label>
              <label><span>State <small>(from pincode)</small></span><input value={form.state} readOnly aria-readonly="true" className="field-readonly" autoComplete="address-level1" required placeholder="State will appear automatically" /></label>
            </div>
            {!selectedAddressId && <label className="consent-check"><input type="checkbox" checked={form.saveAddress} onChange={(event) => updateForm('saveAddress', event.target.checked)} /> <span>Save this address to my account.</span></label>}
            {!selectedAddressId && form.saveAddress && <label className="consent-check"><input type="checkbox" checked={form.saveAsDefault} onChange={(event) => updateForm('saveAsDefault', event.target.checked)} /> <span>Make this my default address.</span></label>}
            <fieldset className="payment-options"><legend>Payment method</legend>{razorpayEnabled ? <label className="is-selected"><input type="radio" name="paymentMethod" value="razorpay" checked readOnly /><LockKeyhole size={18} /><span><strong>Pay securely online with Razorpay</strong><small>Cards, UPI and wallets are handled securely by Razorpay.</small></span></label> : <p className="payment-unavailable" role="status">Online payment is temporarily unavailable. Please try again shortly.</p>}</fieldset>
          </>}
          {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="auth-notice" role="status">{notice}</p>}
          <button className="button button--copper checkout-submit" type="submit" disabled={submitting || hasPendingPrice || !razorpayEnabled || !form.city || !form.state || Boolean(customer && !customer.emailVerified)}>{submitting ? <LoaderCircle size={16} className="auth-spinner" aria-hidden="true" /> : <LockKeyhole size={16} aria-hidden="true" />} {hasPendingPrice ? 'Awaiting confirmed prices' : submitting ? 'Placing your order…' : 'Continue to secure payment'}</button>
        </form>}
        {stage !== 'address' && stage !== 'auth' && error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <aside className="checkout-summary" aria-label="Order summary">
        <span className="eyebrow">Your selection</span>
        <h3>Order summary</h3>
        {lines.map((line) => <div key={line.product.id}><span>{line.product.name} <i>× {line.quantity}</i></span><ProductPrice product={line.product} quantity={line.quantity} compact className="checkout-line-price" /></div>)}
        <hr />
        <form className="checkout-coupon" onSubmit={applyCoupon} noValidate>
          <label htmlFor="checkout-coupon-code">Coupon code</label>
          {visibleCoupon ? <div className="checkout-coupon__applied"><span><strong>{visibleCoupon.code}</strong><small>{visibleCoupon.status === 'applied' ? visibleCoupon.promotion?.name ?? 'Coupon applied to this order' : visibleCoupon.message ?? 'Coupon unavailable'}</small></span><button type="button" onClick={() => void removeCoupon()} disabled={couponBusy}>Remove</button></div> : <div className="checkout-coupon__entry"><input id="checkout-coupon-code" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} maxLength={32} autoCapitalize="characters" placeholder="Enter coupon code" disabled={couponBusy || !apiAvailable} /><button type="submit" disabled={couponBusy || !apiAvailable || !couponCode.trim()}>{couponBusy ? 'Checking…' : 'Apply'}</button></div>}
          {couponError && <small className="checkout-coupon__error" role="alert">{couponError}</small>}
          {!visibleCoupon && !couponError && <small>Coupon savings apply to products only. Delivery is calculated separately.</small>}
        </form>
        <div><span>Products subtotal</span><strong>{hasPendingPrice ? 'Price pending' : quote ? formatCheckoutPaise(quote.subtotalPaise) : formatPrice(subtotal)}</strong></div>
        {quote && couponDiscountPaise > 0 && <div className="checkout-summary__discount"><span>Coupon savings {couponLabel ? `(${couponLabel})` : ''}</span><strong>−{formatCheckoutPaise(couponDiscountPaise)}</strong></div>}
        {quote && couponDiscountPaise === 0 && quote.launchDiscountPaise && quote.launchDiscountPaise > 0 && <div className="checkout-summary__discount"><span>SkinFox offer</span><strong>−{formatCheckoutPaise(quote.launchDiscountPaise)}</strong></div>}
        {quote && <><div><span>Products total (incl. GST)</span><strong>{formatCheckoutPaise(quote.productTotalPaise ?? Math.max(0, quote.subtotalPaise - quote.discountPaise))}</strong></div><div><span>Base price (excl. GST)</span><strong>{formatCheckoutPaise(quote.taxBasePaise ?? Math.max(0, (quote.productTotalPaise ?? quote.subtotalPaise) - quote.taxPaise))}</strong></div><div><span>GST included (18%)</span><strong>{formatCheckoutPaise(quote.taxPaise)}</strong></div></>}
        <div><span>Shipping</span><strong>{shippingLabel}</strong></div>
        {deliveryEstimateLabel && <div className="checkout-summary__delivery"><span><Truck size={15} aria-hidden="true" /> Estimated delivery</span><strong>{deliveryEstimateLabel}</strong></div>}
        {freeShippingUnlocked && <p className="checkout-summary__shipping-note">Free delivery unlocked on orders of ₹2,000 or more.</p>}
        <div className="checkout-total"><span>Amount due</span><strong>{payableLabel}</strong></div>
        <p className="checkout-summary__note"><LockKeyhole size={14} aria-hidden="true" />GST is already included in product prices and is not added again. Secure online payment by Razorpay.</p>
      </aside>
    </div>}
  </ModalShell>
}

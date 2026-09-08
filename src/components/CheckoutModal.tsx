import { Check, LockKeyhole, Smartphone } from 'lucide-react'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { formatPrice } from '../data/products'
import type { CartLine } from '../types'
import { getStorefront, postStorefront } from '../lib/storefrontApi'
import { ModalShell } from './ModalShell'
import { ProductPrice } from './ProductPrice'
import { exchangeFirebaseUser, firebaseAuthConfigured, signInWithGoogle, startFirebasePhoneSignIn } from '../lib/firebaseAuth'

type Customer = { id: string; fullName: string; email?: string | null; phone?: string | null; phoneVerified?: boolean; emailVerified?: boolean }
type SavedAddress = { id: string; label: string; fullName: string; addressLine1: string; addressLine2?: string | null; landmark?: string | null; city: string; state: string; pincode: string; isDefault: boolean }
type AddressForm = { fullName: string; email: string; addressLine1: string; addressLine2: string; landmark: string; city: string; state: string; pincode: string; saveAddress: boolean; saveAsDefault: boolean }

const emptyAddress: AddressForm = { fullName: '', email: '', addressLine1: '', addressLine2: '', landmark: '', city: '', state: '', pincode: '', saveAddress: true, saveAsDefault: false }
const customerCsrfHeaders = (): Record<string, string> => {
  const csrf = document.cookie.split('; ').find((entry) => entry.startsWith('sf_customer_csrf='))?.split('=').slice(1).join('=')
  return csrf ? { 'x-customer-csrf-token': decodeURIComponent(csrf) } : {}
}

export function CheckoutModal({ open, lines, onClose, onComplete, onCustomerChange, cartToken = '' }: { open: boolean; lines: CartLine[]; onClose: () => void; onComplete: () => void; onCustomerChange?: (customer: Customer | null) => void; cartToken?: string }) {
  const [stage, setStage] = useState<'loading' | 'phone' | 'otp' | 'address' | 'complete'>('loading')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [testOtpCode, setTestOtpCode] = useState('')
  const [form, setForm] = useState<AddressForm>(emptyAddress)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const confirmationRef = useRef<Awaited<ReturnType<typeof startFirebasePhoneSignIn>> | null>(null)
  const [linkingPhone, setLinkingPhone] = useState(false)
  const hasPendingPrice = lines.some((line) => line.product.price === null)
  const subtotal = lines.reduce((sum, line) => sum + (line.product.price ?? 0) * line.quantity, 0)

  const loadAddresses = async (signedInCustomer: Customer) => {
    const saved = await getStorefront<SavedAddress[]>('/customer/addresses')
    setAddresses(saved)
    const preferred = saved.find((address) => address.isDefault) ?? saved[0]
    setForm((current) => ({ ...current, fullName: current.fullName || signedInCustomer.fullName, email: current.email || signedInCustomer.email || '', ...(preferred ? { addressLine1: preferred.addressLine1, addressLine2: preferred.addressLine2 ?? '', landmark: preferred.landmark ?? '', city: preferred.city, state: preferred.state, pincode: preferred.pincode } : {}) }))
    if (preferred) setSelectedAddressId(preferred.id)
  }

  useEffect(() => {
    if (!open) return
    let active = true
    setError('')
    setSubmitting(false)
    setStage(hasPendingPrice ? 'address' : 'loading')
    if (hasPendingPrice || import.meta.env.MODE === 'test') return
    void getStorefront<{ customer: Customer | null }>('/customer/auth/me').then(async ({ customer: signedInCustomer }) => {
      if (!active) return
      if (!signedInCustomer) { setStage('phone'); return }
      setCustomer(signedInCustomer)
      await loadAddresses(signedInCustomer)
      if (active) setStage('address')
    }).catch(() => { if (active) setStage('phone') })
    return () => { active = false }
  }, [open, hasPendingPrice])

  const requestOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      if (firebaseAuthConfigured) {
        confirmationRef.current = await startFirebasePhoneSignIn('+91' + phone.replace(/\D/g, ''), 'checkout-recaptcha')
        setOtp('')
        setTestOtpCode('')
        setStage('otp')
        return
      }
      const response = await postStorefront<{ challengeId: string; phone: string; testOtpCode?: string }>('/customer/auth/request-otp', { phone })
      setPhone(response.phone)
      setChallengeId(response.challengeId)
      setTestOtpCode(response.testOtpCode ?? '')
      setOtp('')
      setStage('otp')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send an OTP. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const verifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      if (firebaseAuthConfigured && confirmationRef.current) {
        const credential = await confirmationRef.current.confirm(otp)
        const response = await exchangeFirebaseUser<{ customer: Customer }>(credential.user, cartToken || undefined, linkingPhone)
        confirmationRef.current = null
        setLinkingPhone(false)
        setCustomer(response.customer)
        onCustomerChange?.(response.customer)
        setForm((current) => ({ ...current, fullName: response.customer.fullName === 'SkinFox customer' ? '' : response.customer.fullName, email: response.customer.email ?? '' }))
        await loadAddresses(response.customer)
        setStage('address')
        return
      }
      const response = await postStorefront<{ customer: Customer }>('/customer/auth/verify-otp', { challengeId, phone, code: otp, ...(cartToken ? { cartToken } : {}) })
      setCustomer(response.customer)
      onCustomerChange?.(response.customer)
      setForm((current) => ({ ...current, fullName: response.customer.fullName === 'SkinFox customer' ? '' : response.customer.fullName, email: response.customer.email ?? '' }))
      await loadAddresses(response.customer)
      setStage('address')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to verify that OTP. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const googleSignIn = async () => {
    setSubmitting(true)
    setError('')
    try {
      if (!firebaseAuthConfigured) throw new Error('Google sign-in is not configured for this storefront yet.')
      const credential = await signInWithGoogle({ destination: 'checkout', cartToken: cartToken || undefined })
      if (!credential) return
      const response = await exchangeFirebaseUser<{ customer: Customer }>(credential.user, cartToken || undefined)
      setCustomer(response.customer)
      onCustomerChange?.(response.customer)
      if (!response.customer.phoneVerified) {
        setPhone('')
        setLinkingPhone(true)
        setError('Google is connected. Verify your mobile number before checkout.')
        setStage('phone')
        return
      }
      setForm((current) => ({ ...current, fullName: response.customer.fullName === 'SkinFox customer' ? '' : response.customer.fullName, email: response.customer.email ?? '' }))
      await loadAddresses(response.customer)
      setStage('address')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in with Google. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const chooseAddress = (id: string) => {
    setSelectedAddressId(id)
    if (!id) { setForm((current) => ({ ...current, saveAddress: true })); return }
    const selected = addresses.find((address) => address.id === id)
    if (selected) setForm((current) => ({ ...current, fullName: selected.fullName, addressLine1: selected.addressLine1, addressLine2: selected.addressLine2 ?? '', landmark: selected.landmark ?? '', city: selected.city, state: selected.state, pincode: selected.pincode, saveAddress: false }))
  }

  const submitCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (hasPendingPrice) {
      setError('This selection is not purchasable until a selling price is published in the admin panel.')
      return
    }
    if (!customer || !cartToken) { setStage('phone'); return }
    if (!/^[1-9]\d{5}$/.test(form.pincode)) { setError('Enter a valid six-digit pincode that does not start with zero.'); return }
    setSubmitting(true)
    setError('')
    try {
      const headers = { 'x-cart-token': cartToken, 'Idempotency-Key': `checkout-${Date.now()}`, ...customerCsrfHeaders() }
      const session = await postStorefront<{ checkoutSessionId: string; orderNumber: string }>('/checkout/sessions', { ...form, addressId: selectedAddressId || undefined, paymentMethod: 'cod', billingSameAsShipping: true }, headers)
      await postStorefront(`/checkout/sessions/${session.checkoutSessionId}/confirm-cod`, {}, { 'x-cart-token': cartToken, 'Idempotency-Key': `cod-${Date.now()}`, ...customerCsrfHeaders() })
      setStage('complete')
      onComplete()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to complete checkout. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const close = () => {
    setError('')
    setSubmitting(false)
    setStage('loading')
    onClose()
  }

  const updateForm = (key: keyof AddressForm, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <ModalShell open={open} onClose={close} title="Secure SkinFox checkout" className="checkout-modal">
      {stage === 'complete' ? (
        <div className="checkout-success">
          <span><Check size={26} /></span>
          <p className="eyebrow">Cash on delivery confirmed</p>
          <h2>Your SkinFox edit is confirmed.</h2>
          <p>Your order has been created. You will pay only when the order is delivered.</p>
          <button className="button button--dark" onClick={close}>Return to SkinFox</button>
        </div>
      ) : (
        <div className="checkout-grid">
          <form onSubmit={stage === 'phone' ? requestOtp : stage === 'otp' ? verifyOtp : submitCheckout} noValidate>
            {stage === 'loading' && <div className="checkout-loading"><span className="eyebrow">Secure checkout</span><h2>Checking your secure session…</h2></div>}
            {stage === 'phone' && <>
              <span className="eyebrow">Step 1 of 3 · mobile verification</span>
              <h2>Sign in to continue.</h2>
              <p className="checkout-intro">Your bag stays as it is. Verify your mobile number before entering a delivery address or placing a COD order.</p>
              <div className="field-grid"><label className="field-grid__wide"><span>Mobile number</span><input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" required placeholder="10-digit mobile number" /></label></div>
              <button className="button button--copper checkout-submit" type="submit" disabled={submitting || phone.replace(/\D/g, '').length !== 10}><Smartphone size={16} /> {submitting ? 'Sending OTP…' : linkingPhone ? 'Verify mobile number' : 'Send SMS OTP'}</button>
              {firebaseAuthConfigured ? <><div id="checkout-recaptcha" /><button className="button button--dark checkout-submit" type="button" disabled={submitting} onClick={() => void googleSignIn()}>Continue with Google</button></> : <p className="prototype-note">Local test mode uses the configured static OTP.</p>}
            </>}
            {stage === 'otp' && <>
              <span className="eyebrow">Step 2 of 3 · verify mobile</span>
              <h2>Enter your OTP.</h2>
              <p className="checkout-intro">We sent a six-digit SMS-style OTP to +91 {phone}.</p>
              {testOtpCode && <p className="test-otp" role="status">Testing only: use OTP <strong>{testOtpCode}</strong></p>}
              <div className="field-grid"><label className="field-grid__wide"><span>Six-digit OTP</span><input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required placeholder="123456" /></label></div>
              <button className="button button--copper checkout-submit" type="submit" disabled={submitting || otp.length !== 6}><LockKeyhole size={16} /> {submitting ? 'Verifying…' : 'Verify and continue'}</button>
              <button className="checkout-link" type="button" onClick={() => setStage('phone')} disabled={submitting}>Use another number</button>
            </>}
            {stage === 'address' && <>
              <span className="eyebrow">Step 3 of 3 · delivery and COD</span>
              <h2>{hasPendingPrice ? 'This edit is not ready to purchase.' : 'Where should we send your ritual?'}</h2>
              {hasPendingPrice ? <p className="checkout-intro">Selling prices are still pending for one or more products. Publish a price and mark the product available in Admin before testing checkout.</p> : <>
                {addresses.length > 0 && <label className="saved-address"><span>Saved address</span><select value={selectedAddressId} onChange={(event) => chooseAddress(event.target.value)}><option value="">Use a new address</option>{addresses.map((address) => <option key={address.id} value={address.id}>{address.label} · {address.addressLine1}, {address.city}</option>)}</select></label>}
                <div className="field-grid">
                  <label><span>Full name</span><input value={form.fullName} onChange={(event) => updateForm('fullName', event.target.value)} required placeholder="Your name" /></label>
                  <label><span>Email <small>(optional)</small></span><input value={form.email} onChange={(event) => updateForm('email', event.target.value)} type="email" autoComplete="email" placeholder="you@example.com" /></label>
                  <label className="field-grid__wide"><span>Address line 1</span><input value={form.addressLine1} onChange={(event) => updateForm('addressLine1', event.target.value)} required placeholder="Street and locality" /></label>
                  <label className="field-grid__wide"><span>Address line 2 <small>(optional)</small></span><input value={form.addressLine2} onChange={(event) => updateForm('addressLine2', event.target.value)} placeholder="Apartment, suite, etc." /></label>
                  <label className="field-grid__wide"><span>Landmark <small>(optional)</small></span><input value={form.landmark} onChange={(event) => updateForm('landmark', event.target.value)} placeholder="Nearby landmark" /></label>
                  <label><span>City</span><input value={form.city} onChange={(event) => updateForm('city', event.target.value)} required placeholder="City" /></label>
                  <label><span>State</span><input value={form.state} onChange={(event) => updateForm('state', event.target.value)} required placeholder="State" /></label>
                  <label><span>Pincode</span><input value={form.pincode} onChange={(event) => updateForm('pincode', event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} required placeholder="400001" /></label>
                </div>
                {!selectedAddressId && <label className="consent-check"><input type="checkbox" checked={form.saveAddress} onChange={(event) => updateForm('saveAddress', event.target.checked)} /> <span>Save this address to my account.</span></label>}
                {!selectedAddressId && form.saveAddress && <label className="consent-check"><input type="checkbox" checked={form.saveAsDefault} onChange={(event) => updateForm('saveAsDefault', event.target.checked)} /> <span>Make this my default address.</span></label>}
                <div className="payment-options"><span>Payment method</span><div><LockKeyhole size={16} /><p><strong>Cash on delivery</strong><small>COD is the only payment method enabled for this test.</small></p></div></div>
              </>}
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="button button--copper checkout-submit" type="submit" disabled={submitting || hasPendingPrice}><LockKeyhole size={16} /> {submitting ? 'Placing COD order…' : `Place COD order · ${formatPrice(subtotal)}`}</button>
            </>}
            {stage !== 'address' && error && <p className="form-error" role="alert">{error}</p>}
          </form>
          <aside className="checkout-summary">
            <span className="eyebrow">Order summary</span>
            {lines.map((line) => <div key={line.product.id}><span>{line.product.name} <i>× {line.quantity}</i></span><ProductPrice product={line.product} quantity={line.quantity} compact className="checkout-line-price" /></div>)}
            <hr />
            <div><span>Shipping</span><strong>{hasPendingPrice ? 'At launch' : 'Calculated by pincode'}</strong></div>
            <div className="checkout-total"><span>Total</span><strong>{hasPendingPrice ? 'Price pending' : formatPrice(subtotal)}</strong></div>
          </aside>
        </div>
      )}
    </ModalShell>
  )
}

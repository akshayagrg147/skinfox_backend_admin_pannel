import { Check, Clock3, LoaderCircle, LockKeyhole, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import type { WaitlistConfig } from '../hooks/useStorefront'
import { getStorefront, postStorefront } from '../lib/storefrontApi'
import { openRazorpayCheckout } from '../lib/razorpay'
import type { CartLine } from '../types'
import { CustomerAuthForm, type CustomerAuthCustomer, type CustomerAuthResponse } from './CustomerAuthForm'
import { ModalShell } from './ModalShell'
import './waitlist.css'

type WaitlistReservation = {
  publicToken: string
  status: string
  depositPaise: number
  discountPercent: number
  items: Array<{ productId: string; productName: string; size: string; quantity: number }>
}

type WaitlistCheckout = {
  keyId: string
  orderId: string
  amountPaise: number
  currency: string
  name: string
  description: string
  prefill?: { name?: string; email?: string; contact?: string }
}

const csrfHeaders = (): Record<string, string> => {
  const csrf = document.cookie.split('; ').find((entry) => entry.startsWith('sf_customer_csrf='))?.split('=').slice(1).join('=')
  return csrf ? { 'x-customer-csrf-token': decodeURIComponent(csrf) } : {}
}

const money = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

export function WaitlistModal({ open, lines, config, apiAvailable, onClose, onComplete, onCustomerChange }: {
  open: boolean
  lines: CartLine[]
  config: WaitlistConfig
  apiAvailable: boolean
  onClose: () => void
  onComplete: () => void
  onCustomerChange?: (customer: CustomerAuthCustomer | null) => void
}) {
  const [stage, setStage] = useState<'loading' | 'auth' | 'details' | 'success'>('loading')
  const [customer, setCustomer] = useState<CustomerAuthCustomer | null>(null)
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reservation, setReservation] = useState<WaitlistReservation | null>(null)

  const applyCustomer = useCallback((next: CustomerAuthCustomer) => {
    setCustomer(next)
    setPhone(next.phone ?? '')
    onCustomerChange?.(next)
    setStage('details')
  }, [onCustomerChange])

  useEffect(() => {
    if (!open) return
    let active = true
    setError(''); setBusy(false); setConsent(false); setReservation(null); setStage('loading')
    if (!apiAvailable) { setError('We cannot connect to secure payments right now. Please try again shortly.'); setStage('auth'); return }
    void getStorefront<{ customer: CustomerAuthCustomer | null }>('/customer/auth/me').then(({ customer: signedIn }) => {
      if (!active) return
      if (!signedIn) { setStage('auth'); return }
      applyCustomer(signedIn)
    }).catch((cause: unknown) => { if (active) { setError(cause instanceof Error ? cause.message : 'We could not check your account.'); setStage('auth') } })
    return () => { active = false }
  }, [apiAvailable, applyCustomer, open])

  const authenticated = async (response: CustomerAuthResponse) => applyCustomer(response.customer)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedPhone = phone.replace(/\D/g, '')
    if (!customer) { setStage('auth'); return }
    if (!customer.emailVerified) { setError('Verify your email address before making a refundable waitlist payment.'); return }
    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) { setError('Enter a valid 10-digit Indian mobile number.'); return }
    if (!consent) { setError('Please accept the refundable waitlist terms to continue.'); return }
    if (!config.paymentConfigured) { setError('Razorpay is being configured. No payment can be taken yet.'); return }
    setBusy(true); setError('')
    try {
      const idempotencyKey = crypto.randomUUID()
      const created = await postStorefront<{ reservation: WaitlistReservation; checkout: WaitlistCheckout }>('/waitlist/reservations', {
        items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        phone: normalizedPhone,
        consent: true,
        termsVersion: config.termsVersion,
      }, { ...csrfHeaders(), 'Idempotency-Key': idempotencyKey })
      const payment = await openRazorpayCheckout({
        key: created.checkout.keyId,
        amount: created.checkout.amountPaise,
        currency: created.checkout.currency,
        name: created.checkout.name,
        description: created.checkout.description,
        image: `${window.location.origin}/brand/skinfox-logo.png`,
        order_id: created.checkout.orderId,
        prefill: created.checkout.prefill,
        notes: { reservation: created.reservation.publicToken },
        theme: { color: '#7d3f8c' },
      })
      const verified = await postStorefront<{ reservation: WaitlistReservation; confirmed: boolean }>(`/waitlist/reservations/${created.reservation.publicToken}/verify`, {
        razorpayOrderId: payment.razorpay_order_id,
        razorpayPaymentId: payment.razorpay_payment_id,
        razorpaySignature: payment.razorpay_signature,
      }, csrfHeaders())
      setReservation(verified.reservation)
      setStage('success')
      if (verified.confirmed) onComplete()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'We could not complete the waitlist payment. Please try again.') } finally { setBusy(false) }
  }

  const close = () => { if (!busy) onClose() }
  return <ModalShell open={open} onClose={close} title="SkinFox priority waitlist" className="waitlist-modal">
    {stage === 'loading' && <div className="waitlist-loading" role="status"><LoaderCircle className="auth-spinner" size={24} /><h2>Preparing your priority access…</h2></div>}
    {stage === 'auth' && <div className="waitlist-auth">{error && <p className="form-error" role="alert">{error}</p>}<CustomerAuthForm apiAvailable={apiAvailable} destination="waitlist" onAuthenticated={authenticated} /></div>}
    {stage === 'details' && <div className="waitlist-layout">
      <form className="waitlist-form" onSubmit={submit} noValidate>
        <span className="eyebrow"><Sparkles size={14} /> Founding launch access</span>
        <h2>Save your place.<br /><em>See the price later.</em></h2>
        <p className="waitlist-lead">Join before prices are revealed to receive the launch-member discount. Your {money(config.depositPaise)} deposit is fully refundable if you change your mind.</p>
        <div className="waitlist-benefits"><p><ShieldCheck size={18} /><span><strong>Fully refundable</strong><small>Cancel from your account before conversion and the full deposit returns to the original payment method.</small></span></p><p><Sparkles size={18} /><span><strong>{config.discountPercent}% launch discount</strong><small>Your member discount is reserved for the products selected today.</small></span></p><p><Clock3 size={18} /><span><strong>No hidden commitment</strong><small>Review the final product prices before deciding whether to continue.</small></span></p></div>
        <label className="account-field"><span>Mobile number</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" autoComplete="tel" maxLength={10} required placeholder="9876543210" /><small>Used only for important launch and refund updates.</small></label>
        <label className="consent-check waitlist-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I agree to the <a href="/terms-and-conditions#priority-waitlist" target="_blank" rel="noreferrer">Priority Waitlist Terms</a> and understand that the final product price will be revealed later.</span></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {!config.paymentConfigured && <p className="waitlist-config-note" role="status">Secure payment setup is not active yet. Add the Razorpay keys on the server to start accepting deposits.</p>}
        <button className="button button--copper waitlist-pay" type="submit" disabled={busy || !config.paymentConfigured || lines.length === 0}>{busy ? <><LoaderCircle className="auth-spinner" size={17} /> Opening secure payment…</> : <><LockKeyhole size={17} /> Pay refundable {money(config.depositPaise)}</>}</button>
        <p className="waitlist-secure"><LockKeyhole size={13} /> Payment is handled by Razorpay. SkinFox never receives or stores your card or UPI credentials.</p>
      </form>
      <aside className="waitlist-summary"><span className="eyebrow">Your priority list</span><h3>{lines.length} selected {lines.length === 1 ? 'product' : 'products'}</h3>{lines.map((line) => <div key={line.product.id}><img src={line.product.image} alt="" /><span><strong>{line.product.name}</strong><small>{line.product.size} · Quantity {line.quantity}</small></span></div>)}<hr /><p><span>Product prices</span><strong>Revealed later</strong></p><p><span>Refundable deposit</span><strong>{money(config.depositPaise)}</strong></p></aside>
    </div>}
    {stage === 'success' && reservation && <div className="waitlist-success" role="status"><span className="waitlist-success__icon">{reservation.status === 'joined' ? <Check size={28} /> : <Clock3 size={28} />}</span><span className="eyebrow">{reservation.status === 'joined' ? 'Priority access reserved' : 'Payment confirmation pending'}</span><h2>{reservation.status === 'joined' ? 'You’re on the SkinFox waitlist.' : 'We’re confirming your payment.'}</h2><p>{reservation.status === 'joined' ? `Your ${reservation.discountPercent}% launch discount is reserved. We’ll reveal prices before asking you to complete any purchase.` : 'Please do not pay again. Razorpay will notify us automatically, and your account will show the updated status.'}</p><div><strong>{money(reservation.depositPaise)} refundable deposit</strong><small>Reference: {reservation.publicToken.slice(0, 10).toUpperCase()}</small></div><p className="waitlist-success__refund"><RotateCcw size={15} /> Changed your mind? Open My account → Priority waitlist to cancel and request the full refund.</p><button className="button button--dark" onClick={close}>Continue browsing</button></div>}
  </ModalShell>
}

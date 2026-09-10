import { Check, Clock3, LoaderCircle, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'
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
  waitlistId: string
  status: string
  depositPaise: number
  discountPercent: number
  founderNumber?: number | null
  founderCapacity?: number
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
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0)
  const totalDepositPaise = config.depositPaise * totalQuantity
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

  useEffect(() => {
    if (!open || stage !== 'success' || !reservation || reservation.status === 'joined') return
    let active = true
    const refreshStatus = () => {
      void getStorefront<WaitlistReservation[]>('/customer/waitlist').then((reservations) => {
        if (!active) return
        const refreshed = reservations.find((entry) => entry.publicToken === reservation.publicToken)
        if (!refreshed) return
        setReservation(refreshed)
        if (refreshed.status === 'joined') onComplete()
      }).catch(() => {
        // The webhook remains the source of truth. Keep the calm pending state
        // visible if the status check is temporarily unavailable.
      })
    }
    refreshStatus()
    const interval = window.setInterval(refreshStatus, 5000)
    return () => { active = false; window.clearInterval(interval) }
  }, [onComplete, open, reservation, stage])

  const authenticated = async (response: CustomerAuthResponse) => applyCustomer(response.customer)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedPhone = phone.replace(/\D/g, '')
    if (!customer) { setStage('auth'); return }
    if (!customer.emailVerified) { setError('Verify your email address before making a waitlist reservation payment.'); return }
    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) { setError('Enter a valid 10-digit Indian mobile number.'); return }
    if (!consent) { setError('Please accept the waitlist reservation terms to continue.'); return }
    if (!config.paymentConfigured) { setError('Razorpay is being configured. No payment can be taken yet.'); return }
    let createdReservation: WaitlistReservation | null = null
    let paymentAccepted = false
    setBusy(true); setError(''); setReservation(null)
    try {
      const idempotencyKey = crypto.randomUUID()
      const created = await postStorefront<{ reservation: WaitlistReservation; checkout: WaitlistCheckout }>('/waitlist/reservations', {
        items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        phone: normalizedPhone,
        consent: true,
        termsVersion: config.termsVersion,
      }, { ...csrfHeaders(), 'Idempotency-Key': idempotencyKey })
      createdReservation = created.reservation
      setReservation(createdReservation)
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
      paymentAccepted = true
      const verified = await postStorefront<{ reservation: WaitlistReservation; confirmed: boolean }>(`/waitlist/reservations/${created.reservation.publicToken}/verify`, {
        razorpayOrderId: payment.razorpay_order_id,
        razorpayPaymentId: payment.razorpay_payment_id,
        razorpaySignature: payment.razorpay_signature,
      }, csrfHeaders())
      setReservation(verified.reservation)
      setStage('success')
      if (verified.confirmed) onComplete()
    } catch (cause) {
      if (paymentAccepted && createdReservation) {
        // Razorpay has accepted the payment. Never encourage a second payment
        // simply because our confirmation request is delayed or unavailable.
        setReservation(createdReservation)
        setStage('success')
        return
      }
      setError(cause instanceof Error ? cause.message : 'We could not complete the waitlist payment. Please try again.')
    } finally { setBusy(false) }
  }

  const close = () => { if (!busy) onClose() }
  return <ModalShell open={open} onClose={close} title="SkinFox priority waitlist" className="waitlist-modal">
    {stage === 'loading' && <div className="waitlist-loading" role="status"><LoaderCircle className="auth-spinner" size={24} /><h2>Preparing your priority access…</h2></div>}
    {stage === 'auth' && <div className="waitlist-auth">{error && <p className="form-error" role="alert">{error}</p>}<CustomerAuthForm apiAvailable={apiAvailable} destination="waitlist" onAuthenticated={authenticated} /></div>}
    {stage === 'details' && <div className="waitlist-layout">
      <form className="waitlist-form" onSubmit={submit} noValidate>
        <span className="eyebrow"><Sparkles size={14} /> Founding 200 access</span>
        <h2>Reserve your place.<br /><em>Meet the price later.</em></h2>
        <p className="waitlist-lead">Join the waitlist and unlock an exclusive launch price before everyone else. The one-time reservation fee is {money(config.depositPaise)} per product unit, making your current total {money(totalDepositPaise)}.</p>
        <div className="waitlist-benefits"><p><ShieldCheck size={18} /><span><strong>Priority reservation</strong><small>Your place is securely recorded against your SkinFox account and waitlist ID.</small></span></p><p><Sparkles size={18} /><span><strong>Exclusive member pricing</strong><small>Reserved for the first {config.founderCapacity} members of the SkinFox launch.</small></span></p><p><Clock3 size={18} /><span><strong>Early launch access</strong><small>See the member launch price before it becomes available publicly.</small></span></p></div>
        <label className="account-field"><span>Mobile number</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" autoComplete="tel" maxLength={10} required placeholder="9876543210" /><small>Used only for important launch and reservation updates.</small></label>
        <label className="consent-check waitlist-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I agree to the <a href="/terms-and-conditions#priority-waitlist" target="_blank" rel="noreferrer">Priority Waitlist Terms</a>, understand that the final product price will be revealed later, and accept that the reservation fee is non-refundable except where required by law.</span></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {reservation && stage === 'details' && <p className="waitlist-reference-note"><span>Waitlist ID</span><strong>{reservation.waitlistId}</strong><small>Share this ID with SkinFox support if you need help with this payment attempt.</small></p>}
        {config.foundingClosed ? <p className="waitlist-config-note" role="status">Founding {config.founderCapacity} is now closed. Launch Price {money(config.launchPricePaise)} is the next available tier.</p> : !config.paymentConfigured && <p className="waitlist-config-note" role="status">Secure payment setup is not active yet. Add the Razorpay keys on the server to start accepting deposits.</p>}
        <button className="button button--copper waitlist-pay" type="submit" disabled={busy || config.foundingClosed || config.stage !== 'waitlist' || !config.paymentConfigured || lines.length === 0}>{busy ? <><LoaderCircle className="auth-spinner" size={17} /> Opening secure payment…</> : <><LockKeyhole size={17} /> Pay {money(totalDepositPaise)} & join</>}</button>
        <p className="waitlist-secure"><LockKeyhole size={13} /> Payment is handled by Razorpay. SkinFox never receives or stores your card or UPI credentials.</p>
      </form>
      <aside className="waitlist-summary"><span className="eyebrow">Your priority list</span><h3>{totalQuantity} selected {totalQuantity === 1 ? 'item' : 'items'}</h3>{lines.map((line) => <div key={line.product.id}><img src={line.product.image} alt="" /><span><strong>{line.product.name}</strong><small>{line.product.size} · Quantity {line.quantity}</small></span></div>)}<hr /><p><span>Product prices</span><strong>Revealed later</strong></p><p><span>Reservation fee</span><strong>{money(config.depositPaise)} × {totalQuantity} product {totalQuantity === 1 ? 'unit' : 'units'}</strong></p><p><span>Total due now</span><strong>{money(totalDepositPaise)}</strong></p></aside>
    </div>}
    {stage === 'success' && reservation && <div className={`waitlist-success ${reservation.status === 'joined' ? 'is-confirmed' : 'is-pending'}`} role="status">
      <div className="waitlist-success__topline">
        <span className="waitlist-success__icon" aria-hidden="true">{reservation.status === 'joined' ? <Check size={26} strokeWidth={2.5} /> : <Clock3 size={25} />}</span>
        <span className="waitlist-success__eyebrow">{reservation.status === 'joined' ? 'Founding access reserved' : 'Payment confirmation pending'}</span>
      </div>
      <h2>{reservation.status === 'joined' ? 'You’re officially part of the Founding 200.' : 'We’re confirming your payment.'}</h2>
      <p className="waitlist-success__lead">{reservation.status === 'joined' ? 'Your exclusive SkinFox launch price will be revealed soon.' : 'Please do not pay again. Razorpay will notify us automatically, and your account will show the updated status.'}</p>
      <div className="waitlist-success__details">
        {reservation.status === 'joined' && reservation.founderNumber && <div className="waitlist-success__spot">
          <span className="waitlist-success__card-label"><Sparkles size={14} /> Founder member</span>
          <strong>You’re #{reservation.founderNumber} of {reservation.founderCapacity ?? config.founderCapacity}</strong>
          <span>Your place is linked securely to your SkinFox account.</span>
        </div>}
        <div className="waitlist-success__reference">
          <span className="waitlist-success__card-label">Your waitlist ID</span>
          <code>{reservation.waitlistId}</code>
          <strong>{money(reservation.depositPaise)} reservation fee paid</strong>
          <span>Keep this ID for reservation and support questions.</span>
        </div>
      </div>
      <p className="waitlist-success__reassurance"><LockKeyhole size={14} /><span>Saved to your SkinFox account. We’ll keep you updated when launch pricing is revealed.</span></p>
      <button className="button button--dark waitlist-success__action" onClick={close}>Continue browsing</button>
    </div>}
  </ModalShell>
}

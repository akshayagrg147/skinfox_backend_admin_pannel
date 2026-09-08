import { ClipboardList, Home, LoaderCircle, LogOut, MapPin, PackageCheck, Smartphone, UserRound } from 'lucide-react'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { formatPrice } from '../data/products'
import { getStorefront, postStorefront } from '../lib/storefrontApi'
import { ModalShell } from './ModalShell'

export type StorefrontCustomer = { id: string; fullName: string; email?: string | null; phone: string; createdAt?: string }

type SavedAddress = { id: string; label: string; fullName: string; phone: string; addressLine1: string; addressLine2?: string | null; landmark?: string | null; city: string; state: string; pincode: string; isDefault: boolean }
type CustomerOrder = { publicToken: string; orderNumber: string; status: string; totalPaise: number; createdAt: string; items: Array<{ id: string; productName: string; size?: string | null; quantity: number; finalLineTotalPaise: number }>; shippingAddress?: { fullName?: string; addressLine1?: string; addressLine2?: string | null; city?: string; state?: string; pincode?: string } | null }

const customerCsrfHeaders = (): Record<string, string> => {
  const csrf = document.cookie.split('; ').find((entry) => entry.startsWith('sf_customer_csrf='))?.split('=').slice(1).join('=')
  return csrf ? { 'x-customer-csrf-token': decodeURIComponent(csrf) } : {}
}

const humanise = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const customerName = (customer: StorefrontCustomer) => customer.fullName === 'SkinFox customer' ? 'SkinFox customer' : customer.fullName

export function CustomerAccount({ open, onClose, apiAvailable, onCustomerChange }: { open: boolean; onClose: () => void; apiAvailable: boolean; onCustomerChange: (customer: StorefrontCustomer | null) => void }) {
  const [stage, setStage] = useState<'loading' | 'phone' | 'otp' | 'account'>('loading')
  const [activeTab, setActiveTab] = useState<'orders' | 'addresses'>('orders')
  const [customer, setCustomer] = useState<StorefrontCustomer | null>(null)
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [testOtpCode, setTestOtpCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const loadAccount = useCallback(async (nextCustomer: StorefrontCustomer) => {
    const [nextOrders, nextAddresses] = await Promise.all([
      getStorefront<CustomerOrder[]>('/customer/orders'),
      getStorefront<SavedAddress[]>('/customer/addresses'),
    ])
    setCustomer(nextCustomer)
    setOrders(nextOrders)
    setAddresses(nextAddresses)
    onCustomerChange(nextCustomer)
    setStage('account')
  }, [onCustomerChange])

  useEffect(() => {
    if (!open) return
    let active = true
    setError('')
    setBusy(false)
    setActiveTab('orders')
    if (!apiAvailable) {
      setStage('phone')
      setError('Customer accounts are available when the storefront is connected to the SkinFox API.')
      return
    }
    setStage('loading')
    void getStorefront<{ customer: StorefrontCustomer | null }>('/customer/auth/me').then(async ({ customer: signedInCustomer }) => {
      if (!active) return
      if (!signedInCustomer) { setStage('phone'); return }
      await loadAccount(signedInCustomer)
    }).catch((cause: unknown) => {
      if (!active) return
      setStage('phone')
      setError(cause instanceof Error ? cause.message : 'We could not check your account session.')
    })
    return () => { active = false }
  }, [apiAvailable, loadAccount, open])

  const requestOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await postStorefront<{ challengeId: string; phone: string; testOtpCode?: string }>('/customer/auth/request-otp', { phone })
      setPhone(response.phone)
      setChallengeId(response.challengeId)
      setTestOtpCode(response.testOtpCode ?? '')
      setOtp('')
      setStage('otp')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send an OTP. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const verifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await postStorefront<{ customer: StorefrontCustomer }>('/customer/auth/verify-otp', { challengeId, phone, code: otp })
      setStage('loading')
      await loadAccount(response.customer)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to verify that OTP. Please try again.')
      setStage('otp')
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    setBusy(true)
    setError('')
    try {
      await postStorefront('/customer/auth/logout', {}, customerCsrfHeaders())
      setCustomer(null)
      setOrders([])
      setAddresses([])
      setPhone('')
      setOtp('')
      setChallengeId('')
      setTestOtpCode('')
      onCustomerChange(null)
      setStage('phone')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign out. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell open={open} onClose={onClose} title="Your SkinFox account" className="account-modal">
      <div className="account-shell">
        {stage === 'loading' && <div className="account-loading"><LoaderCircle size={22} /><span>Opening your SkinFox account…</span></div>}

        {stage === 'phone' && <form className="account-auth" onSubmit={requestOtp} noValidate>
          <span className="eyebrow"><UserRound size={14} /> Your SkinFox account</span>
          <h2>Sign in to see your orders.</h2>
          <p>Use your mobile number to view your order history and saved delivery addresses.</p>
          <label className="account-field"><span>Mobile number</span><input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" required placeholder="10-digit mobile number" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button--copper account-submit" disabled={busy || !apiAvailable} type="submit"><Smartphone size={16} />{busy ? 'Sending OTP…' : 'Send SMS OTP'}</button>
          <p className="prototype-note">For this testing release, the server uses the configured static SMS OTP. Firebase SMS will replace it before public launch.</p>
        </form>}

        {stage === 'otp' && <form className="account-auth" onSubmit={verifyOtp} noValidate>
          <span className="eyebrow"><Smartphone size={14} /> Confirm your number</span>
          <h2>Enter your OTP.</h2>
          <p>Enter the six-digit SMS-style OTP sent to +91 {phone}.</p>
          {testOtpCode && <p className="test-otp" role="status">Testing only: use OTP <strong>{testOtpCode}</strong></p>}
          <label className="account-field"><span>Six-digit OTP</span><input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required placeholder="123456" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button--copper account-submit" disabled={busy || otp.length !== 6} type="submit"><PackageCheck size={16} />{busy ? 'Verifying…' : 'Verify and open account'}</button>
          <button className="account-text-button" disabled={busy} type="button" onClick={() => { setStage('phone'); setOtp(''); setError('') }}>Use another number</button>
        </form>}

        {stage === 'account' && customer && <div className="account-dashboard">
          <header className="account-hero">
            <div><span className="eyebrow"><UserRound size={14} /> Your SkinFox account</span><h2>Hello, {customerName(customer)}.</h2><p>Signed in with +91 {customer.phone}. Your account information is only visible in this verified session.</p></div>
            <button className="account-signout" type="button" onClick={() => void logout()} disabled={busy}><LogOut size={15} /> Sign out</button>
          </header>
          <div className="account-tabs" role="tablist" aria-label="Account sections">
            <button role="tab" aria-selected={activeTab === 'orders'} className={activeTab === 'orders' ? 'is-active' : ''} onClick={() => setActiveTab('orders')}><ClipboardList size={16} /> Orders <span>{orders.length}</span></button>
            <button role="tab" aria-selected={activeTab === 'addresses'} className={activeTab === 'addresses' ? 'is-active' : ''} onClick={() => setActiveTab('addresses')}><Home size={16} /> Addresses <span>{addresses.length}</span></button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {activeTab === 'orders' ? <section className="account-section" role="tabpanel">
            <div className="account-section__heading"><div><span className="eyebrow">Order history</span><h3>Your SkinFox edits</h3></div><span>{orders.length ? `${orders.length} order${orders.length === 1 ? '' : 's'}` : 'No orders yet'}</span></div>
            {orders.length ? <div className="order-list">{orders.map((order) => <article className="order-card" key={order.publicToken}>
              <div className="order-card__top"><div><strong>{order.orderNumber}</strong><small>{new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(order.createdAt))}</small></div><span className={`order-status order-status--${order.status}`}>{humanise(order.status)}</span></div>
              <ul>{order.items.map((item) => <li key={item.id}><span>{item.productName}{item.size ? <small>{item.size}</small> : null}</span><b>× {item.quantity}</b></li>)}</ul>
              <div className="order-card__bottom"><span><MapPin size={14} /> {order.shippingAddress?.city ?? 'Delivery address saved'}{order.shippingAddress?.pincode ? ` · ${order.shippingAddress.pincode}` : ''}</span><strong>{formatPrice(order.totalPaise / 100)}</strong></div>
            </article>)}</div> : <div className="account-empty"><PackageCheck size={24} /><h3>Your order history will appear here.</h3><p>Once you place a COD order with this verified number, you can return here to see its status and items.</p></div>}
          </section> : <section className="account-section" role="tabpanel">
            <div className="account-section__heading"><div><span className="eyebrow">Delivery addresses</span><h3>Saved addresses</h3></div><span>Manage at checkout</span></div>
            {addresses.length ? <div className="address-list">{addresses.map((address) => <article className="address-card" key={address.id}><div><strong>{address.label}</strong>{address.isDefault && <span>Default</span>}</div><p><b>{address.fullName}</b><br />{address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ''}{address.landmark ? `, ${address.landmark}` : ''}<br />{address.city}, {address.state} · {address.pincode}</p></article>)}</div> : <div className="account-empty"><Home size={24} /><h3>No saved addresses yet.</h3><p>Your delivery address can be saved during checkout and will then be available for your next SkinFox order.</p></div>}
          </section>}
        </div>}
      </div>
    </ModalShell>
  )
}

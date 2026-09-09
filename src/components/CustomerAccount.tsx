import { CheckCircle2, ClipboardList, Home, LoaderCircle, LogOut, MapPin, MailCheck, PackageCheck, ShieldCheck, UserRound } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { formatPrice } from '../data/products'
import { getStorefront, postStorefront } from '../lib/storefrontApi'
import { exchangeFirebaseUser, firebaseAuthErrorMessage, linkEmailPassword, refreshFirebaseUser, resendEmailVerification, signOutFirebase } from '../lib/firebaseAuth'
import { BrandMark } from './BrandMark'
import { CustomerAuthForm, type CustomerAuthCustomer, type CustomerAuthResponse } from './CustomerAuthForm'
import { ModalShell } from './ModalShell'

export type StorefrontCustomer = CustomerAuthCustomer

type SavedAddress = { id: string; label: string; fullName: string; phone: string; addressLine1: string; addressLine2?: string | null; landmark?: string | null; city: string; state: string; pincode: string; isDefault: boolean }
type CustomerOrder = { publicToken: string; orderNumber: string; status: string; totalPaise: number; createdAt: string; items: Array<{ id: string; productName: string; size?: string | null; quantity: number; finalLineTotalPaise: number }>; shippingAddress?: { fullName?: string; addressLine1?: string; addressLine2?: string | null; city?: string; state?: string; pincode?: string } | null }

const customerCsrfHeaders = (): Record<string, string> => {
  const csrf = document.cookie.split('; ').find((entry) => entry.startsWith('sf_customer_csrf='))?.split('=').slice(1).join('=')
  return csrf ? { 'x-customer-csrf-token': decodeURIComponent(csrf) } : {}
}

const humanise = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

function AccountAuthShell({ children }: { children: ReactNode }) {
  return <div className="account-auth">
    <aside className="account-auth__aside" aria-label="SkinFox account benefits">
      <BrandMark />
      <div>
        <span className="account-auth__kicker">SkinFox account</span>
        <h2>Care, kept close.</h2>
        <p>A private space for orders, delivery details and the rituals you return to.</p>
      </div>
      <ul>
        <li><CheckCircle2 size={16} /> Order updates in one place</li>
        <li><CheckCircle2 size={16} /> Saved delivery addresses</li>
        <li><ShieldCheck size={16} /> Protected by Firebase Auth</li>
      </ul>
    </aside>
    <div className="account-auth__main">
      <div className="account-progress"><span className="account-progress__label">Secure sign-in</span><span>Email or Google</span></div>
      <div className="account-auth__content">{children}</div>
    </div>
  </div>
}

export function CustomerAccount({ open, onClose, apiAvailable, onCustomerChange }: { open: boolean; onClose: () => void; apiAvailable: boolean; onCustomerChange: (customer: StorefrontCustomer | null) => void }) {
  const [stage, setStage] = useState<'loading' | 'auth' | 'verification' | 'account'>('loading')
  const [activeTab, setActiveTab] = useState<'orders' | 'addresses'>('orders')
  const [customer, setCustomer] = useState<StorefrontCustomer | null>(null)
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [linkEmail, setLinkEmail] = useState('')
  const [linkPassword, setLinkPassword] = useState('')
  const [showLinkForm, setShowLinkForm] = useState(false)

  const showVerificationPending = useCallback((nextCustomer: StorefrontCustomer) => {
    setCustomer(nextCustomer)
    setOrders([])
    setAddresses([])
    setLinkEmail(nextCustomer.email ?? '')
    onCustomerChange(nextCustomer)
    setStage('verification')
  }, [onCustomerChange])

  const loadAccount = useCallback(async (nextCustomer: StorefrontCustomer) => {
    const [nextOrders, nextAddresses] = await Promise.all([
      getStorefront<CustomerOrder[]>('/customer/orders'),
      getStorefront<SavedAddress[]>('/customer/addresses'),
    ])
    setCustomer(nextCustomer)
    setOrders(nextOrders)
    setAddresses(nextAddresses)
    setLinkEmail(nextCustomer.email ?? '')
    onCustomerChange(nextCustomer)
    setStage('account')
  }, [onCustomerChange])

  useEffect(() => {
    if (!open) return
    let active = true
    setError('')
    setNotice('')
    setBusy(false)
    setActiveTab('orders')
    setShowLinkForm(false)
    if (!apiAvailable) {
      setStage('auth')
      setError('Customer accounts are available when the storefront is connected to the SkinFox API.')
      return
    }
    setStage('loading')
    void getStorefront<{ customer: StorefrontCustomer | null }>('/customer/auth/me').then(async ({ customer: signedInCustomer }) => {
      if (!active) return
      if (!signedInCustomer) { setStage('auth'); return }
      if (!signedInCustomer.emailVerified) { showVerificationPending(signedInCustomer); return }
      await loadAccount(signedInCustomer)
    }).catch((cause: unknown) => {
      if (!active) return
      setStage('auth')
      setError(cause instanceof Error ? cause.message : 'We could not check your account session.')
    })
    return () => { active = false }
  }, [apiAvailable, loadAccount, open, showVerificationPending])

  const authenticated = async (response: CustomerAuthResponse) => {
    setError('')
    if (!response.customer.emailVerified) { showVerificationPending(response.customer); return }
    await loadAccount(response.customer)
  }

  const refreshVerification = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const user = await refreshFirebaseUser()
      const response = await exchangeFirebaseUser<CustomerAuthResponse>(user)
      if (response.customer.emailVerified) {
        await loadAccount(response.customer)
        setNotice('Your email is verified.')
      } else {
        showVerificationPending(response.customer)
        setNotice('Your email is still awaiting verification. Open the latest email and try again.')
      }
    } catch (cause) { setError(firebaseAuthErrorMessage(cause, 'We could not refresh verification status. Please try again.')) } finally { setBusy(false) }
  }

  const resendVerification = async () => {
    setBusy(true)
    setError('')
    try { await resendEmailVerification(); setNotice('Verification email sent. Check your inbox and spam folder.') } catch (cause) { setError(firebaseAuthErrorMessage(cause, 'We could not send a verification email. Please try again.')) } finally { setBusy(false) }
  }

  const addPasswordLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!linkEmail || linkPassword.length < 8) { setError('Enter an email address and a password with at least 8 characters.'); return }
    setBusy(true)
    setError('')
    try {
      const credential = await linkEmailPassword(linkEmail, linkPassword)
      const response = await exchangeFirebaseUser<CustomerAuthResponse>(credential.user, undefined, true)
      await loadAccount(response.customer)
      setLinkPassword('')
      setShowLinkForm(false)
      setNotice('Email and password login has been added to your account.')
    } catch (cause) { setError(firebaseAuthErrorMessage(cause, 'We could not add email and password login. Please try again.')) } finally { setBusy(false) }
  }

  const logout = async () => {
    setBusy(true)
    setError('')
    try {
      await postStorefront('/customer/auth/logout', {}, customerCsrfHeaders())
      await signOutFirebase()
      setCustomer(null); setOrders([]); setAddresses([]); setLinkPassword(''); onCustomerChange(null); setStage('auth')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign out. Please try again.') } finally { setBusy(false) }
  }

  return <ModalShell open={open} onClose={onClose} title="Your SkinFox account" className="account-modal">
    <div className="account-shell">
      {stage === 'loading' && <div className="account-loading"><LoaderCircle size={22} /><span>Opening your SkinFox account…</span></div>}
      {stage === 'auth' && <AccountAuthShell>{error && <p className="form-error" role="alert">{error}</p>}<CustomerAuthForm apiAvailable={apiAvailable} destination="account" onAuthenticated={authenticated} /></AccountAuthShell>}
      {stage === 'verification' && customer && <AccountAuthShell><div className="account-pending-verification">
        <span className="account-pending-verification__icon"><MailCheck size={24} /></span>
        <span className="eyebrow">One quick step</span>
        <h2>Check your inbox.</h2>
        <p>Your account is created, but orders and saved addresses unlock after you verify <strong>{customer.email ?? 'your email address'}</strong>.</p>
        <div className="account-pending-verification__notice"><MailCheck size={16} /><span>Open the secure Firebase email, then return here and tap “I verified”.</span></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="auth-notice" role="status">{notice}</p>}
        <div className="account-pending-verification__actions"><button className="button button--copper" type="button" onClick={() => void refreshVerification()} disabled={busy}>I verified</button><button className="button button--dark" type="button" onClick={() => void resendVerification()} disabled={busy}>Resend email</button></div>
        <button className="account-text-button" type="button" onClick={() => void logout()} disabled={busy}><LogOut size={13} /> Sign out</button>
      </div></AccountAuthShell>}
      {stage === 'account' && customer && <div className="account-dashboard">
        <header className="account-hero">
          <div><span className="eyebrow"><UserRound size={14} /> Your SkinFox account</span><h2>Hello, {customer.fullName === 'SkinFox customer' ? 'there' : customer.fullName}.</h2><p>{customer.email ? `Signed in with ${customer.email}. ` : ''}Your account information is only visible in this signed-in session.</p></div>
          <button className="account-signout" type="button" onClick={() => void logout()} disabled={busy}><LogOut size={15} /> Sign out</button>
        </header>
        {customer.email && !customer.emailVerified && <div className="verification-banner" role="status"><MailCheck size={18} /><div><strong>Verify your email before ordering.</strong><span>We sent a secure link to {customer.email}. Your cart stays saved while you verify.</span></div><div className="verification-banner__actions"><button type="button" onClick={() => void resendVerification()} disabled={busy}>Resend email</button><button type="button" onClick={() => void refreshVerification()} disabled={busy}>I verified</button></div></div>}
        {!customer.email && <div className="verification-banner" role="status"><MailCheck size={18} /><div><strong>Legacy account recovery</strong><span>Your previous SkinFox history is preserved. Contact <a href="mailto:contact@skinfox.in">contact@skinfox.in</a> so support can help you add a secure sign-in.</span></div></div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="auth-notice" role="status">{notice}</p>}
        <div className="account-tabs" role="tablist" aria-label="Account sections">
          <button role="tab" aria-selected={activeTab === 'orders'} className={activeTab === 'orders' ? 'is-active' : ''} onClick={() => setActiveTab('orders')}><ClipboardList size={16} /> Orders <span>{orders.length}</span></button>
          <button role="tab" aria-selected={activeTab === 'addresses'} className={activeTab === 'addresses' ? 'is-active' : ''} onClick={() => setActiveTab('addresses')}><Home size={16} /> Addresses <span>{addresses.length}</span></button>
        </div>
        {activeTab === 'orders' ? <section className="account-section" role="tabpanel">
          <div className="account-section__heading"><div><span className="eyebrow">Order history</span><h3>Your SkinFox edits</h3></div><span>{orders.length ? `${orders.length} order${orders.length === 1 ? '' : 's'}` : 'No orders yet'}</span></div>
          {orders.length ? <div className="order-list">{orders.map((order) => <article className="order-card" key={order.publicToken}><div className="order-card__top"><div><strong>{order.orderNumber}</strong><small>{new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(order.createdAt))}</small></div><span className={`order-status order-status--${order.status}`}>{humanise(order.status)}</span></div><ul>{order.items.map((item) => <li key={item.id}><span>{item.productName}{item.size ? <small>{item.size}</small> : null}</span><b>× {item.quantity}</b></li>)}</ul><div className="order-card__bottom"><span><MapPin size={14} /> {order.shippingAddress?.city ?? 'Delivery address saved'}{order.shippingAddress?.pincode ? ` · ${order.shippingAddress.pincode}` : ''}</span><strong>{formatPrice(order.totalPaise / 100)}</strong></div></article>)}</div> : <div className="account-empty"><PackageCheck size={24} /><h3>Your order history will appear here.</h3><p>Once you place a COD order, you can return here to see its status and items.</p></div>}
        </section> : <section className="account-section" role="tabpanel">
          <div className="account-section__heading"><div><span className="eyebrow">Delivery addresses</span><h3>Saved addresses</h3></div><span>Manage at checkout</span></div>
          {addresses.length ? <div className="address-list">{addresses.map((address) => <article className="address-card" key={address.id}><div><strong>{address.label}</strong>{address.isDefault && <span>Default</span>}</div><p><b>{address.fullName}</b><br />{address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ''}{address.landmark ? `, ${address.landmark}` : ''}<br />{address.city}, {address.state} · {address.pincode}<br />{address.phone}</p></article>)}</div> : <div className="account-empty"><Home size={24} /><h3>No saved addresses yet.</h3><p>Your delivery address can be saved during checkout and will then be available for your next SkinFox order.</p></div>}
          {!showLinkForm ? <button type="button" className="account-text-button account-link-login" onClick={() => setShowLinkForm(true)}>Add email and password login</button> : <form className="account-link-form" onSubmit={addPasswordLogin}><h4>Add email and password login</h4><label className="account-field"><span>Email address</span><input type="email" value={linkEmail} onChange={(event) => setLinkEmail(event.target.value)} required autoComplete="email" /></label><label className="account-field"><span>Password</span><input type="password" value={linkPassword} onChange={(event) => setLinkPassword(event.target.value)} required minLength={8} autoComplete="new-password" /></label><div><button className="button button--copper" type="submit" disabled={busy}>Save login</button><button className="account-text-button" type="button" onClick={() => setShowLinkForm(false)}>Cancel</button></div></form>}
        </section>}
      </div>}
    </div>
  </ModalShell>
}

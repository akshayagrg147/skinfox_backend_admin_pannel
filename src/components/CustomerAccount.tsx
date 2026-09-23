import { Bell, CheckCircle2, CircleDollarSign, ClipboardList, Home, LoaderCircle, LogOut, MapPin, MailCheck, PackageCheck, Pencil, Plus, ShieldCheck, Trash2, UserRound, WalletCards } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { formatPrice, products } from '../data/products'
import { deleteStorefront, getStorefront, patchStorefront, postStorefront } from '../lib/storefrontApi'
import { exchangeFirebaseUser, firebaseAuthErrorMessage, linkEmailPassword, refreshFirebaseUser, resendEmailVerification, signOutFirebase } from '../lib/firebaseAuth'
import { BrandMark } from './BrandMark'
import { CustomerAuthForm, type CustomerAuthCustomer, type CustomerAuthResponse } from './CustomerAuthForm'
import { ModalShell } from './ModalShell'

export type StorefrontCustomer = CustomerAuthCustomer
export type AccountSection = 'profile' | 'orders' | 'supercoin' | 'wallet' | 'addresses' | 'notifications'

type SavedAddress = { id: string; label: string; fullName: string; phone: string; addressLine1: string; addressLine2?: string | null; landmark?: string | null; city: string; state: string; pincode: string; isDefault: boolean }
type AddressDraft = Omit<SavedAddress, 'id'>
type CustomerOrderItem = { id: string; productId?: string | null; sku?: string | null; productName: string; size?: string | null; quantity: number; primaryImage?: string | null; unitSellingPricePaise?: number | null; mrpPaise?: number | null; discountPaise?: number | null; finalLineTotalPaise: number }
type CustomerShipment = { id: string; provider?: string | null; status?: string | null; providerStatus?: string | null; courierName?: string | null; trackingNumber?: string | null; trackingUrl?: string | null; estimatedDeliveryFrom?: string | null; estimatedDeliveryTo?: string | null; events?: Array<{ id: string; status: string; createdAt?: string }> }
type CustomerNotification = { id: string; type: string; title: string; body: string; readAt?: string | null; createdAt: string; orderId?: string | null; shipmentId?: string | null }
type CustomerOrder = { publicToken: string; orderNumber: string; status: string; subtotalPaise?: number; discountPaise?: number; taxPaise?: number; shippingPaise?: number; codPaise?: number; totalPaise: number; createdAt: string; mrpSubtotalPaise?: number | null; estimatedDeliveryFrom?: string | null; estimatedDeliveryTo?: string | null; payments?: Array<{ provider: string; status: string }>; items: CustomerOrderItem[]; shipments?: CustomerShipment[]; shippingAddress?: { fullName?: string; addressLine1?: string; addressLine2?: string | null; city?: string; state?: string; pincode?: string } | null }

const customerCsrfHeaders = (): Record<string, string> => {
  const csrf = document.cookie.split('; ').find((entry) => entry.startsWith('sf_customer_csrf='))?.split('=').slice(1).join('=')
  return csrf ? { 'x-customer-csrf-token': decodeURIComponent(csrf) } : {}
}

const humanise = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

const numericPaise = (value: number | null | undefined) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

const displayPaise = (value: number | null | undefined) => {
  const parsed = numericPaise(value)
  return parsed === null ? 'Not available' : formatPrice(parsed / 100)
}

const orderItemImage = (item: CustomerOrderItem) => {
  const storedImage = item.primaryImage?.trim()
  if (storedImage) return storedImage
  const catalogueItem = products.find((product) => product.id === item.productId || product.id === item.sku || product.name === item.productName)
  return catalogueItem?.image ?? ''
}

const customerInitials = (name?: string) => {
  const initials = (name ?? 'SkinFox customer')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
  return initials || 'SF'
}

const emptyAddressDraft = (customer?: StorefrontCustomer): AddressDraft => ({
  label: 'Home',
  fullName: customer?.fullName === 'SkinFox customer' ? '' : customer?.fullName ?? '',
  phone: customer?.phone ?? '',
  addressLine1: '',
  addressLine2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  isDefault: false,
})

function AccountAuthShell({ children }: { children: ReactNode }) {
  return <div className="account-auth">
    <aside className="account-auth__aside" aria-label="SkinFox account benefits">
      <BrandMark />
      <div>
        <span className="account-auth__kicker">SkinFox account</span>
        <h2>Care, kept close.</h2>
        <p>Your everyday essentials, delivery details and order updates. Together in one simple place.</p>
      </div>
      <ul>
        <li><CheckCircle2 size={16} /> Order updates in one place</li>
        <li><CheckCircle2 size={16} /> Saved delivery addresses</li>
        <li><ShieldCheck size={16} /> Secure, personal sign-in</li>
      </ul>
    </aside>
    <div className="account-auth__main">
      <div className="account-progress"><span className="account-progress__label">Secure sign-in</span><span>Email or Google</span></div>
      <div className="account-auth__content">{children}</div>
    </div>
  </div>
}

export function CustomerAccount({ open, onClose, apiAvailable, onCustomerChange, initialSection = 'orders' }: { open: boolean; onClose: () => void; apiAvailable: boolean; onCustomerChange: (customer: StorefrontCustomer | null) => void; initialSection?: AccountSection }) {
  const [stage, setStage] = useState<'loading' | 'auth' | 'verification' | 'account'>('loading')
  const [activeSection, setActiveSection] = useState<AccountSection>(initialSection)
  const [customer, setCustomer] = useState<StorefrontCustomer | null>(null)
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [notifications, setNotifications] = useState<CustomerNotification[]>([])
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [linkEmail, setLinkEmail] = useState('')
  const [linkPassword, setLinkPassword] = useState('')
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [addressFormOpen, setAddressFormOpen] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(() => emptyAddressDraft())

  const showVerificationPending = useCallback((nextCustomer: StorefrontCustomer) => {
    setCustomer(nextCustomer)
    setOrders([])
    setNotifications([])
    setAddresses([])
    setLinkEmail(nextCustomer.email ?? '')
    setProfileName(nextCustomer.fullName ?? '')
    setProfilePhone(nextCustomer.phone ?? '')
    onCustomerChange(nextCustomer)
    setStage('verification')
  }, [onCustomerChange])

  const loadAccount = useCallback(async (nextCustomer: StorefrontCustomer) => {
    const [nextOrders, nextAddresses, nextNotifications] = await Promise.all([
      getStorefront<CustomerOrder[]>('/customer/orders'),
      getStorefront<SavedAddress[]>('/customer/addresses'),
      getStorefront<CustomerNotification[]>('/customer/notifications'),
    ])
    setCustomer(nextCustomer)
    setOrders(nextOrders)
    setNotifications(Array.isArray(nextNotifications) ? nextNotifications : [])
    setAddresses(nextAddresses)
    setLinkEmail(nextCustomer.email ?? '')
    setProfileName(nextCustomer.fullName ?? '')
    setProfilePhone(nextCustomer.phone ?? '')
    setAddressDraft(emptyAddressDraft(nextCustomer))
    onCustomerChange(nextCustomer)
    setStage('account')
  }, [onCustomerChange])

  useEffect(() => {
    if (!open) return
    let active = true
    setError('')
    setNotice('')
    setBusy(false)
    setActiveSection(initialSection)
    setShowLinkForm(false)
    setProfileEditing(false)
    setAddressFormOpen(false)
    setEditingAddressId(null)
    if (!apiAvailable) {
      setStage('auth')
      setError('We’re having trouble connecting to your account. Please try again shortly.')
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
  }, [apiAvailable, initialSection, loadAccount, open, showVerificationPending])

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
      setCustomer(null); setOrders([]); setNotifications([]); setAddresses([]); setLinkPassword(''); setProfileEditing(false); setAddressFormOpen(false); onCustomerChange(null); setStage('auth')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign out. Please try again.') } finally { setBusy(false) }
  }

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const fullName = profileName.trim()
    const phone = profilePhone.replace(/\D/g, '')
    if (fullName.length < 2) { setError('Enter your full name.'); return }
    if (phone && !/^[6-9]\d{9}$/.test(phone)) { setError('Enter a valid 10-digit Indian mobile number or leave it blank.'); return }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const updated = await patchStorefront<StorefrontCustomer>('/customer/auth/profile', { fullName, phone: phone || null }, customerCsrfHeaders())
      setCustomer(updated)
      setProfileName(updated.fullName)
      setProfilePhone(updated.phone ?? '')
      onCustomerChange(updated)
      setProfileEditing(false)
      setNotice('Your profile details have been saved.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'We could not save your profile details. Please try again.') } finally { setBusy(false) }
  }

  const refreshAddresses = async () => {
    const nextAddresses = await getStorefront<SavedAddress[]>('/customer/addresses')
    setAddresses(nextAddresses)
  }

  const beginNewAddress = () => {
    if (!customer) return
    setEditingAddressId(null)
    setAddressDraft(emptyAddressDraft(customer))
    setAddressFormOpen(true)
    setError('')
    setNotice('')
    setActiveSection('addresses')
  }

  const beginEditAddress = (address: SavedAddress) => {
    setEditingAddressId(address.id)
    setAddressDraft({ label: address.label, fullName: address.fullName, phone: address.phone, addressLine1: address.addressLine1, addressLine2: address.addressLine2 ?? '', landmark: address.landmark ?? '', city: address.city, state: address.state, pincode: address.pincode, isDefault: address.isDefault })
    setAddressFormOpen(true)
    setError('')
    setNotice('')
    setActiveSection('addresses')
  }

  const saveAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const payload = { ...addressDraft, label: addressDraft.label.trim() || 'Home', fullName: addressDraft.fullName.trim(), phone: addressDraft.phone.replace(/\D/g, ''), addressLine1: addressDraft.addressLine1.trim(), addressLine2: addressDraft.addressLine2?.trim() || undefined, landmark: addressDraft.landmark?.trim() || undefined, city: addressDraft.city.trim(), state: addressDraft.state.trim(), pincode: addressDraft.pincode.replace(/\D/g, '') }
    try {
      if (editingAddressId) await patchStorefront<SavedAddress>(`/customer/addresses/${editingAddressId}`, payload, customerCsrfHeaders())
      else await postStorefront<SavedAddress>('/customer/addresses', payload, customerCsrfHeaders())
      await refreshAddresses()
      setAddressFormOpen(false)
      setEditingAddressId(null)
      setAddressDraft(emptyAddressDraft(customer ?? undefined))
      setNotice(editingAddressId ? 'Address updated successfully.' : 'Address saved successfully.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'We could not save this address. Please check the details and try again.') } finally { setBusy(false) }
  }

  const removeAddress = async (address: SavedAddress) => {
    if (typeof window !== 'undefined' && !window.confirm(`Remove your ${address.label.toLowerCase()} address?`)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await deleteStorefront<{ deleted: boolean }>(`/customer/addresses/${address.id}`, customerCsrfHeaders())
      await refreshAddresses()
      if (editingAddressId === address.id) { setAddressFormOpen(false); setEditingAddressId(null) }
      setNotice('Address removed.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'We could not remove this address. Please try again.') } finally { setBusy(false) }
  }

  return <ModalShell open={open} onClose={onClose} title="Your SkinFox account" className="account-modal">
    <div className="account-shell">
      {stage === 'loading' && <div className="account-loading" role="status" aria-live="polite"><LoaderCircle size={22} aria-hidden="true" /><span>Opening your SkinFox account…</span></div>}
      {stage === 'auth' && <AccountAuthShell>{error && <p className="form-error" role="alert">{error}</p>}<CustomerAuthForm apiAvailable={apiAvailable} destination="account" onAuthenticated={authenticated} /></AccountAuthShell>}
      {stage === 'verification' && customer && <AccountAuthShell><div className="account-pending-verification">
        <span className="account-pending-verification__icon"><MailCheck size={24} /></span>
        <span className="eyebrow">One quick step</span>
        <h2>Check your inbox.</h2>
        <p>Your account is created, but orders and saved addresses unlock after you verify <strong>{customer.email ?? 'your email address'}</strong>.</p>
        <div className="account-pending-verification__notice"><MailCheck size={16} /><span>Open the verification link in your email, then return here and select “I verified”. Check your spam folder if it hasn’t arrived.</span></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="auth-notice" role="status">{notice}</p>}
        <div className="account-pending-verification__actions"><button className="button button--copper" type="button" onClick={() => void refreshVerification()} disabled={busy}>I verified</button><button className="button button--dark" type="button" onClick={() => void resendVerification()} disabled={busy}>Resend email</button></div>
        <button className="account-text-button" type="button" onClick={() => void logout()} disabled={busy}><LogOut size={13} /> Sign out</button>
      </div></AccountAuthShell>}
      {stage === 'account' && customer && <div className="account-dashboard account-dashboard--split">
        <aside className="account-sidebar" aria-label="Account navigation">
          <div className="account-sidebar__identity">
            <span className="account-sidebar__avatar" aria-hidden="true">{customerInitials(customer.fullName)}</span>
            <div><span>Hello,</span><strong>{customer.fullName === 'SkinFox customer' ? 'SkinFox customer' : customer.fullName}</strong></div>
          </div>
          <nav className="account-sidebar__nav">
            <button type="button" className={activeSection === 'profile' ? 'is-active' : ''} aria-current={activeSection === 'profile' ? 'page' : undefined} onClick={() => setActiveSection('profile')}><UserRound size={17} /><span>My profile</span></button>
            <button type="button" className={activeSection === 'orders' ? 'is-active' : ''} aria-current={activeSection === 'orders' ? 'page' : undefined} onClick={() => setActiveSection('orders')}><ClipboardList size={17} /><span>My orders</span><b>{orders.length}</b></button>
            <div className="account-sidebar__group"><span>Account settings</span><button type="button" className={activeSection === 'addresses' ? 'is-active' : ''} aria-current={activeSection === 'addresses' ? 'page' : undefined} onClick={() => setActiveSection('addresses')}><Home size={17} /><span>Saved addresses</span><b>{addresses.length}</b></button></div>
            <div className="account-sidebar__group"><span>Rewards & payments</span><button type="button" className={activeSection === 'supercoin' ? 'is-active' : ''} aria-current={activeSection === 'supercoin' ? 'page' : undefined} onClick={() => setActiveSection('supercoin')}><CircleDollarSign size={17} /><span>Supercoin</span></button><button type="button" className={activeSection === 'wallet' ? 'is-active' : ''} aria-current={activeSection === 'wallet' ? 'page' : undefined} onClick={() => setActiveSection('wallet')}><WalletCards size={17} /><span>Saved cards & wallet</span></button></div>
            <div className="account-sidebar__group"><span>My stuff</span><button type="button" className={activeSection === 'notifications' ? 'is-active' : ''} aria-current={activeSection === 'notifications' ? 'page' : undefined} onClick={() => setActiveSection('notifications')}><Bell size={17} /><span>Notifications</span>{notifications.some((item) => !item.readAt) && <b>{notifications.filter((item) => !item.readAt).length}</b>}</button></div>
          </nav>
          <button className="account-sidebar__logout" type="button" onClick={() => void logout()} disabled={busy}><LogOut size={16} /> Logout</button>
        </aside>
        <div className="account-dashboard__main">
          <header className="account-hero">
            <div><span className="eyebrow"><UserRound size={14} /> Your SkinFox account</span><h2>Hello, {customer.fullName === 'SkinFox customer' ? 'there' : customer.fullName}.</h2><p>Your care, conveniently together. Manage your details and follow your orders here.</p>{customer.email && <span className="account-hero__email">{customer.email}</span>}</div>
            <span className="account-hero__status"><CheckCircle2 size={15} /> Secure session</span>
          </header>
          {customer.email && !customer.emailVerified && <div className="verification-banner" role="status"><MailCheck size={18} /><div><strong>Verify your email before ordering.</strong><span>We sent a secure link to {customer.email}. Your cart stays saved while you verify.</span></div><div className="verification-banner__actions"><button type="button" onClick={() => void resendVerification()} disabled={busy}>Resend email</button><button type="button" onClick={() => void refreshVerification()} disabled={busy}>I verified</button></div></div>}
          {!customer.email && <div className="verification-banner" role="status"><MailCheck size={18} /><div><strong>Legacy account recovery</strong><span>Your previous SkinFox history is preserved. Contact <a href="mailto:contact@skinfox.in">contact@skinfox.in</a> so support can help you add a secure sign-in.</span></div></div>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          {(activeSection === 'orders' || activeSection === 'addresses') && <div className="account-tabs" role="tablist" aria-label="Account sections" onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const next = event.key === 'Home' ? 'orders' : event.key === 'End' ? 'addresses' : activeSection === 'orders' ? 'addresses' : 'orders'
            setActiveSection(next)
            event.currentTarget.querySelector<HTMLButtonElement>(`#account-${next}-tab`)?.focus()
          }}>
            <button type="button" id="account-orders-tab" role="tab" aria-controls="account-section-panel" tabIndex={activeSection === 'orders' ? 0 : -1} aria-selected={activeSection === 'orders'} className={activeSection === 'orders' ? 'is-active' : ''} onClick={() => setActiveSection('orders')}><ClipboardList size={16} /> Orders <span>{orders.length}</span></button>
            <button type="button" id="account-addresses-tab" role="tab" aria-controls="account-section-panel" tabIndex={activeSection === 'addresses' ? 0 : -1} aria-selected={activeSection === 'addresses'} className={activeSection === 'addresses' ? 'is-active' : ''} onClick={() => setActiveSection('addresses')}><Home size={16} /> Addresses <span>{addresses.length}</span></button>
          </div>}
          {activeSection === 'orders' ? <section id="account-section-panel" className="account-section" role="tabpanel" aria-labelledby="account-orders-tab">
            <div className="account-section__heading"><div><span className="eyebrow">Order history</span><h3>Your orders</h3></div><span>{orders.length ? `${orders.length} order${orders.length === 1 ? '' : 's'}` : 'No orders yet'}</span></div>
            {orders.length ? <div className="order-list">{orders.map((order) => {
              const itemProductTotal = order.items.reduce((total, item) => total + (numericPaise(item.finalLineTotalPaise) ?? 0), 0)
              const itemMrpValues = order.items.map((item) => {
                const mrp = numericPaise(item.mrpPaise)
                const quantity = Math.max(0, Number(item.quantity) || 0)
                return mrp === null ? null : mrp * quantity
              })
              const itemMrpValue = itemMrpValues.every((value) => value !== null) ? itemMrpValues.reduce((total, value) => total + (value ?? 0), 0) : null
              const subtotal = numericPaise(order.subtotalPaise) ?? itemProductTotal
              const mrpValue = numericPaise(order.mrpSubtotalPaise) ?? itemMrpValue
              const orderDiscount = numericPaise(order.discountPaise) ?? 0
              const productTotal = Math.max(0, subtotal - orderDiscount)
              const shipping = Math.max(0, numericPaise(order.shippingPaise) ?? 0)
              const tax = Math.max(0, numericPaise(order.taxPaise) ?? 0)
              const codFee = Math.max(0, numericPaise(order.codPaise) ?? 0)
              const summaryTotal = Math.max(0, numericPaise(order.totalPaise) ?? 0)
              const formulaBase = `Products ${displayPaise(subtotal)}`
              const balanceFormula = [
                formulaBase,
                ...(orderDiscount > 0 ? [`− ${displayPaise(orderDiscount)} discount`] : []),
                `= ${displayPaise(productTotal)} total (incl. GST)`,
                ...(shipping > 0 ? [`+ ${displayPaise(shipping)} shipping`] : []),
                ...(codFee > 0 ? [`+ ${displayPaise(codFee)} COD fee`] : []),
                `= ${displayPaise(summaryTotal)} total`,
              ].join(' ')
              return <article className="order-card" key={order.publicToken}>
                <div className="order-card__top"><div><strong>{order.orderNumber}</strong><small>{new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(order.createdAt))}</small></div><span className={`order-status order-status--${order.status}`}>{humanise(order.status)}</span></div>
                <div className="order-card__products-heading"><span>Products</span><span>{order.items.length} {order.items.length === 1 ? 'item' : 'items'}</span></div>
                <ul className="order-card__items">{order.items.map((item) => {
                  const quantity = Math.max(0, Number(item.quantity) || 0)
                  const lineTotal = numericPaise(item.finalLineTotalPaise)
                  const unitPrice = numericPaise(item.unitSellingPricePaise) ?? (lineTotal !== null && quantity > 0 ? Math.round(lineTotal / quantity) : null)
                  const mrpUnit = numericPaise(item.mrpPaise)
                  const recordedLineDiscount = numericPaise(item.discountPaise)
                  const lineDiscount = recordedLineDiscount !== null && recordedLineDiscount > 0 ? recordedLineDiscount : (mrpUnit !== null && unitPrice !== null ? Math.max(0, (mrpUnit - unitPrice) * quantity) : null)
                  const image = orderItemImage(item)
                  return <li className="order-line" key={item.id}>
                    <div className="order-line__header">
                      <div className="order-line__media">{image ? <img src={image} alt={`${item.productName}${item.size ? ` ${item.size}` : ''}`} loading="lazy" decoding="async" /> : <PackageCheck size={18} aria-hidden="true" />}</div>
                      <div className="order-line__identity"><strong>{item.productName}</strong><span>{item.size || 'Pack size not available'}</span></div>
                      <div className="order-line__quantity"><span>Quantity</span><strong>× {quantity}</strong></div>
                    </div>
                    <div className="order-line__pricing">
                      <span><small>MRP / unit</small><b>{displayPaise(mrpUnit)}</b></span>
                      <span><small>Your price / unit</small><b>{displayPaise(unitPrice)}</b></span>
                      <span className="order-line__total"><small>Product total</small><b>{displayPaise(lineTotal)}</b></span>
                    </div>
                    {lineDiscount !== null && lineDiscount > 0 && <span className="order-line__saving">Includes {displayPaise(lineDiscount)} saved on this product</span>}
                  </li>
                })}</ul>
                <div className="order-card__breakdown"><div className="order-card__formula"><span>Payment summary</span><strong>{balanceFormula}</strong></div>{mrpValue !== null ? <span><span>Total MRP value</span><b>{displayPaise(mrpValue)}</b></span> : <span><span>Total MRP value</span><b>Not available</b></span>}{orderDiscount > 0 && <span><span>Order discount</span><b>−{displayPaise(orderDiscount)}</b></span>}<span><span>Products after discount (incl. GST)</span><b>{displayPaise(productTotal)}</b></span>{tax > 0 && <><span><span>Base price (excl. GST)</span><b>{displayPaise(Math.max(0, productTotal - tax))}</b></span><span><span>GST included (18%)</span><b>{displayPaise(tax)}</b></span></>}{shipping > 0 && <span><span>Shipping</span><b>+{displayPaise(shipping)}</b></span>}{codFee > 0 && <span><span>COD fee</span><b>+{displayPaise(codFee)}</b></span>}<span className="order-card__balance"><span>Order total</span><b>{displayPaise(summaryTotal)}</b></span></div>
                {(() => { const shipment = order.shipments?.find((entry) => entry.status !== 'cancelled') ?? order.shipments?.[0]; const formatDate = (value?: string | null) => { if (!value) return null; const parsed = new Date(value); return Number.isNaN(parsed.valueOf()) ? null : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed) }; const from = formatDate(shipment?.estimatedDeliveryFrom ?? order.estimatedDeliveryFrom); const to = formatDate(shipment?.estimatedDeliveryTo ?? order.estimatedDeliveryTo); return <div className="order-card__shipment" aria-label="Shipment tracking"><div><PackageCheck size={16} aria-hidden="true" /><span><strong>{shipment ? (shipment.courierName ?? 'Shipment booked') : order.status === 'confirmed' || order.status === 'processing' || order.status === 'packed' ? 'Preparing your shipment' : 'Delivery updates'}</strong><small>{shipment?.trackingNumber ? `AWB ${shipment.trackingNumber}` : 'Tracking will appear here once the courier is booked.'}</small></span></div>{shipment?.trackingUrl && shipment.trackingNumber ? <a href={shipment.trackingUrl} target="_blank" rel="noreferrer">Track shipment</a> : <span className="order-card__shipment-eta">{from ? `Estimated ${from}${to && to !== from ? ` – ${to}` : ''}` : 'ETA pending'}</span>}</div> })()}
                <div className="order-card__bottom"><span><MapPin size={14} /> {order.shippingAddress?.city ?? 'Delivery address saved'}{order.shippingAddress?.pincode ? ` · ${order.shippingAddress.pincode}` : ''}</span><strong>{displayPaise(summaryTotal)}</strong></div>
              </article>
            })}</div> : <div className="account-empty"><PackageCheck size={24} /><h3>Your next routine starts here.</h3><p>Once you place an order, its items and latest status will appear in this space.</p><button className="button button--copper" type="button" onClick={onClose}>Explore the collection</button></div>}
          </section> : activeSection === 'addresses' ? <section id="account-section-panel" className="account-section" role="tabpanel" aria-labelledby="account-addresses-tab">
            <div className="account-section__heading"><div><span className="eyebrow">Delivery addresses</span><h3>Saved addresses</h3></div><button className="button button--copper account-add-address" type="button" onClick={beginNewAddress}><Plus size={15} /> Add address</button></div>
            {addressFormOpen && <CustomerAddressForm draft={addressDraft} editing={Boolean(editingAddressId)} busy={busy} onChange={setAddressDraft} onSubmit={saveAddress} onCancel={() => { setAddressFormOpen(false); setEditingAddressId(null) }} />}
            {addresses.length ? <div className="address-list">{addresses.map((address) => <article className="address-card" key={address.id}><div className="address-card__top"><div><strong>{address.label}</strong>{address.isDefault && <span>Default</span>}</div><div className="address-card__actions"><button type="button" aria-label={`Edit ${address.label} address`} onClick={() => beginEditAddress(address)} disabled={busy}><Pencil size={14} /></button><button type="button" aria-label={`Remove ${address.label} address`} onClick={() => void removeAddress(address)} disabled={busy}><Trash2 size={14} /></button></div></div><p><b>{address.fullName}</b><br />{address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ''}{address.landmark ? `, ${address.landmark}` : ''}<br />{address.city}, {address.state} · {address.pincode}<br />{address.phone}</p></article>)}</div> : !addressFormOpen && <div className="account-empty"><Home size={24} /><h3>No saved addresses yet.</h3><p>Add a delivery address once and it will be ready for your next SkinFox order.</p><button type="button" className="button button--copper" onClick={beginNewAddress}><Plus size={15} /> Add your first address</button></div>}
            {!showLinkForm ? <button type="button" className="account-text-button account-link-login" onClick={() => setShowLinkForm(true)}>Add email and password login</button> : <form className="account-link-form" onSubmit={addPasswordLogin}><h4>Add email and password login</h4><label className="account-field"><span>Email address</span><input type="email" value={linkEmail} onChange={(event) => setLinkEmail(event.target.value)} required autoComplete="email" /></label><label className="account-field"><span>Password</span><input type="password" value={linkPassword} onChange={(event) => setLinkPassword(event.target.value)} required minLength={8} autoComplete="new-password" /></label><div><button className="button button--copper" type="submit" disabled={busy}>Save login</button><button className="account-text-button" type="button" onClick={() => setShowLinkForm(false)}>Cancel</button></div></form>}
          </section> : <AccountUtilitySection section={activeSection as Exclude<AccountSection, 'orders' | 'addresses'>} customer={customer} notifications={notifications} onNavigate={setActiveSection} profileEditing={profileEditing} profileName={profileName} profilePhone={profilePhone} onEditProfile={() => { setProfileEditing(true); setError(''); setNotice('') }} onCancelProfile={() => { setProfileEditing(false); setProfileName(customer.fullName); setProfilePhone(customer.phone ?? '') }} onProfileNameChange={setProfileName} onProfilePhoneChange={setProfilePhone} onSaveProfile={saveProfile} busy={busy} />}
        </div>
      </div>}
    </div>
  </ModalShell>
}

function AccountUtilitySection({ section, customer, notifications, onNavigate, profileEditing, profileName, profilePhone, onEditProfile, onCancelProfile, onProfileNameChange, onProfilePhoneChange, onSaveProfile, busy }: { section: Exclude<AccountSection, 'orders' | 'addresses'>; customer: StorefrontCustomer; notifications: CustomerNotification[]; onNavigate: (section: AccountSection) => void; profileEditing: boolean; profileName: string; profilePhone: string; onEditProfile: () => void; onCancelProfile: () => void; onProfileNameChange: (value: string) => void; onProfilePhoneChange: (value: string) => void; onSaveProfile: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  const notificationBody = notifications.length ? <div className="account-notifications" aria-label="Your notifications">{notifications.map((item) => <article className={`account-notification${item.readAt ? '' : ' is-unread'}`} key={item.id}><div><strong>{item.title}</strong><small>{new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(item.createdAt))}</small></div><p>{item.body}</p></article>)}</div> : <p className="account-utility__note">No shipment notifications yet. When a courier is booked, the AWB and delivery estimate will appear here and in My orders.</p>
  const content = {
    profile: { eyebrow: 'Personal details', title: 'My profile', description: 'Keep your name and delivery phone number up to date.', icon: <UserRound size={25} />, body: <dl className="account-utility__details"><div><dt>Full name</dt><dd>{customer.fullName || 'SkinFox customer'}</dd></div><div><dt>Email address</dt><dd>{customer.email || 'Not added'}</dd></div><div><dt>Mobile number</dt><dd>{customer.phone || 'Not added'}</dd></div></dl> },
    supercoin: { eyebrow: 'Rewards', title: 'Supercoin', description: 'Supercoin rewards are not enabled for SkinFox yet. We will notify you when the programme launches.', icon: <CircleDollarSign size={25} />, body: <p className="account-utility__note">Your orders and account remain available while rewards are being prepared.</p> },
    wallet: { eyebrow: 'Payments', title: 'Saved cards & wallet', description: 'Card saving and wallet payments are not available yet.', icon: <WalletCards size={25} />, body: <p className="account-utility__note">Payments are completed securely through Razorpay at checkout. SkinFox does not store your card or UPI credentials.</p> },
    notifications: { eyebrow: 'Updates', title: 'Notifications', description: 'Shipment updates are sent to your verified email address.', icon: <MailCheck size={25} />, body: <>{notificationBody}<p className="account-utility__note">For help, email <a href="mailto:contact@skinfox.in">contact@skinfox.in</a>.</p></> },
  }[section]
  return <section className="account-utility" aria-labelledby="account-utility-title"><span className="account-utility__icon">{content.icon}</span><span className="eyebrow">{content.eyebrow}</span><h3 id="account-utility-title">{content.title}</h3><p>{content.description}</p>{section === 'profile' && profileEditing ? <form className="account-utility__edit-form" onSubmit={onSaveProfile}><label className="account-field"><span>Full name</span><input type="text" value={profileName} onChange={(event) => onProfileNameChange(event.target.value)} autoComplete="name" required minLength={2} maxLength={120} /></label><label className="account-field"><span>Mobile number</span><input type="tel" value={profilePhone} onChange={(event) => onProfilePhoneChange(event.target.value)} inputMode="numeric" autoComplete="tel" maxLength={10} placeholder="10-digit mobile number (optional)" /><small>Use an Indian mobile number beginning with 6, 7, 8 or 9.</small></label><p className="account-utility__form-note">Your email address is managed by your secure sign-in provider and cannot be changed here.</p><div className="account-utility__actions"><button type="submit" className="button button--copper" disabled={busy}>Save changes</button><button type="button" className="account-text-button" onClick={onCancelProfile} disabled={busy}>Cancel</button></div></form> : <>{content.body}<div className="account-utility__actions">{section === 'profile' && <button type="button" className="button button--dark" onClick={onEditProfile}>Edit profile</button>}<button type="button" className="button button--copper" onClick={() => onNavigate('orders')}>View orders</button><button type="button" className="account-text-button" onClick={() => onNavigate('addresses')}>Saved addresses</button></div></>}</section>
}

function CustomerAddressForm({ draft, editing, busy, onChange, onSubmit, onCancel }: { draft: AddressDraft; editing: boolean; busy: boolean; onChange: (draft: AddressDraft) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const [pincodeStatus, setPincodeStatus] = useState<'idle' | 'loading' | 'found' | 'error'>('idle')
  const [pincodeMessage, setPincodeMessage] = useState('')
  const latestDraft = useRef(draft)
  const latestOnChange = useRef(onChange)
  const update = <K extends keyof AddressDraft>(field: K, value: AddressDraft[K]) => onChange({ ...draft, [field]: value })
  useEffect(() => { latestDraft.current = draft }, [draft])
  useEffect(() => { latestOnChange.current = onChange }, [onChange])
  useEffect(() => {
    const pincode = draft.pincode
    if (!/^[1-9]\d{5}$/.test(pincode)) {
      setPincodeStatus('idle')
      setPincodeMessage(pincode ? 'Enter all 6 digits to look up your location.' : '')
      return
    }
    let active = true
    const timer = window.setTimeout(() => {
      setPincodeStatus('loading')
      setPincodeMessage('Looking up city and state…')
      void getStorefront<{ city?: string | null; state?: string | null }>(`/shipping/pincode/${pincode}`)
        .then((location) => {
          if (!active) return
          const currentDraft = latestDraft.current
          if (currentDraft.pincode !== pincode) return
          latestOnChange.current({ ...currentDraft, city: location.city ?? '', state: location.state ?? '' })
          setPincodeStatus(location.city && location.state ? 'found' : 'error')
          setPincodeMessage(location.city && location.state ? 'Location confirmed.' : 'We could not identify this pincode. Check the number and try again.')
        })
        .catch(() => {
          if (!active) return
          setPincodeStatus('error')
          setPincodeMessage('Location lookup is temporarily unavailable. Try again shortly.')
        })
    }, 350)
    return () => { active = false; window.clearTimeout(timer) }
  }, [draft.pincode])
  const updatePincode = (value: string) => {
    onChange({ ...draft, pincode: value, ...(draft.pincode === value ? {} : { city: '', state: '' }) })
    setPincodeStatus('idle')
    setPincodeMessage('')
  }
  return <form className="account-address-form" onSubmit={onSubmit}>
    <div className="account-address-form__heading"><div><span className="eyebrow">{editing ? 'Update address' : 'New address'}</span><h4>{editing ? 'Edit delivery address' : 'Add a delivery address'}</h4></div><button className="account-address-form__close" type="button" onClick={onCancel} disabled={busy} aria-label="Close address form">×</button></div>
    <div className="account-address-form__grid">
      <label className="account-field"><span>Address label</span><input value={draft.label} onChange={(event) => update('label', event.target.value)} required maxLength={30} placeholder="Home, Work…" /></label>
      <label className="account-field"><span>Full name</span><input value={draft.fullName} onChange={(event) => update('fullName', event.target.value)} required minLength={2} maxLength={120} autoComplete="name" /></label>
      <label className="account-field"><span>Mobile number</span><input type="tel" value={draft.phone} onChange={(event) => update('phone', event.target.value)} required inputMode="numeric" maxLength={10} autoComplete="tel" /></label>
      <label className="account-field account-field--wide"><span>Address line</span><input value={draft.addressLine1} onChange={(event) => update('addressLine1', event.target.value)} required minLength={5} maxLength={200} autoComplete="street-address" placeholder="Flat, house no., street" /></label>
      <label className="account-field"><span>Apartment / area</span><input value={draft.addressLine2 ?? ''} onChange={(event) => update('addressLine2', event.target.value)} maxLength={200} placeholder="Optional" /></label>
      <label className="account-field"><span>Landmark</span><input value={draft.landmark ?? ''} onChange={(event) => update('landmark', event.target.value)} maxLength={120} placeholder="Optional" /></label>
      <label className="account-field"><span>City <small>(from pincode)</small></span><input value={draft.city} readOnly aria-readonly="true" className="field-readonly" required minLength={2} maxLength={80} autoComplete="address-level2" placeholder="City will appear automatically" /></label>
      <label className="account-field"><span>State <small>(from pincode)</small></span><input value={draft.state} readOnly aria-readonly="true" className="field-readonly" required minLength={2} maxLength={80} autoComplete="address-level1" placeholder="State will appear automatically" /></label>
      <label className="account-field"><span>Pincode</span><input value={draft.pincode} onChange={(event) => updatePincode(event.target.value.replace(/\D/g, '').slice(0, 6))} required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} autoComplete="postal-code" aria-describedby="account-pincode-status" /><small id="account-pincode-status" className={`pincode-status pincode-status--${pincodeStatus}`} aria-live="polite">{pincodeMessage}</small></label>
    </div>
    <label className="account-address-form__default"><input type="checkbox" checked={draft.isDefault} onChange={(event) => update('isDefault', event.target.checked)} /> <span>Set as my default delivery address</span></label>
    <div className="account-address-form__actions"><button type="submit" className="button button--copper" disabled={busy}>{busy ? 'Saving…' : editing ? 'Update address' : 'Save address'}</button><button type="button" className="account-text-button" onClick={onCancel} disabled={busy}>Cancel</button></div>
  </form>
}

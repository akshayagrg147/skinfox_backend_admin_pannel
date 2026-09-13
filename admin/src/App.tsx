import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, ArrowLeft, BarChart3, Boxes, Check, ChevronRight, CircleAlert, ClipboardList, FileImage, FileText, Gauge, HandCoins, ImageIcon, LayoutDashboard, LockKeyhole, LogOut, Menu, Package, Pencil, Plus, Search, Settings, Shield, ShoppingBag, Sparkles, Tags, Truck, Users, X } from 'lucide-react'
import { FormEvent, KeyboardEvent, ReactNode, useCallback, useDeferredValue, useEffect, useState } from 'react'
import { api, get, getWithMeta, patch, post, remove } from './api'
import { availableScreens, canAccessScreen, defaultScreen, filterRows, formatAdminCell, type AdminRole, withSearch } from './admin-utils'
import { isProductImageAssetPath, makeProductSlug, splitAssetPaths } from './productAssets'
import { dateLabel, filterInventory, humanize, inventorySummary, loadInventory, movementLabel, numberLabel, stockFor, stockLabels, type InventoryMovement, type InventoryRecord, type InventorySnapshot } from './inventory/inventory-data'

type AdminUser = { id: string; email: string; name: string; role: AdminRole; isActive?: boolean; mfaRequired?: boolean; mustChangePassword?: boolean }
type Resource = { id: string; name?: string; title?: string; email?: string; status?: string; createdAt?: string; labelUrl?: string | null; manifestUrl?: string | null; trackingNumber?: string | null; courierName?: string | null; courierId?: string | null; provider?: string; events?: Resource[]; [key: string]: unknown }
type ProductMetrics = { periodDays: number; salesDataAvailable: boolean; unitsSold: number; repeatOrders: number; orderCount: number; performance: 'new' | 'no_sales' | 'slow' | 'selling' | 'unavailable'; performanceLabel: string; stockState: 'untracked' | 'out_of_stock' | 'low_stock' | 'in_stock'; stockLabel: string; inventoryTracked: boolean; onHandQty: number; reservedQty: number; sellableQty: number; lowStockThreshold: number | null; variantCount: number; sku: string; slowMaxUnits?: number; sellingMinUnits?: number }
type AdminProduct = Resource & { productMetrics?: ProductMetrics; media?: Resource[]; variants?: Resource[]; categoryRef?: Resource }
type AdminOrder = Resource & { orderNumber?: string; publicToken?: string; source?: string; status?: string; waitlistReservationId?: string | null; totalPaise?: number; remainingBalancePaise?: number | null; shippingPaise?: number; taxPaise?: number; discountPaise?: number; mrpSubtotalPaise?: number | null; waitlistDiscountPaise?: number | null; reservationCreditPaise?: number; shippingAddress?: Record<string, unknown> | null; customer?: Resource | null; items?: Resource[]; payments?: Resource[]; shipments?: Resource[]; statusEvents?: Resource[]; notes?: Resource[] }
type NavItem = { key: string; label: string; icon: typeof Gauge; permission?: string }
type ResourceConfig = { endpoint: string; title: string; fields: string[]; createTemplate?: Record<string, unknown> }
type WaitlistSettings = { enabled: boolean; depositPaise: number; discountPercent: number; termsVersion: string; currency: 'INR'; refundable: boolean; paymentConfigured: boolean; stage: 'waitlist' | 'founder_reveal' | 'launch' | 'regular'; pricingMode: 'exact_revealed_price' | 'discount_off_mrp' | 'percentage_of_mrp'; founderCapacity: number; founderClaimed: number; founderRemaining: number; foundingClosed: boolean; founderPricePaise: number; launchPricePaise: number; regularPricePaise: number }

const fixedCatalog = [
  { slug: 'rayyvia-sun-protect', image: '/products/rayyvia-sun-protect-primary.webp', alt: 'SkinFox Rayyvia Sun Protect facial suncream 60 g tube in yellow and pink campaign artwork' },
  { slug: 'coco-kiss-moisturizing-lotion', image: '/products/coco-kiss-lotion-primary.webp', alt: 'SkinFox Coco Kiss 100 ml moisturizing lotion pump bottle for dry and ultra-dry skin' },
  { slug: 'acnfin-soft-face-wash', image: '/products/acnfin-soft-face-wash-primary.webp', alt: 'SkinFox Acnfin Soft acne-prone skin foaming face wash 100 g tube and carton' },
  { slug: 'hydrelle-dry-skin-specialist', image: '/products/hydrelle-campaign-new.webp', alt: 'SkinFox Hydrelle Dry Skin Specialist 200 g moisturising lotion campaign artwork' },
  { slug: 'onion-shampoo', image: '/products/onion-shampoo-primary.webp', alt: 'SkinFox Onion Shampoo 300 ml amber pump bottle with its pink carton' },
  { slug: 'intensive-scalp-hair-treatment', image: '/products/scalp-hair-treatment-primary.webp', alt: 'SkinFox Intensive Scalp and Hair Treatment 250 ml herbal oil bottle with its carton' },
  { slug: 'onion-hair-oil', image: '/products/onion-hair-oil-primary.webp', alt: 'SkinFox Onion Hair Oil 200 ml amber bottle with its purple carton' },
] as const

const fixedCatalogBySlug = new Map<string, (typeof fixedCatalog)[number]>(fixedCatalog.map((product) => [product.slug, product]))

const nav: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }, { key: 'products', label: 'Products', icon: Package }, { key: 'catalogue', label: 'Categories & collections', icon: Tags }, { key: 'inventory', label: 'Inventory', icon: Boxes }, { key: 'orders', label: 'Orders & fulfilment', icon: ShoppingBag }, { key: 'waitlist', label: 'Priority waitlist', icon: ClipboardList }, { key: 'customers', label: 'Customers', icon: Users }, { key: 'affiliates', label: 'Affiliates & payouts', icon: HandCoins }, { key: 'campaigns', label: 'Campaign slideshow', icon: FileImage }, { key: 'content', label: 'Homepage & content', icon: FileText }, { key: 'care-finder', label: 'Care finder', icon: Sparkles }, { key: 'promotions', label: 'Promotions & coupons', icon: Tags }, { key: 'shipping', label: 'Shipping & tax', icon: Truck }, { key: 'leads', label: 'Leads', icon: ClipboardList }, { key: 'analytics', label: 'Analytics', icon: BarChart3 }, { key: 'users', label: 'Admin users & roles', icon: Shield }, { key: 'audit', label: 'Audit logs', icon: Activity }, { key: 'settings', label: 'Settings', icon: Settings },
]

const resourceConfig: Record<string, ResourceConfig> = {
  catalogue: { endpoint: '/admin/categories', title: 'Categories & collections', fields: ['name', 'slug', 'sortOrder'], createTemplate: { name: '', slug: '', sortOrder: 0 } },
  campaigns: { endpoint: '/admin/campaign-slides', title: 'Campaign slideshow', fields: ['alt', 'desktopSrc', 'durationMs', 'status'], createTemplate: { kind: 'image', desktopSrc: '', mobileSrc: '', poster: '', alt: '', durationMs: 7000, autoplay: true, focalPoint: '50% 50%', fitMode: 'cover', sortOrder: 0, status: 'draft' } },
  content: { endpoint: '/admin/home-sections', title: 'Homepage & content', fields: ['key', 'title', 'status', 'sortOrder'], createTemplate: { key: '', title: '', payload: {}, sortOrder: 0, status: 'draft' } },
  promotions: { endpoint: '/admin/promotions', title: 'Promotions & coupons', fields: ['name', 'type', 'value', 'active'], createTemplate: { name: '', type: 'percentage', value: 0, minSpendPaise: 0, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 30 * 86400000).toISOString(), active: false } },
  shipping: { endpoint: '/admin/shipping-zones', title: 'Shipping & tax', fields: ['name', 'active'], createTemplate: { name: '', pincodes: [], active: true } },
  leads: { endpoint: '/admin/launch-interests', title: 'Launch-interest leads', fields: ['email', 'name', 'pincode', 'status'] },
  waitlist: { endpoint: '/admin/waitlist-reservations', title: 'Priority waitlist', fields: ['waitlistId', 'founderNumber', 'customer', 'products', 'status', 'depositPaise', 'refundStatus', 'createdAt'] },
  analytics: { endpoint: '/admin/dashboard/sales', title: 'Analytics', fields: ['status', '_count', '_sum'] },
  audit: { endpoint: '/admin/audit-logs', title: 'Audit logs', fields: ['action', 'entityType', 'result', 'createdAt'] },
}

function Login({ onLogin }: { onLogin: (user: AdminUser) => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [mfaCode, setMfaCode] = useState(''); const [error, setError] = useState(''); const [reset, setReset] = useState(false); const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); setBusy(true); try { const user = await api<AdminUser>('/admin/auth/login', { method: 'POST', body: JSON.stringify({ email, password, mfaCode: mfaCode || undefined }) }); onLogin(user) } catch (e) { setError(e instanceof Error ? e.message : 'Unable to sign in.') } finally { setBusy(false) } }
  const invitationToken = new URLSearchParams(window.location.search).get('invitation') ?? ''
  return <main className="login-page"><div className="login-orb" /><section className="login-card"><img src="/brand/skinfox-logo.png" alt="SkinFox" className="login-logo" /><span className="kicker">Operations console</span>{invitationToken ? <AcceptInvitation token={invitationToken} onBack={() => window.history.replaceState({}, '', window.location.pathname)} /> : reset ? <ResetPassword onBack={() => setReset(false)} /> : <><h1>Welcome back.</h1><p className="muted">Secure access to your SkinFox commerce workspace.</p><form onSubmit={submit} className="stack-form"><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" placeholder="you@skinfox.com" /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} autoComplete="current-password" placeholder="At least 12 characters" /></label><label>MFA code <span className="optional">if enabled</span><input value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder="000000" /></label>{error && <div className="alert alert--error"><CircleAlert size={16} />{error}</div>}<button className="primary-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ChevronRight size={17} /></button><button type="button" className="text-button" onClick={() => setReset(true)}>Forgot password?</button></form></>}<small className="login-foot">SkinFox · India / INR · Admin actions are audited</small></section></main>
}

function ResetPassword({ onBack }: { onBack: () => void }) { const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [error, setError] = useState(''); return <form onSubmit={async (event) => { event.preventDefault(); try { await post('/admin/auth/forgot-password', { email }); setSent(true) } catch (e) { setError(e instanceof Error ? e.message : 'Unable to send reset link.') } }} className="stack-form"><h2>Reset password</h2><p className="muted">We’ll send a one-time reset link to your admin email.</p>{sent ? <div className="alert alert--success"><Check size={16} />Check your inbox for the next step.</div> : <><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>{error && <div className="alert alert--error">{error}</div>}<button className="primary-button">Send reset instructions <ChevronRight size={17} /></button></>}<button type="button" className="text-button" onClick={onBack}><ArrowLeft size={15} /> Back to sign in</button></form> }

function AcceptInvitation({ token, onBack }: { token: string; onBack: () => void }) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); if (password !== confirmation) { setError('Passwords do not match.'); return }; setBusy(true); setError(''); try { await post('/admin/auth/accept-invitation', { token, name, password }); setComplete(true) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to accept this invitation.') } finally { setBusy(false) } }
  if (complete) return <div className="stack-form"><h1>Invitation accepted.</h1><p className="muted">Your admin account is ready. Sign in to continue.</p><button className="primary-button" onClick={onBack}>Back to sign in</button></div>
  return <form onSubmit={submit} className="stack-form"><h1>Join SkinFox.</h1><p className="muted">Create your admin account from this invitation.</p><label>Name<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} /></label><label>Confirm password<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={12} /></label>{error && <div className="alert alert--error"><CircleAlert size={16} />{error}</div>}<button className="primary-button" disabled={busy}>{busy ? 'Creating…' : 'Accept invitation'} <ChevronRight size={17} /></button><button type="button" className="text-button" onClick={onBack}><ArrowLeft size={15} /> Back to sign in</button></form>
}

function App() {
  const [user, setUser] = useState<AdminUser | null>(null); const [checking, setChecking] = useState(true); const [active, setActive] = useState(window.location.hash.slice(1) || 'dashboard'); const [sidebarOpen, setSidebarOpen] = useState(false); const queryClient = useQueryClient()
  useEffect(() => { get<AdminUser>('/admin/auth/me').then(setUser).catch(() => undefined).finally(() => setChecking(false)) }, [])
  useEffect(() => { const listener = () => setActive(window.location.hash.slice(1) || 'dashboard'); window.addEventListener('hashchange', listener); return () => window.removeEventListener('hashchange', listener) }, [])
  useEffect(() => { if (!user || canAccessScreen(user.role, active)) return; const fallback = defaultScreen(user.role); window.location.hash = fallback; setActive(fallback) }, [active, user])
  if (checking) return <div className="app-loading"><span className="loader" />Loading SkinFox admin…</div>
  if (!user) return <Login onLogin={setUser} />
  const allowedNav = nav.filter((item) => availableScreens(user.role).includes(item.key))
  const safeActive = canAccessScreen(user.role, active) ? active : defaultScreen(user.role)
  const go = (key: string) => { const url = new URL(window.location.href); url.searchParams.delete('q'); window.history.replaceState({}, '', url); window.location.hash = key; setSidebarOpen(false) }
  const logout = async () => { await post('/admin/auth/logout', {}); queryClient.clear(); setUser(null) }
  return <div className="admin-shell"><aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}><div className="sidebar-brand"><img src="/brand/skinfox-logo.png" alt="SkinFox" /><button className="icon-button mobile-only" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={18} /></button></div><div className="sidebar-label">Workspace</div><nav aria-label="Admin workspace">{allowedNav.map(({ key, label, icon: Icon }) => <button key={key} className={safeActive === key ? 'nav-item is-active' : 'nav-item'} onClick={() => go(key)}><Icon size={17} /><span>{label}</span>{key === 'orders' && <span className="nav-badge">live</span>}</button>)}</nav><div className="sidebar-bottom"><div className="user-chip"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.role.replaceAll('_', ' ')}</small></span></div><button className="nav-item" onClick={logout}><LogOut size={17} />Sign out</button></div></aside><div className="main-column"><header className="topbar"><button className="icon-button mobile-only" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={20} /></button><div><span className="topbar-breadcrumb">SkinFox / Operations</span><h1>{safeActive === 'inventory' ? 'Inventory & stock health' : nav.find((item) => item.key === safeActive)?.label ?? 'Dashboard'}</h1></div><div className="topbar-actions"><span className="environment-pill"><span />Local / safe mode</span><a className="icon-button" href={storefrontUrl()} target="_blank" rel="noreferrer" aria-label="Open storefront"><ArrowLeft size={17} /></a></div></header><main className="content"><View active={safeActive} role={user.role} /></main></div>{sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}</div>
}

function ShippingWorkspace() {
  const status = useQuery({ queryKey: ['shipping-status'], queryFn: () => get<Resource>('/admin/shipping/status') })
  const [pincode, setPincode] = useState('')
  const [weight, setWeight] = useState('500')
  const [result, setResult] = useState<Resource | null>(null)
  const mutation = useMutation({ mutationFn: () => post<Resource>('/admin/shipping/serviceability', { deliveryPincode: pincode, paymentMethod: 'prepaid', package: { weightGrams: Number(weight) } }), onSuccess: setResult })
  if (status.isLoading) return <TableSkeleton />
  return <><div className="page-intro"><div><span className="kicker">Shipping / Shiprocket</span><h2>Shipping operations</h2><p className="muted">Serviceability and booking controls stay behind the authenticated API.</p></div><button className="secondary-button" onClick={() => status.refetch()}><Activity size={16} />Refresh status</button></div><div className="metric-grid"><article className="metric-card"><span>Provider</span><strong>{String(status.data?.provider ?? 'manual')}</strong><small>{status.data?.configured ? 'Credentials configured' : 'Credentials not configured'}</small></article><article className="metric-card"><span>Booking</span><strong>{status.data?.bookingEnabled ? 'Enabled' : 'Disabled'}</strong><small>Live shipment safety switch</small></article><article className="metric-card"><span>Pickup</span><strong>{String(status.data?.pickupLocation ?? 'Not set')}</strong><small>{String(status.data?.pickupPincode ?? 'Pickup pincode not set')}</small></article></div><section className="panel shipping-test-panel"><div className="panel-heading"><div><span className="kicker">Pre-flight check</span><h3>Test delivery serviceability</h3></div><Truck size={18} /></div><div className="form-grid"><label>Delivery pincode<input inputMode="numeric" maxLength={6} value={pincode} onChange={(event) => setPincode(event.target.value.replace(/\D/g, ''))} placeholder="400001" /></label><label>Packed weight (g)<input type="number" min="1" value={weight} onChange={(event) => setWeight(event.target.value)} /></label></div><button className="primary-button" onClick={() => mutation.mutate()} disabled={mutation.isPending || pincode.length !== 6}>{mutation.isPending ? 'Checking…' : 'Check serviceability'}</button>{result && <div className="shipping-test-result"><strong>{result.serviceable ? 'Serviceable' : 'Not serviceable'}</strong><span>{Array.isArray(result.couriers) ? `${result.couriers.length} courier option(s) returned` : 'No courier options returned'}</span></div>}{mutation.isError && <div className="alert alert--error" role="alert">{mutation.error instanceof Error ? mutation.error.message : 'Unable to check serviceability.'}</div>}<p className="fine-print">Set SHIPROCKET_BOOKING_ENABLED=true only after confirming credentials, pickup location and measured packaging.</p></section></>
}

function View({ active, role }: { active: string; role: AdminRole }) { if (active === 'dashboard') return <DashboardOverview role={role} />; if (active === 'products') return <Products />; if (active === 'inventory') return <Inventory canManage={role === 'SUPER_ADMIN' || role === 'CATALOG_MANAGER'} />; if (active === 'orders') return <Orders canManage={role === 'SUPER_ADMIN' || role === 'ORDER_MANAGER'} />; if (active === 'waitlist') return <WaitlistManagement canManage={role === 'SUPER_ADMIN' || role === 'ORDER_MANAGER'} canReset={role === 'SUPER_ADMIN'} />; if (active === 'customers') return <Customers canManage={role === 'SUPER_ADMIN' || role === 'SUPPORT_AGENT'} canAnonymize={role === 'SUPER_ADMIN'} />; if (active === 'affiliates') return <Affiliates />; if (active === 'users') return <UsersView />; if (active === 'care-finder') return <CareFinder />; if (active === 'shipping') return <ShippingWorkspace />; if (active === 'settings') return <SettingsView />; const config = resourceConfig[active]; return config ? <ResourceView {...config} /> : <DashboardOverview role={role} /> }

function useTableSearch() {
  const [search, setSearchState] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '')
  const setSearch = (value: string) => { setSearchState(value); const url = new URL(window.location.href); if (value.trim()) url.searchParams.set('q', value); else url.searchParams.delete('q'); window.history.replaceState({}, '', url) }
  return [search, setSearch] as const
}

const storefrontUrl = () => {
  if (window.location.hostname === 'admin.skinfox.in') return 'https://skinfox.in'
  return window.location.port === '8080' ? `${window.location.protocol}//${window.location.hostname}/` : 'http://localhost:4173'
}

function DashboardOverview({ role }: { role: AdminRole }) {
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => get<Record<string, number>>('/admin/dashboard/summary') })
  const system = useQuery({ queryKey: ['health'], queryFn: () => get<Record<string, string>>('/admin/dashboard/system-health') })
  const sales = useQuery({ queryKey: ['dashboard-sales'], queryFn: () => get<Resource[]>('/admin/dashboard/sales') })
  const canReadWaitlist = (['SUPER_ADMIN', 'ORDER_MANAGER', 'SUPPORT_AGENT', 'ANALYST'] as AdminRole[]).includes(role)
  const waitlist = useQuery({ queryKey: ['dashboard-waitlist'], queryFn: () => get<Resource[]>('/admin/waitlist-reservations?limit=5'), enabled: canReadWaitlist })
  const waitlistProgress = useQuery({ queryKey: ['dashboard-waitlist-progress'], queryFn: () => get<Resource>('/admin/waitlist/conversion-progress'), enabled: canReadWaitlist })
  const canReadAffiliatePayouts = role === 'SUPER_ADMIN'
  const affiliateRedemptions = useQuery({ queryKey: ['dashboard-affiliate-redemptions'], queryFn: () => get<Resource[]>('/admin/affiliate-redemptions'), enabled: canReadAffiliatePayouts })
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const dateLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())
  const summary = query.data
  const money = (value: unknown) => `₹${(Number(value ?? 0) / 100).toLocaleString('en-IN')}`
  const count = (value: unknown) => Number(value ?? 0).toLocaleString('en-IN')
  const statusLabel = (value: unknown) => String(value ?? 'unknown').replaceAll('_', ' ')
  const statusCount = (statuses: string[]) => sales.data?.filter((row) => statuses.includes(String(row.status))).reduce((total, row) => total + Number(row._count ?? 0), 0) ?? 0
  const waitlistCustomer = (row: Resource) => {
    const customer = row.customer as Resource | undefined
    return String(customer?.fullName ?? customer?.email ?? 'Customer')
  }
  const waitlistProducts = (row: Resource) => {
    if (typeof row.products === 'string' && row.products.trim()) return row.products
    if (Array.isArray(row.items)) return row.items.map((item: Resource) => `${String(item.productName ?? 'Product')} × ${String(item.quantity ?? 1)}`).join(', ')
    return 'Product details unavailable'
  }
  const salesRows = sales.data ?? []
  const totalSalesOrders = salesRows.reduce((total, row) => total + Number(row._count ?? 0), 0)
  const health = system.data ?? { database: 'loading', queue: 'loading', storage: 'loading' }
  const awaitingFulfilment = statusCount(['confirmed', 'processing', 'packed'])
  const awaitingPayment = statusCount(['pending_payment', 'payment_failed'])
  const paidWaitlist = Number(waitlistProgress.data?.joined ?? 0)
  const affiliatePayoutDuePaise = affiliateRedemptions.data?.filter((row) => String(row.status) === 'requested').reduce((total, row) => total + Number(row.amountPaise ?? 0), 0) ?? 0
  const isRefreshing = query.isFetching || system.isFetching || sales.isFetching || waitlist.isFetching || waitlistProgress.isFetching || affiliateRedemptions.isFetching
  const refreshDashboard = async () => {
    const requests: Promise<unknown>[] = [query.refetch(), system.refetch(), sales.refetch()]
    if (canReadWaitlist) requests.push(waitlist.refetch(), waitlistProgress.refetch())
    if (canReadAffiliatePayouts) requests.push(affiliateRedemptions.refetch())
    await Promise.all(requests)
    setLastUpdated(new Date())
  }
  useEffect(() => { if (query.data && !lastUpdated) setLastUpdated(new Date()) }, [lastUpdated, query.data])
  const metricCards = [
    { label: 'Confirmed order value', value: money(summary?.revenuePaise), note: 'Orders in fulfilment lifecycle', icon: BarChart3 },
    { label: 'Awaiting fulfilment', value: sales.isLoading ? '…' : count(awaitingFulfilment), note: 'Confirmed, processing or packed', icon: ShoppingBag },
    { label: 'Awaiting payment', value: sales.isLoading ? '…' : count(awaitingPayment), note: 'Pending or failed payments', icon: CircleAlert },
    { label: 'Published products', value: count(summary?.products), note: 'Live in the catalogue', icon: Package },
    { label: 'Paid waitlist', value: canReadWaitlist ? (waitlistProgress.isLoading ? '…' : count(paidWaitlist)) : '—', note: canReadWaitlist ? 'Reservation fees captured' : 'Access restricted', icon: ClipboardList },
    { label: 'Affiliate payouts due', value: canReadAffiliatePayouts ? money(affiliatePayoutDuePaise) : '—', note: canReadAffiliatePayouts ? 'Requested redemptions' : 'Super admin access required', icon: HandCoins },
  ] as const
  const attentionItems = sales.isError ? [{ label: 'Order status data unavailable', note: 'Open Orders to review the current lifecycle directly.', value: 'Review', target: 'orders', icon: CircleAlert, urgent: true }] : [
    { label: 'Orders awaiting payment', note: awaitingPayment ? 'Pending or failed payments need review.' : 'No payment exceptions are currently reported.', value: sales.isLoading ? 'Checking…' : count(awaitingPayment), target: 'orders', icon: CircleAlert, urgent: awaitingPayment > 0 },
    { label: 'Orders awaiting fulfilment', note: awaitingFulfilment ? 'Confirmed, processing and packed orders are in the queue.' : 'No fulfilment queue is currently reported.', value: sales.isLoading ? 'Checking…' : count(awaitingFulfilment), target: 'orders', icon: ShoppingBag, urgent: awaitingFulfilment > 0 },
    ...(canReadWaitlist ? [{ label: 'Waitlist addresses required', note: Number(waitlistProgress.data?.addressRequired ?? 0) ? 'Converted reservations still need delivery details.' : 'No converted reservation is waiting for an address.', value: waitlistProgress.isLoading ? 'Checking…' : count(waitlistProgress.data?.addressRequired), target: 'waitlist', icon: ClipboardList, urgent: Number(waitlistProgress.data?.addressRequired ?? 0) > 0 }] : []),
    { label: 'Launch interest leads', note: 'Review new demand and follow up from Leads.', value: count(summary?.launchInterests), target: 'leads', icon: Sparkles, urgent: false },
  ] as const

  if (query.isLoading) return <><div className="dashboard-intro-skeleton"><div className="skeleton" /><div className="skeleton" /></div><SkeletonCards /></>
  if (query.isError) return <div className="dashboard-overview"><div className="dashboard-hero"><div><span className="kicker">Today at SkinFox</span><h2>Dashboard unavailable.</h2><p className="muted">We couldn’t load the operational summary. Retry to reconnect to the admin API.</p></div><button className="secondary-button" onClick={() => void query.refetch()}><Activity size={15} />Retry</button></div><ErrorPanel onRetry={() => void query.refetch()} /></div>

  return <div className="dashboard-overview">
    <div className="dashboard-hero">
      <div>
        <span className="kicker">Today at SkinFox</span>
        <h2>Good morning, SkinFox.</h2>
        <p className="muted">{dateLabel} · A clear view of commerce, customers and launch readiness.</p>
      </div>
      <div className="page-actions"><button className="secondary-button" onClick={() => void refreshDashboard()} disabled={isRefreshing}><Activity size={15} />{isRefreshing ? 'Refreshing…' : 'Refresh'} </button><button className="secondary-button" onClick={() => window.open(storefrontUrl(), '_blank')}>View storefront <ChevronRight size={16} /></button><button className="primary-button" onClick={() => { window.location.hash = 'orders' }}>Review orders <ArrowLeft size={15} /></button><small className="dashboard-last-updated">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Live operational data'}</small></div>
    </div>

    <section className="dashboard-kpis" aria-label="Store performance">
      {metricCards.map(({ label, value, note, icon: Icon }, index) => <article className={`dashboard-kpi ${index === metricCards.length - 1 ? 'dashboard-kpi--accent' : ''}`} key={label}><div className="dashboard-kpi__top"><span>{label}</span><Icon size={17} /></div><strong>{value}</strong><small>{note}</small></article>)}
    </section>

    <div className="dashboard-layout">
      <section className="panel dashboard-panel dashboard-panel--activity">
        <div className="panel-heading"><div><span className="kicker">Operations pulse</span><h3>What needs attention</h3><p className="panel-subtitle">The signals that help you decide what to do next.</p></div><span className="panel-icon"><Gauge size={18} /></span></div>
        <div className="dashboard-activity-list">
          {attentionItems.map(({ label, note, value, target, icon: Icon, urgent }) => <button type="button" className={`dashboard-activity-row ${urgent ? 'dashboard-activity-row--attention' : ''}`} key={label} onClick={() => { window.location.hash = target }}><span className={`status-dot ${urgent ? 'status-dot--warning' : 'status-dot--good'}`}><Icon size={11} /></span><span><strong>{label}<em>{value}</em></strong><small>{note}</small></span><ChevronRight size={16} /></button>)}
        </div>
        <div className="dashboard-panel-footer"><span>{totalSalesOrders ? `${count(totalSalesOrders)} orders grouped by status` : 'Order status data is being prepared'}</span><button className="text-button" onClick={() => { window.location.hash = 'analytics' }}>Open analytics <ChevronRight size={14} /></button></div>
      </section>

      <div className="dashboard-stack">
        <section className="panel dashboard-panel dashboard-panel--waitlist">
          <div className="panel-heading"><div><span className="kicker">Priority waitlist</span><h3>Recent reservations</h3><p className="panel-subtitle">The latest members and their selected products.</p></div><button className="icon-button" onClick={() => { window.location.hash = 'waitlist' }} aria-label="Open priority waitlist"><ChevronRight size={18} /></button></div>
          {!canReadWaitlist ? <p className="muted dashboard-empty-copy">Your role does not include waitlist visibility.</p> : waitlist.isLoading ? <div className="dashboard-list-skeleton"><span /><span /><span /></div> : waitlist.isError ? <p className="muted dashboard-empty-copy">Waitlist data is unavailable right now.</p> : waitlist.data?.length ? <div className="priority-list">{waitlist.data.slice(0, 5).map((row, index) => <button className="priority-row" key={row.id} onClick={() => { window.location.hash = 'waitlist' }}><span className={`priority-rank ${index < 3 ? 'priority-rank--dark' : ''}`}>{index + 1}</span><span className="priority-row__body"><strong>{waitlistCustomer(row)}</strong><small>{waitlistProducts(row)}</small></span><span className="priority-row__value">{row.status ? statusLabel(row.status) : 'Joined'}</span></button>)}</div> : <div className="dashboard-empty-state"><ClipboardList size={20} /><strong>No reservations yet</strong><small>New waitlist members will appear here.</small></div>}
          <div className="dashboard-panel-footer"><span>{waitlist.data?.length ? `${count(waitlist.data.length)} recent records` : 'Live from the waitlist'}</span><button className="text-button" onClick={() => { window.location.hash = 'waitlist' }}>Manage waitlist <ChevronRight size={14} /></button></div>
        </section>

        <section className="panel panel--navy dashboard-panel dashboard-panel--health">
          <div className="panel-heading"><div><span className="kicker kicker--light">System health</span><h3>Configured services</h3></div><Activity size={18} /></div>
          <div className="health-list">{Object.entries(health).map(([label, value]) => <div key={label}><span>{label}</span><strong>{String(value)}</strong></div>)}</div>
          <p className="panel-note">Operational integrations stay server-side and are checked before customer actions are enabled.</p>
        </section>
      </div>
    </div>

    <section className="panel dashboard-panel dashboard-panel--sales">
      <div className="panel-heading"><div><span className="kicker">Order health</span><h3>Orders by status</h3><p className="panel-subtitle">A compact view of where today’s orders sit in the lifecycle.</p></div><button className="secondary-button" onClick={() => { window.location.hash = 'orders' }}>View fulfilment <ChevronRight size={15} /></button></div>
      {sales.isLoading ? <div className="dashboard-list-skeleton dashboard-list-skeleton--wide"><span /><span /><span /></div> : sales.isError || !salesRows.length ? <p className="muted dashboard-empty-copy">No order status breakdown is available yet.</p> : <div className="sales-status-grid">{salesRows.map((row) => <div className="sales-status-card" key={String(row.status)}><span>{statusLabel(row.status)}</span><strong>{count(row._count)}</strong><small>{money((row._sum as Resource | undefined)?.totalPaise)} value</small></div>)}</div>}
    </section>
  </div>
}

function formatPaise(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? `₹${(amount / 100).toLocaleString('en-IN')}` : 'Not set'
}

function statusClassForOrder(value: unknown) {
  return 'orders-badge orders-badge--' + String(value ?? 'unknown').replaceAll('_', '-')
}

function productAssetUrl(path: string) {
  return path
}

function WaitlistManagement({ canManage, canReset }: { canManage: boolean; canReset: boolean }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useTableSearch()
  const [status, setStatus] = useState('all')
  const [enabled, setEnabled] = useState(true)
  const [depositRupees, setDepositRupees] = useState('99')
  const [discountPercent, setDiscountPercent] = useState('25')
  const [termsVersion, setTermsVersion] = useState('2026-09-10')
  const [stage, setStage] = useState<WaitlistSettings['stage']>('waitlist')
  const [founderCapacity, setFounderCapacity] = useState('200')
  const deferredSearch = useDeferredValue(search)
  const settings = useQuery({ queryKey: ['waitlist-settings'], queryFn: () => get<WaitlistSettings>('/admin/waitlist-settings') })
  const summaryReservations = useQuery({ queryKey: ['waitlist-reservations-summary'], queryFn: () => get<Resource[]>('/admin/waitlist-reservations?limit=100') })
  const reservationPath = withSearch(`/admin/waitlist-reservations?limit=100${status === 'all' ? '' : `&status=${encodeURIComponent(status)}`}`, deferredSearch)
  const reservations = useQuery({ queryKey: ['waitlist-reservations', status, deferredSearch], queryFn: () => get<Resource[]>(reservationPath) })
  const conversionPreview = useQuery({ queryKey: ['waitlist-conversion-preview'], queryFn: () => get<Resource>('/admin/waitlist/conversion-preview') })
  const conversionProgress = useQuery({ queryKey: ['waitlist-conversion-progress'], queryFn: () => get<Resource>('/admin/waitlist/conversion-progress') })
  const conversion = useMutation({ mutationFn: () => api<Resource>('/admin/waitlist/reveal', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ confirm: true, deadlineDays: 30 }) }), onSuccess: async () => { await Promise.all([conversionPreview.refetch(), conversionProgress.refetch(), reservations.refetch(), summaryReservations.refetch(), settings.refetch()]); await queryClient.invalidateQueries({ queryKey: ['orders'] }) } })
  const reset = useMutation({ mutationFn: () => api<Resource>('/admin/waitlist/reset', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ confirmation: 'RESET WAITLIST' }) }), onSuccess: async () => { await Promise.all([conversionPreview.refetch(), conversionProgress.refetch(), reservations.refetch(), summaryReservations.refetch(), settings.refetch()]); await queryClient.invalidateQueries({ queryKey: ['dashboard'] }); await queryClient.invalidateQueries({ queryKey: ['orders'] }) } })

  useEffect(() => {
    if (!settings.data) return
    setEnabled(settings.data.enabled)
    setDepositRupees(String(settings.data.depositPaise / 100))
    setDiscountPercent(String(settings.data.discountPercent))
    setTermsVersion(settings.data.termsVersion)
    setStage(settings.data.stage)
    setFounderCapacity(String(settings.data.founderCapacity))
  }, [settings.data])

  // Preserve the existing public launch tiers for the conversion flow while
  // keeping the operator-facing setup focused on the three waitlist controls.
  // New reservations use a discount calculated from each product's own MRP.
  const preservedPrices = {
    founderPricePaise: Number(settings.data?.founderPricePaise ?? 59_900),
    launchPricePaise: Number(settings.data?.launchPricePaise ?? 64_900),
    regularPricePaise: Number(settings.data?.regularPricePaise ?? 70_000),
  }
  const pricingMode: WaitlistSettings['pricingMode'] = 'discount_off_mrp'

  const save = useMutation({
    mutationFn: () => patch<WaitlistSettings>('/admin/waitlist-settings', {
      enabled,
      depositPaise: Math.round(Number(depositRupees) * 100),
      discountPercent: Number(discountPercent),
      termsVersion: termsVersion.trim(),
      stage,
      founderCapacity: Number(founderCapacity),
      ...preservedPrices,
      pricingMode,
    }),
    onSuccess: async (next) => {
      queryClient.setQueryData(['waitlist-settings'], next)
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const rows = (reservations.data ?? []).map((row) => {
    const customer = row.customer as Record<string, unknown> | undefined
    return { ...row, id: String(row.publicToken), customer: customer ? `${String(customer.fullName ?? 'Customer')} · ${String(customer.email ?? '')}` : 'Customer' }
  })
  const joined = (summaryReservations.data ?? []).filter((row) => row.status === 'joined').length
  const captured = (summaryReservations.data ?? []).reduce((sum, row) => sum + Number(row.paymentCapturedPaise ?? 0), 0)
  const refundPending = (summaryReservations.data ?? []).filter((row) => row.status === 'refund_pending').length
  const priceLadderValid = preservedPrices.founderPricePaise > 0 && preservedPrices.founderPricePaise <= preservedPrices.launchPricePaise && preservedPrices.launchPricePaise <= preservedPrices.regularPricePaise
  const invalid = !Number.isFinite(Number(depositRupees)) || Number(depositRupees) < 1 || Number(depositRupees) > 100000 || !Number.isInteger(Number(discountPercent)) || Number(discountPercent) < 1 || Number(discountPercent) > 90 || !Number.isInteger(Number(founderCapacity)) || Number(founderCapacity) < 1 || !priceLadderValid || !termsVersion.trim()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (invalid || save.isPending) return
    if (settings.data?.enabled && !enabled && !window.confirm('Close the priority waitlist and reveal product prices? Existing reservation records will remain available.')) return
    save.mutate()
  }

  if (settings.isError || reservations.isError || summaryReservations.isError) return <ErrorPanel onRetry={() => { void settings.refetch(); void reservations.refetch(); void summaryReservations.refetch() }} />
  return <>
    <div className="page-intro"><div><span className="kicker">Launch access / Razorpay</span><h2>Priority waitlist</h2><p className="muted">Control the live customer experience and find support cases by waitlist ID, customer, phone or email.</p></div><button className="secondary-button" onClick={() => { void settings.refetch(); void reservations.refetch(); void summaryReservations.refetch() }}>Refresh <Activity size={16} /></button></div>
    <div className="metric-grid waitlist-metrics">
      <article className="metric-card"><span>Waitlist status</span><strong className={settings.data?.enabled ? 'metric-status--live' : 'metric-status--closed'}>{settings.data?.enabled ? 'Open' : 'Closed'}</strong><small>{settings.data?.enabled ? 'Prices hidden · deposits enabled' : 'Prices visible · checkout enabled'}</small></article>
      <article className="metric-card"><span>Priority places</span><strong>{settings.data?.founderClaimed ?? joined} / {settings.data?.founderCapacity ?? 200}</strong><small>{settings.data?.founderRemaining ?? 0} places remaining</small></article>
      <article className="metric-card"><span>Deposits captured</span><strong>₹{(captured / 100).toLocaleString('en-IN')}</strong><small>Before completed refunds</small></article>
      <article className="metric-card"><span>Refunds pending</span><strong>{refundPending}</strong><small>Awaiting provider confirmation</small></article>
    </div>
    <div className="waitlist-admin-grid">
      <form className="panel waitlist-control-panel" onSubmit={submit}>
        <div className="panel-heading"><div><span className="kicker">Pre-activation setup</span><h3>Waitlist controls</h3></div><span className={`configuration-state ${enabled ? 'is-live' : ''}`}>{enabled ? 'Open' : 'Closed'}</span></div>
        {settings.isLoading ? <TableSkeleton /> : <>
          <p className="waitlist-control-intro">Set the three values used for every new reservation. Each selected product uses its own MRP when the launch discount is applied.</p>
          <label className="waitlist-toggle"><span><strong>Accept new waitlist reservations</strong><small>Turn this off when you are ready to stop accepting new reservations.</small></span><input type="checkbox" checked={enabled} onChange={(event) => { const next = event.target.checked; setEnabled(next); setStage(next ? 'waitlist' : 'launch') }} disabled={!canManage} /><i aria-hidden="true" /></label>
          <div className="form-grid waitlist-fields">
            <label>Waitlist capacity<input type="number" min="1" max="10000" step="1" value={founderCapacity} onChange={(event) => setFounderCapacity(event.target.value)} disabled={!canManage} required /><small>Reservations close automatically when this many members join.</small></label>
            <label>Reservation fee per product (₹)<input type="number" min="1" max="100000" step="1" value={depositRupees} onChange={(event) => setDepositRupees(event.target.value)} disabled={!canManage} required /><small>Non-refundable fee multiplied by the total product quantity in each new reservation.</small></label>
            <label>Launch discount from MRP (%)<input type="number" min="1" max="90" step="1" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} disabled={!canManage} required /><small>Example: 70% off ₹700 = ₹210. Applied separately to every product in the customer's reservation.</small></label>
          </div>
          <div className="waitlist-setting-note"><Sparkles size={17} /><span><strong>Per-product pricing</strong><small>The discount is calculated from each product's MRP when reservations become orders. Existing reservations keep the pricing snapshot they were created with.</small></span></div>
          <div className={`payment-readiness ${settings.data?.paymentConfigured ? 'is-ready' : 'is-blocked'}`}><LockKeyhole size={17} /><span><strong>{settings.data?.paymentConfigured ? 'Razorpay is ready' : 'Razorpay is not configured'}</strong><small>{settings.data?.paymentConfigured ? 'Payment credentials remain encrypted on the server.' : 'Keep the waitlist closed until server credentials are configured.'}</small></span></div>
          {!canManage && <div className="alert"><LockKeyhole size={16} />Your role has read-only waitlist access.</div>}
          {save.isError && <div className="alert alert--error" role="alert"><CircleAlert size={16} />{save.error instanceof Error ? save.error.message : 'Unable to save waitlist settings.'}</div>}
          {save.isSuccess && <div className="alert alert--success" role="status"><Check size={16} />Waitlist settings are live on the storefront.</div>}
          {canManage && <button className="primary-button waitlist-save" type="submit" disabled={invalid || save.isPending}>{save.isPending ? 'Publishing…' : 'Publish waitlist settings'} <Check size={16} /></button>}
        </>}
      </form>
      <section className="panel waitlist-policy"><span className="kicker">Reservation policy</span><h3>How updates behave</h3><div className="attention-row"><span className="status-dot status-dot--good"><Check size={11} /></span><span><strong>Existing reservations never change</strong><small>The recorded fee, pricing rule and accepted terms remain attached to that customer.</small></span></div><div className="attention-row"><span className="status-dot status-dot--good"><Check size={11} /></span><span><strong>Reservation fees are final</strong><small>New waitlist payments are non-refundable except where a remedy is required by applicable law.</small></span></div><div className="attention-row"><span className="status-dot status-dot--good"><Check size={11} /></span><span><strong>Every settings change is audited</strong><small>The acting administrator, previous values and new values are recorded server-side.</small></span></div></section>
    </div>
    <section className="panel waitlist-conversion-panel"><div className="panel-heading"><div><span className="kicker">After pricing is ready</span><h3>Reveal prices & prepare customer orders</h3></div><Sparkles size={19} /></div><p className="muted">This creates one immutable order for each captured, joined reservation. The reservation payment is recorded as credit; customers pay only the remaining balance after adding a serviceable address.</p>{conversionPreview.isLoading ? <p className="fine-print">Calculating conversion preview…</p> : conversionPreview.isError ? <div className="alert alert--error">Unable to load the conversion preview.</div> : <div className="conversion-summary"><span><strong>{String(conversionPreview.data?.eligibleReservations ?? 0)}</strong><small>eligible reservations</small></span><span><strong>{String(conversionProgress.data?.converted ?? 0)}</strong><small>orders prepared</small></span><span><strong>{String(conversionProgress.data?.addressRequired ?? 0)}</strong><small>address required</small></span><span><strong>{String(conversionProgress.data?.paymentDue ?? 0)}</strong><small>payment due</small></span><span><strong>{String(conversionProgress.data?.paymentConfirmationPending ?? 0)}</strong><small>confirmation pending</small></span><span><strong>₹{(Number(conversionPreview.data?.depositsCollectedPaise ?? 0) / 100).toLocaleString('en-IN')}</strong><small>captured credit</small></span><span><strong>₹{(Number(conversionProgress.data?.remainingBalancePaise ?? conversionPreview.data?.estimatedRemainingPaise ?? 0) / 100).toLocaleString('en-IN')}</strong><small>remaining balance</small></span><span><strong>{String(conversionProgress.data?.fullyPaid ?? 0)}</strong><small>fully paid</small></span><span><strong>{String(conversionProgress.data?.expired ?? 0)}</strong><small>expired</small></span><span><strong>{String(conversionPreview.data?.blockedReservations ?? 0)}</strong><small>conversion failures</small></span></div>}{Array.isArray(conversionPreview.data?.inventoryShortages) && conversionPreview.data.inventoryShortages.length > 0 && <div className="alert alert--error">Reveal is blocked until inventory covers the paid demand.</div>}{Number(conversionPreview.data?.blockedReservations ?? 0) > 0 && <div className="alert alert--error">{String(conversionPreview.data?.blockedReservations)} reservation(s) need pricing or product resolution before reveal.</div>}{conversion.isError && <div className="alert alert--error">{conversion.error instanceof Error ? conversion.error.message : 'Unable to convert the waitlist.'}</div>}{conversion.isSuccess && <div className="alert alert--success" role="status">{String(conversion.data?.converted ?? 0)} customer order(s) prepared. Customers can now add an address and pay any remaining balance.</div>}{canManage ? <button className="primary-button" type="button" onClick={() => { if (window.confirm('Reveal the saved waitlist pricing and prepare orders for every captured reservation? This cannot be undone.')) conversion.mutate() }} disabled={conversion.isPending || conversionPreview.isLoading || Number(conversionPreview.data?.blockedReservations ?? 0) > 0 || (Array.isArray(conversionPreview.data?.inventoryShortages) && conversionPreview.data.inventoryShortages.length > 0)}>{conversion.isPending ? 'Preparing orders…' : 'Reveal & prepare orders'} <ChevronRight size={16} /></button> : <div className="alert"><LockKeyhole size={16} />Read-only progress view. Only Super Admin and Order Manager can reveal pricing or prepare orders.</div>}</section>
    <section className="panel waitlist-reset-panel" aria-labelledby="waitlist-reset-title"><div className="panel-heading"><div><span className="kicker">Danger zone</span><h3 id="waitlist-reset-title">Reset waitlist data</h3></div><CircleAlert size={19} /></div><p className="muted">Permanently removes waitlist reservations and IDs, converted waitlist orders, linked payment records, and waitlist inventory holds. Customer accounts, products, normal storefront orders, settings, and audit history stay intact. This does not issue refunds or cancel external payment or shipping-provider activity.</p>{reset.isError && <div className="alert alert--error" role="alert">{reset.error instanceof Error ? reset.error.message : 'Unable to reset the waitlist.'}</div>}{reset.isSuccess && <div className="alert alert--success" role="status">Waitlist data was reset. Existing customer accounts were preserved and the waitlist counter is ready to start again.</div>}{canReset ? <button className="danger-button" type="button" onClick={() => { const confirmation = window.prompt('This permanently deletes waitlist reservations, IDs, converted waitlist orders and linked local records. Type RESET WAITLIST to continue.'); if (confirmation === 'RESET WAITLIST') reset.mutate() }} disabled={reset.isPending}>{reset.isPending ? 'Resetting waitlist…' : 'Reset all waitlist data'}</button> : <div className="alert"><LockKeyhole size={16} />Only Super Admin can reset waitlist data.</div>}</section>
    <div className="waitlist-table-heading"><div><span className="kicker">Customer reservations</span><h3>Waitlist activity</h3></div><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{['payment_pending', 'joined', 'payment_failed', 'cancelled', 'refund_pending', 'refunded', 'converted'].map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label></div>
    {reservations.isLoading ? <TableSkeleton /> : <DataTable rows={rows} fields={['waitlistId', 'founderNumber', 'customer', 'products', 'status', 'depositPaise', 'refundStatus', 'createdAt']} searchValue={search} onSearch={setSearch} />}
  </>
}

function Products() {
  const [editor, setEditor] = useState<string | 'new' | null>(null)
  const [search, setSearch] = useState('')
  const [periodDays, setPeriodDays] = useState(30)
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [inventory, setInventory] = useState('all')
  const [performance, setPerformance] = useState('all')
  const [sort, setSort] = useState('updated')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const deferredSearch = useDeferredValue(search)
  const pageSize = 24
  useEffect(() => { setPage(1) }, [deferredSearch, periodDays, category, status, inventory, performance, sort, direction])
  const params = new URLSearchParams({ page: String(page), limit: String(pageSize), periodDays: String(periodDays), sort, direction })
  if (deferredSearch.trim()) params.set('q', deferredSearch.trim())
  if (category !== 'all') params.set('category', category)
  if (status !== 'all') params.set('status', status)
  if (inventory !== 'all') params.set('inventory', inventory)
  if (performance !== 'all') params.set('performance', performance)
  const query = useQuery({ queryKey: ['products', params.toString()], queryFn: () => getWithMeta<AdminProduct[]>('/admin/products?' + params.toString()) })
  if (editor) return <ProductEditor id={editor === 'new' ? undefined : editor} onBack={() => setEditor(null)} />
  const products = query.data?.data ?? []
  const categories = Array.isArray(query.data?.meta?.categories) ? query.data.meta.categories as string[] : []
  const total = query.data?.meta?.total ?? products.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasFilters = Boolean(deferredSearch.trim() || category !== 'all' || status !== 'all' || inventory !== 'all' || performance !== 'all')
  const clearFilters = () => { setSearch(''); setCategory('all'); setStatus('all'); setInventory('all'); setPerformance('all'); setPage(1) }
  const statusLabel = (value: unknown) => String(value ?? 'draft').replaceAll('_', ' ')
  const stockClass = (value: unknown) => 'product-table-badge product-table-badge--' + String(value ?? 'untracked')
  const performanceClass = (value: unknown) => 'product-table-badge product-table-badge--' + String(value ?? 'unavailable')
  const formatUpdated = (value: unknown) => {
    const date = new Date(String(value ?? ''))
    return Number.isNaN(date.valueOf()) ? 'Unavailable' : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
  }
  return <div className="products-workspace">
    <div className="page-intro"><div><span className="kicker">SkinFox catalogue</span><h2>Products</h2><p className="muted">A live view of catalogue status, stock health and customer demand.</p></div><div className="page-actions"><button className="secondary-button" onClick={() => void query.refetch()} disabled={query.isFetching}><Activity size={16} />{query.isFetching ? 'Refreshing…' : 'Refresh'}</button><button className="primary-button" onClick={() => setEditor('new')}><Plus size={17} /> New product</button></div></div>
    <section className="panel products-table-panel">
      <div className="products-toolbar">
        <label className="products-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search products</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by product or SKU" aria-label="Search by product name or SKU" /></label>
        <div className="products-filter-group">
          <label>Sales window<select value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label>
          <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option value={item.toLowerCase()} key={item}>{item}</option>)}</select></label>
          <label>Publication<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All publication</option><option value="published">Live</option><option value="draft">Draft</option><option value="in_review">In review</option><option value="approved">Approved</option><option value="scheduled">Scheduled</option><option value="archived">Archived</option></select></label>
          <label>Inventory<select value={inventory} onChange={(event) => setInventory(event.target.value)}><option value="all">All stock</option><option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option><option value="untracked">Not tracked</option></select></label>
          <label>Performance<select value={performance} onChange={(event) => setPerformance(event.target.value)}><option value="all">All performance</option><option value="new">New</option><option value="selling">Selling</option><option value="slow">Slow-moving</option><option value="no_sales">No sales</option></select></label>
          <label>Sort<select value={sort + ':' + direction} onChange={(event) => { const [nextSort, nextDirection] = event.target.value.split(':'); setSort(nextSort); setDirection(nextDirection as 'asc' | 'desc') }}><option value="updated:desc">Updated (newest)</option><option value="updated:asc">Updated (oldest)</option><option value="name:asc">Product name (A–Z)</option><option value="name:desc">Product name (Z–A)</option><option value="stock:desc">Sellable stock (high to low)</option><option value="stock:asc">Sellable stock (low to high)</option><option value="unitsSold:desc">Units sold (high to low)</option><option value="unitsSold:asc">Units sold (low to high)</option></select></label>
          {hasFilters && <button type="button" className="text-button products-clear-filter" onClick={clearFilters}>Clear filters</button>}
        </div>
      </div>
      <div className="products-table-heading"><div><span className="kicker">Catalogue operations</span><h3>{total.toLocaleString('en-IN')} products</h3></div><span className="products-table-note">Sales metrics cover the selected {periodDays}-day window. Repeat orders use all eligible purchase history.</span></div>
      {query.isLoading ? <TableSkeleton /> : query.isError ? <ErrorPanel onRetry={() => void query.refetch()} /> : products.length === 0 ? <div className="dashboard-empty-state products-empty"><Package size={24} /><strong>{hasFilters ? 'No products match these filters.' : 'No products yet.'}</strong><small>{hasFilters ? 'Clear a filter to see the full catalogue.' : 'Create a product to begin building the catalogue.'}</small>{hasFilters && <button type="button" className="secondary-button" onClick={clearFilters}>Clear filters</button>}</div> : <div className="table-wrap products-table-wrap"><table className="products-table"><thead><tr><th scope="col">Product</th><th scope="col">Category</th><th scope="col">Stock</th><th scope="col">Publication</th><th scope="col">Performance</th><th scope="col">Repeat orders</th><th scope="col">Updated</th><th scope="col" aria-label="Actions" /></tr></thead><tbody>{products.map((product) => {
        const metrics = product.productMetrics
        const visual = fixedCatalogBySlug.get(String(product.slug))
        const assetPath = visual?.image ?? String(product.image ?? '')
        const assetAlt = visual?.alt ?? String(product.imageAlt ?? String(product.name ?? 'SkinFox product') + ' product image')
        const stockState = metrics?.stockState ?? 'untracked'
        const performanceState = metrics?.performance ?? 'unavailable'
        const updatedValue = String(product.updatedAt ?? product.createdAt ?? '')
        return <tr key={product.id}>
          <td className="products-table__product" data-label="Product"><button type="button" className="product-table-identity" onClick={() => setEditor(product.id)}><span className="product-table-thumb">{assetPath ? <img src={productAssetUrl(assetPath)} alt={assetAlt} loading="lazy" /> : <ImageIcon aria-hidden="true" />}</span><span className="product-table-identity__copy"><strong>{String(product.name ?? 'Product')}</strong><small>{String(product.size ?? 'Size not set')}{metrics?.sku ? ' · ' + metrics.sku : ''}</small></span></button></td>
          <td data-label="Category"><span className="product-table-category">{String(product.category ?? product.categoryRef?.name ?? 'Uncategorised')}</span>{metrics?.variantCount && metrics.variantCount > 1 ? <small className="product-table-secondary">{metrics.variantCount} variants</small> : null}</td>
          <td data-label="Stock"><div className="product-table-stock"><strong>{metrics?.inventoryTracked ? metrics.sellableQty.toLocaleString('en-IN') : '—'}</strong><small>{metrics?.inventoryTracked ? 'Sellable · ' + metrics.onHandQty.toLocaleString('en-IN') + ' on hand' : 'Inventory not tracked'}</small>{metrics?.inventoryTracked && <small>{metrics.reservedQty.toLocaleString('en-IN')} reserved</small>}</div><span className={stockClass(stockState)}>{metrics?.stockLabel ?? 'Not tracked'}</span></td>
          <td data-label="Publication"><span className={'product-table-badge product-table-badge--' + String(product.status ?? 'draft')} title={'Publication status: ' + statusLabel(product.status)}>{statusLabel(product.status)}</span><small className="product-table-secondary">{String(product.purchaseState ?? 'availability').replaceAll('_', ' ')}</small></td>
          <td data-label="Performance"><span className={performanceClass(performanceState)} title={metrics?.salesDataAvailable ? 'Based on eligible paid orders in the last ' + metrics.periodDays + ' days' : 'Sales data unavailable'}>{metrics?.performanceLabel ?? 'Unavailable'}</span><small className="product-table-secondary">{metrics?.salesDataAvailable ? metrics.unitsSold.toLocaleString('en-IN') + ' units · ' + metrics.orderCount.toLocaleString('en-IN') + ' orders' : 'Sales data unavailable'}</small></td>
          <td data-label="Repeat orders"><strong className="product-table-number">{metrics?.salesDataAvailable ? metrics.repeatOrders.toLocaleString('en-IN') : '—'}</strong><small className="product-table-secondary">Eligible repeat purchases</small></td>
          <td data-label="Updated"><time className="product-table-updated" dateTime={updatedValue} title={updatedValue ? new Date(updatedValue).toLocaleString('en-IN') : undefined}>{formatUpdated(updatedValue)}</time></td>
          <td data-label="Actions" className="products-table__actions"><button type="button" className="secondary-button" onClick={() => setEditor(product.id)}>Edit <ChevronRight size={15} /></button></td>
        </tr>
      })}</tbody></table></div>}
      {totalPages > 1 && <div className="products-pagination"><span>Page {page} of {totalPages}</span><div><button type="button" className="secondary-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || query.isFetching}>Previous</button><button type="button" className="secondary-button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || query.isFetching}>Next</button></div></div>}
    </section>
  </div>
}

function ProductEditor({ id, onBack }: { id?: string; onBack: () => void }) {
  const existing = useQuery({ queryKey: ['product', id], queryFn: () => get<Resource>(`/admin/products/${id}`), enabled: Boolean(id) })
  const [form, setForm] = useState<Record<string, string>>({ name: '', slug: '', subtitle: '', category: '', size: '', benefit: '', description: '', highlights: '', pricePaise: '', mrpPaise: '', purchaseState: 'coming_soon', status: 'draft', tint: '#f3e8ee', image: '', imageAlt: '', galleryAssets: '' })
  const [dirty, setDirty] = useState(false)
  const qc = useQueryClient()
  const leave = () => { if (dirty && !window.confirm('Discard unsaved product changes?')) return; onBack() }
  const setField = (field: string, value: string) => { setDirty(true); setForm((current) => ({ ...current, [field]: value, ...(!id && field === 'name' && !current.slug ? { slug: makeProductSlug(value) } : {}) })) }
  useEffect(() => {
    if (!existing.data) return
    const { media, ...fields } = existing.data
    const image = String(existing.data.image ?? '')
    const galleryAssets = Array.isArray(media) ? media.map((item) => String((item as Resource).src ?? '')).filter((path) => path && path !== image).join(', ') : ''
    setForm((current) => ({ ...current, ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value === null || value === undefined ? '' : String(value)])), galleryAssets }))
  }, [existing.data])
  useEffect(() => { const guard = (event: BeforeUnloadEvent) => { if (!dirty) return; event.preventDefault(); event.returnValue = '' }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard) }, [dirty])
  const priceInvalid = Boolean(form.mrpPaise && form.pricePaise && Number(form.mrpPaise) < Number(form.pricePaise))
  const visual = fixedCatalogBySlug.get(form.slug)
  const editableArtwork = !visual
  const galleryAssets = splitAssetPaths(form.galleryAssets)
  const assetInvalid = editableArtwork && (!isProductImageAssetPath(form.image) || galleryAssets.some((path) => !isProductImageAssetPath(path)) || form.imageAlt.trim().length < 12)
  const mutation = useMutation({ mutationFn: () => {
    if (priceInvalid) throw new Error('MRP must be the same as or higher than the offer price.')
    if (assetInvalid) throw new Error('Use a valid /products/... website asset path and descriptive image text.')
    if (form.purchaseState === 'available' && !form.pricePaise) throw new Error('Available products require an offer price.')
    const essentials = { name: form.name.trim(), subtitle: form.subtitle.trim(), category: form.category.trim(), size: form.size.trim(), benefit: form.benefit.trim(), description: form.description.trim(), highlights: form.highlights.split(',').map((item) => item.trim()).filter(Boolean), pricePaise: form.pricePaise ? Number(form.pricePaise) : null, mrpPaise: form.mrpPaise ? Number(form.mrpPaise) : null, purchaseState: form.purchaseState, status: form.status }
    const media = [form.image, ...galleryAssets]
      .filter((path, index, paths) => paths.indexOf(path) === index)
      .map((src, index) => ({ type: 'image', src, alt: index === 0 ? form.imageAlt.trim() : `${form.imageAlt.trim()} — gallery view ${index + 1}`, sortOrder: index, fitMode: 'contain', objectPosition: '50% 50%', imageScale: 1 }))
    if (id) return patch(`/admin/products/${id}`, { ...essentials, ...(editableArtwork ? { image: form.image, imageAlt: form.imageAlt.trim(), media } : {}) })
    return post('/admin/products', { ...essentials, slug: form.slug.trim(), type: 'product', packaging: 'standard pack', concern: form.category.trim(), concerns: [form.category.trim()], usage: 'Follow the directions on the final product label.', routineStep: 'Care', color: '#7c3f8e', accent: '#2a1730', tint: '#f3e8ee', image: form.image, imageAlt: form.imageAlt.trim(), imagePosition: '50% 50%', imageScale: 1, badge: form.category.trim(), media })
  }, onSuccess: () => { setDirty(false); void qc.invalidateQueries({ queryKey: ['products'] }); onBack() } })
  if (id && existing.isLoading) return <TableSkeleton />
  if (id && existing.isError) return <ErrorPanel onRetry={() => existing.refetch()} />
  const previewImage = visual?.image ?? form.image
  const previewAlt = visual?.alt ?? form.imageAlt
  const slugInvalid = !id && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)
  return <><div className="editor-top"><button className="back-button" onClick={leave}><ArrowLeft size={16} /> Products</button><div><span className="kicker">{id ? 'Edit product' : 'New product'}</span><h2>{form.name || 'Create product'}</h2></div><button className="primary-button" type="submit" form="product-editor-form" disabled={mutation.isPending || priceInvalid || assetInvalid || slugInvalid}><Check size={16} /> {mutation.isPending ? 'Saving…' : id ? 'Save changes' : 'Create product'}</button></div><div className="editor-grid"><form id="product-editor-form" className="panel editor-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}><fieldset><legend>Product details</legend><p className="fine-print">Keep customer-facing information clear and concise. Technical defaults are handled automatically.</p><div className="form-grid"><label>Product name<input value={form.name} onChange={(event) => setField('name', event.target.value)} required minLength={2} /></label>{!id && <label>URL slug<input value={form.slug} onChange={(event) => setField('slug', makeProductSlug(event.target.value))} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="product-name" /></label>}<label>Subtitle<input value={form.subtitle} onChange={(event) => setField('subtitle', event.target.value)} required minLength={2} /></label><label>Category<input value={form.category} onChange={(event) => setField('category', event.target.value)} required /></label><label>Pack size<input value={form.size} onChange={(event) => setField('size', event.target.value)} required /></label><label className="form-field--wide">Short product summary<input value={form.benefit} onChange={(event) => setField('benefit', event.target.value)} required minLength={2} /></label><label className="form-field--wide">Full description<textarea rows={5} value={form.description} onChange={(event) => setField('description', event.target.value)} required minLength={2} /></label><label className="form-field--wide">Highlights <span className="optional">separate with commas</span><textarea rows={3} value={form.highlights} onChange={(event) => setField('highlights', event.target.value)} /></label></div></fieldset>{editableArtwork && <fieldset><legend>Website assets</legend><p className="fine-print">First copy the files into <code>public/products</code>, then enter their website paths here. External URLs and uploads are not accepted.</p><div className="form-grid"><label className="form-field--wide">Primary image path<input value={form.image} onChange={(event) => setField('image', event.target.value.trim())} required placeholder="/products/product-name-primary.webp" /></label><label className="form-field--wide">Image description<input value={form.imageAlt} onChange={(event) => setField('imageAlt', event.target.value)} required minLength={12} placeholder="Describe the product and packaging" /></label><label className="form-field--wide">Additional gallery paths <span className="optional">optional, separate with commas</span><textarea rows={3} value={form.galleryAssets} onChange={(event) => setField('galleryAssets', event.target.value)} placeholder="/products/product-side.webp, /products/product-pack.webp" /></label></div>{assetInvalid && <p className="form-error" role="alert">Every image must use a valid <code>/products/filename.webp</code> website asset path, and the description must be at least 12 characters.</p>}</fieldset>}<fieldset><legend>Pricing & availability</legend><p className="fine-print">Enter rupee values. Offer price is what the customer pays; MRP cannot be lower than the offer price.</p><div className="form-grid"><label>MRP (₹)<input type="number" min="1" step="1" value={form.mrpPaise ? String(Number(form.mrpPaise) / 100) : ''} onChange={(event) => setField('mrpPaise', event.target.value === '' ? '' : String(Math.round(Number(event.target.value) * 100)))} placeholder="e.g. 700" /></label><label>Offer price (₹)<input type="number" min="1" step="1" value={form.pricePaise ? String(Number(form.pricePaise) / 100) : ''} onChange={(event) => setField('pricePaise', event.target.value === '' ? '' : String(Math.round(Number(event.target.value) * 100)))} placeholder="e.g. 599" /></label><label>Availability<select value={form.purchaseState} onChange={(event) => setField('purchaseState', event.target.value)}><option value="available">Available</option><option value="coming_soon">Coming soon</option><option value="out_of_stock">Out of stock</option><option value="discontinued">Discontinued</option></select></label><label>Storefront status<select value={form.status} onChange={(event) => setField('status', event.target.value)}><option value="draft">Draft</option><option value="in_review">In review</option><option value="approved">Approved</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="archived">Archived</option></select></label></div>{priceInvalid && <p className="form-error" role="alert">MRP must be the same as or higher than the offer price.</p>}</fieldset></form><aside className="panel preview-panel"><div className="fixed-visual-note">{visual ? <LockKeyhole size={15} /> : <ImageIcon size={15} />}<span><strong>{visual ? 'Approved product photography' : 'Website asset only'}</strong><small>{visual ? 'Locked for the original seven products' : 'Served from public/products'}</small></span></div><div className="product-preview" style={{ background: form.tint }}>{previewImage ? <img src={productAssetUrl(previewImage)} alt={previewAlt} /> : <ImageIcon aria-label="Add a website asset path to preview the product" />}</div><span className="kicker">Storefront preview</span><h3>{form.name || 'Product name'}</h3><p className="muted">{form.subtitle || 'Product subtitle'}</p><div className="preview-meta"><span>{form.size || 'Size'}</span><span>{form.purchaseState === 'available' && form.pricePaise ? `Offer ${formatPaise(form.pricePaise)}${form.mrpPaise && Number(form.mrpPaise) > Number(form.pricePaise) ? ` · MRP ${formatPaise(form.mrpPaise)}` : ''}` : 'Price on launch'}</span></div><p className="fine-print">No image is uploaded through Admin. Asset files are versioned and deployed with the website.</p></aside></div>{mutation.isError && <div className="alert alert--error" role="alert">{mutation.error instanceof Error ? mutation.error.message : 'Unable to save product.'}</div>}</>
}

function Inventory({ canManage }: { canManage: boolean }) {
  const [search, setSearch] = useTableSearch()
  const [location, setLocation] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('attention')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<InventoryRecord | null>(null)
  const [snapshot, setSnapshot] = useState<InventorySnapshot | null>(null)
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('Stock count adjustment')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [adjustError, setAdjustError] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const next = await loadInventory()
      setSnapshot(next)
      setLastUpdated(new Date().toISOString())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load inventory.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  const rows = snapshot?.rows ?? []
  const filtered = filterInventory(rows, search, location, status, sort)
  const pageSize = 25
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visibleRows = filtered.slice((page - 1) * pageSize, page * pageSize)
  useEffect(() => { setPage(1) }, [search, location, status, sort])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])
  const summary = inventorySummary(rows)
  const attention = rows.filter((row) => { const stock = stockFor(row); return stock.state !== 'in_stock' || stock.salesBlocked }).sort((a, b) => filterInventory([a, b], '', 'all', 'all', 'attention').indexOf(a) - filterInventory([a, b], '', 'all', 'all', 'attention').indexOf(b)).slice(0, 6)
  const locations = snapshot?.locations ?? []
  const selectedStock = selected ? stockFor(selected) : null
  const selectForAdjustment = (row: InventoryRecord) => { setSelected(row); setQuantity(''); setReason('Stock count adjustment'); setFeedback(''); setAdjustError('') }
  const applyAdjustment = async () => {
    if (!selected || !selected.locationId || !selectedStock?.tracked || !snapshot?.safeAdjustments) { setAdjustError('Safe stock adjustments are unavailable from the connected API. Refresh after the latest admin service is running.'); return }
    const amount = Number(quantity)
    if (!Number.isInteger(amount) || amount === 0 || reason.trim().length < 3) { setAdjustError('Enter a non-zero whole number and a reason with at least 3 characters.'); return }
    if (!window.confirm(`Apply ${amount > 0 ? '+' : ''}${amount} units to ${selected.variant.product.name}? On hand will change from ${selectedStock.onHand} to ${selectedStock.onHand! + amount}.`)) return
    setAdjusting(true); setAdjustError(''); setFeedback('')
    try {
      await api('/admin/inventory/adjustments', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ variantId: selected.variantId, locationId: selected.locationId, quantity: amount, reason: reason.trim(), expectedAvailableQty: selected.availableQty, expectedReservedQty: selected.reservedQty }) })
      setFeedback('Stock adjustment recorded. The ledger and activity feed are up to date.')
      setSelected(null); setQuantity(''); await refresh()
    } catch (cause) {
      setAdjustError(cause instanceof Error ? cause.message : 'Unable to update inventory.')
    } finally { setAdjusting(false) }
  }
  const clearFilters = () => { setSearch(''); setLocation('all'); setStatus('all'); setSort('attention') }
  const hasFilters = Boolean(search.trim() || location !== 'all' || status !== 'all')
  const summaryCards = [
    { icon: Boxes, label: 'Units on hand', value: numberLabel(summary.onHand), note: `${summary.skuCount} tracked SKUs` },
    { icon: LockKeyhole, label: 'Reserved', value: numberLabel(summary.reserved), note: 'Held for active orders' },
    { icon: Check, label: 'Available to sell', value: numberLabel(summary.free), note: 'On hand − reserved' },
    { icon: CircleAlert, label: 'Low-stock SKUs', value: numberLabel(summary.low), note: 'At or below threshold' },
    { icon: ShoppingBag, label: 'Out of stock', value: numberLabel(summary.out), note: 'No units available' },
    { icon: Truck, label: 'Locations', value: numberLabel(summary.locationCount), note: 'Tracked storage locations' },
  ]
  if (loading && !snapshot) return <><div className="inventory-hero"><div><span className="kicker">SkinFox operations</span><h2>Inventory &amp; stock health</h2><p className="muted">Loading the stock ledger…</p></div></div><TableSkeleton /></>
  return <div className="inventory-workspace">
    <div className="inventory-hero"><div><span className="kicker">SkinFox operations</span><h2>Inventory &amp; stock health</h2><p className="muted">{summary.skuCount} SKUs tracked across {summary.locationCount} locations · {lastUpdated ? `Updated ${dateLabel(lastUpdated)}` : 'Updated just now'}</p></div><div className="page-actions"><span className="inventory-source-pill"><span />{!snapshot?.safeAdjustments ? 'Read-only sync' : snapshot.complete ? 'Live ledger' : 'Partial ledger'}</span><button type="button" className="secondary-button" onClick={() => void refresh()} disabled={loading}><Activity size={16} />{loading ? 'Refreshing…' : 'Refresh'}</button>{canManage && <button type="button" className="primary-button" onClick={() => { const first = attention[0] ?? rows[0]; if (first) selectForAdjustment(first) }} disabled={!rows.length || !snapshot?.safeAdjustments}><Pencil size={16} />Adjust stock</button>}</div></div>
    <div className="inventory-kpis">{summaryCards.map(({ icon: Icon, label, value, note }) => <div className="inventory-kpi" key={label}><div className="inventory-kpi__top"><span>{label}</span><Icon size={16} /></div><strong>{value}</strong><small>{note}</small></div>)}</div>
    {feedback && <div className="alert alert--success" role="status"><Check size={16} />{feedback}</div>}
    {error && <div className="alert alert--error" role="alert"><CircleAlert size={16} /><span>{error}</span><button type="button" className="text-button" onClick={() => void refresh()}>Try again</button></div>}
    <section className="inventory-filter-panel"><div className="inventory-filter-top"><label className="inventory-search"><Search size={17} /><span className="sr-only">Search inventory</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product, SKU, or location" /></label><span className="inventory-result-count">{filtered.length.toLocaleString('en-IN')} of {rows.length.toLocaleString('en-IN')} rows</span></div><div className="inventory-filter-grid"><label>Location<select value={location} onChange={(event) => setLocation(event.target.value)}><option value="all">All locations</option><option value="unassigned">Unassigned</option>{locations.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.code}</option>)}</select></label><label>Stock status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All stock</option><option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option><option value="untracked">Untracked</option><option value="mismatch">Check count</option><option value="sales_blocked">Sales blocked</option><option value="attention">Needs attention</option></select></label><label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="attention">Attention first</option><option value="updated">Recently updated</option><option value="stock_asc">Available: low to high</option><option value="stock_desc">Available: high to low</option></select></label>{hasFilters && <button type="button" className="text-button inventory-clear" onClick={clearFilters}>Clear filters</button>}</div></section>
    {selected && <section className="panel inventory-detail-panel"><div className="inventory-detail-header"><div><span className="kicker">Stock detail</span><h3>{selected.variant.product.name}</h3><p className="muted">{selected.variant.size || 'Pack size not set'} · {selected.variant.sku}</p></div><div className="page-actions"><span className={`inventory-badge inventory-badge--${selectedStock?.state ?? 'untracked'}`}>{selectedStock ? stockLabels[selectedStock.state] : 'Untracked'}</span><button type="button" className="icon-button" onClick={() => setSelected(null)} aria-label="Close stock detail"><X size={17} /></button></div></div><div className="inventory-detail-grid"><div><span>Location</span><strong>{selected.location ? `${selected.location.name} · ${selected.location.code}` : 'No location record'}</strong></div><div><span>On hand</span><strong>{numberLabel(selectedStock?.onHand)}</strong></div><div><span>Reserved</span><strong>{numberLabel(selectedStock?.reserved)}</strong></div><div><span>Available to sell</span><strong>{numberLabel(selectedStock?.free)}</strong></div><div><span>Catalogue status</span><strong>{selectedStock?.publication ?? 'Unavailable'}</strong></div><div><span>Last movement</span><strong>{dateLabel(selected.lastMovementAt)}</strong></div></div>{selectedStock?.tracked && selected.locationId && canManage && snapshot?.safeAdjustments ? <div className="inventory-adjust-form"><div><span className="kicker">Adjust this location</span><p className="fine-print">Positive values receive stock. Negative values correct the count. The current count is checked again before saving.</p></div><div className="form-grid"><label>Quantity change<input type="number" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="e.g. 25 or −3" /></label><label>Reason<input value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} /></label></div><div className="page-actions"><button type="button" className="secondary-button" onClick={() => setSelected(null)}>Cancel</button><button type="button" className="primary-button" onClick={() => void applyAdjustment()} disabled={adjusting}>{adjusting ? 'Saving…' : 'Apply adjustment'}</button></div>{adjustError && <div className="alert alert--error" role="alert">{adjustError}</div>}</div> : <div className="inventory-untracked-note"><CircleAlert size={16} /><span>{!snapshot?.safeAdjustments ? 'Safe stock adjustments are not available from the connected API. Refresh once the current admin service is running.' : selectedStock?.tracked ? 'This role has read-only access to stock adjustments.' : 'This SKU has no inventory record at a location yet. Add it through the inventory workflow before adjusting stock.'}</span></div>}<div className="inventory-history"><div className="panel-heading"><div><span className="kicker">Recent movement</span><h4>Ledger activity</h4></div><Activity size={17} /></div>{(() => { const history = (snapshot?.movements ?? []).filter((movement) => movement.variantId === selected.variantId && (!selected.locationId || movement.locationId === selected.locationId)); return history.length ? history.slice(0, 6).map((movement) => <div className="inventory-history-row" key={movement.id}><span><strong>{movementLabel(movement)}</strong><small>{humanize(movement.type)} · {movement.reason}</small></span><time dateTime={movement.createdAt}>{dateLabel(movement.createdAt)}</time></div>) : <p className="muted">No movement history recorded for this SKU.</p> })()}</div></section>}
    <div className="inventory-layout"><section className="panel inventory-table-panel"><div className="inventory-table-heading"><div><span className="kicker">Stock ledger</span><h3>On-hand by location</h3><p className="panel-subtitle">Available to sell = on hand − reserved. Select a row to inspect its ledger.</p></div><span className="inventory-result-count">{filtered.length.toLocaleString('en-IN')} shown</span></div>{loading && snapshot ? <div className="inventory-refreshing">Refreshing stock ledger…</div> : filtered.length === 0 ? <div className="dashboard-empty-state"><Boxes size={25} /><strong>{hasFilters ? 'No stock rows match these filters.' : 'No inventory rows yet.'}</strong><small>{hasFilters ? 'Clear a filter to see the full ledger.' : 'Tracked stock will appear here once a location count is recorded.'}</small>{hasFilters && <button type="button" className="secondary-button" onClick={clearFilters}>Clear filters</button>}</div> : <><div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th scope="col">Product</th><th scope="col">Location</th><th scope="col">On hand</th><th scope="col">Reserved</th><th scope="col">Available</th><th scope="col">Health</th><th scope="col">Updated</th><th scope="col">Next action</th><th scope="col" aria-label="Open details" /></tr></thead><tbody>{visibleRows.map((row) => { const stock = stockFor(row); const image = row.variant.product.image; return <tr key={row.id} className="inventory-table-row" onClick={() => setSelected(row)}><td data-label="Product"><button type="button" className="inventory-product-button" onClick={(event) => { event.stopPropagation(); setSelected(row) }}><span className="inventory-product-thumb">{image ? <img src={productAssetUrl(image)} alt={row.variant.product.imageAlt ?? `${row.variant.product.name} product`} loading="lazy" /> : <Package size={16} aria-hidden="true" />}</span><span><strong>{row.variant.product.name}</strong><small>{row.variant.size || 'Pack size not set'} · {row.variant.sku}</small></span></button></td><td data-label="Location"><span className="inventory-location">{row.location ? <><strong>{row.location.name}</strong><small>{row.location.code}</small></> : <strong>Unassigned</strong>}</span></td><td data-label="On hand"><strong className="inventory-number">{numberLabel(stock.onHand)}</strong></td><td data-label="Reserved"><strong className="inventory-number inventory-number--reserved">{numberLabel(stock.reserved)}</strong></td><td data-label="Available"><strong className="inventory-number">{numberLabel(stock.free)}</strong></td><td data-label="Health"><span className={`inventory-badge inventory-badge--${stock.state}`}>{stockLabels[stock.state]}</span></td><td data-label="Updated"><time className="inventory-date" dateTime={row.lastMovementAt ?? undefined}>{dateLabel(row.lastMovementAt)}</time></td><td data-label="Next action"><span className={`inventory-next-action ${stock.state === 'in_stock' && !stock.salesBlocked ? 'inventory-next-action--quiet' : ''}`}>{stock.nextAction}</span></td><td data-label="Details" className="inventory-table-actions"><button type="button" className="icon-button" aria-label={`Open ${row.variant.product.name} stock details`} onClick={(event) => { event.stopPropagation(); setSelected(row) }}><ChevronRight size={16} /></button></td></tr> })}</tbody></table></div><div className="inventory-pagination"><span>Page {page} of {pageCount} · {filtered.length.toLocaleString('en-IN')} matching rows</span><div><button type="button" className="secondary-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Previous</button><button type="button" className="secondary-button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount}>Next</button></div></div></>}</section><aside className="inventory-side"><section className="panel inventory-side-panel"><div className="panel-heading"><div><span className="kicker">Action queue</span><h3>Needs attention</h3><p className="panel-subtitle">Low stock, blocked sales, or counts to reconcile.</p></div><CircleAlert size={17} /></div>{attention.length ? <div className="inventory-attention-list">{attention.map((row) => { const stock = stockFor(row); return <button type="button" className="inventory-attention-row" key={row.id} onClick={() => selectForAdjustment(row)}><span className={`inventory-attention-dot inventory-attention-dot--${stock.state}`} /><span><strong>{row.variant.product.name}</strong><small>{row.location?.name ?? 'Unassigned'} · {stock.nextAction}</small></span><ChevronRight size={15} /></button> })}</div> : <div className="dashboard-empty-state"><Check size={22} /><strong>Stock looks healthy</strong><small>No low-stock or blocked rows are waiting for review.</small></div>}</section><section className="panel inventory-side-panel"><div className="panel-heading"><div><span className="kicker">Recent activity</span><h3>Latest movements</h3></div><Activity size={17} /></div>{snapshot?.movements?.length ? <div className="inventory-movement-list">{snapshot.movements.slice(0, 6).map((movement: InventoryMovement) => <div className="inventory-movement-row" key={movement.id}><span className="inventory-movement-icon"><Activity size={14} /></span><span><strong>{movement.variant.product.name}</strong><small>{movementLabel(movement)} · {movement.location.name}</small></span><time dateTime={movement.createdAt}>{dateLabel(movement.createdAt)}</time></div>)}</div> : <p className="muted">No movement activity recorded yet.</p>}{snapshot && !snapshot.historyAvailable && <p className="fine-print">Movement history is unavailable from the connected API.</p>}</section><section className="panel inventory-side-panel inventory-definitions"><div className="panel-heading"><div><span className="kicker">How to read this</span><h3>Stock definitions</h3></div><Gauge size={17} /></div><dl><div><dt>On hand</dt><dd>Units physically recorded at a location.</dd></div><div><dt>Reserved</dt><dd>Units held for active orders or waitlist allocations.</dd></div><div><dt>Available to sell</dt><dd>On hand minus reserved; never below zero.</dd></div></dl><p className="fine-print">Batch expiry, landed cost, supplier lead time, and sales coverage are not tracked by this workspace yet.</p></section></aside></div>
  </div>
}

function Affiliates() {
  const queryClient = useQueryClient()
  const affiliates = useQuery({ queryKey: ['affiliates'], queryFn: () => get<Resource[]>('/admin/affiliates') })
  const redemptions = useQuery({ queryKey: ['affiliate-redemptions'], queryFn: () => get<Resource[]>('/admin/affiliate-redemptions') })
  const statusMutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => post(`/admin/affiliates/${id}/status`, { status }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['affiliates'] }) } })
  const payoutMutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: 'paid' | 'rejected' }) => post(`/admin/affiliate-redemptions/${id}/review`, { status, note: status === 'paid' ? 'Payout marked complete by operations.' : 'Payout request rejected by operations.' }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['affiliate-redemptions'] }) } })
  const formatMoney = (value: unknown) => `₹${(Number(value ?? 0) / 100).toLocaleString('en-IN')}`
  if (affiliates.isLoading || redemptions.isLoading) return <TableSkeleton />
  if (affiliates.isError || redemptions.isError) return <ErrorPanel onRetry={() => { void affiliates.refetch(); void redemptions.refetch() }} />
  return <><div className="page-intro"><div><span className="kicker">Affiliate programme / controlled payouts</span><h2>Affiliates & payouts</h2><p className="muted">Approve applicants, review masked PAN records, and complete payout requests only after an offline transfer is verified.</p></div><button className="secondary-button" onClick={() => { void affiliates.refetch(); void redemptions.refetch() }}>Refresh <Activity size={16} /></button></div><section className="panel"><div className="panel-heading"><div><span className="kicker">Partner applications</span><h3>{affiliates.data?.length ?? 0} affiliates</h3></div><HandCoins size={19} /></div>{affiliates.data?.length ? <div className="table-wrap"><table><thead><tr><th>Partner</th><th>Status</th><th>Referral code</th><th>Tracking</th><th>Masked PAN</th><th>Action</th></tr></thead><tbody>{affiliates.data.map((affiliate) => <tr key={affiliate.id}><td><strong>{String(affiliate.fullName)}</strong><small>{String(affiliate.email ?? affiliate.phone ?? '—')}</small></td><td>{String(affiliate.status).replaceAll('_', ' ')}</td><td>{String(affiliate.referralCode)}</td><td>{String(affiliate.referralClicks ?? 0)} clicks · {String(affiliate.confirmedReferralOrders ?? 0)} orders</td><td>••••{String(affiliate.panLast4 ?? '')}</td><td className="table-actions">{affiliate.status === 'pending' && <><button className="secondary-button" onClick={() => statusMutation.mutate({ id: affiliate.id, status: 'approved' })} disabled={statusMutation.isPending}>Approve</button><button className="text-button" onClick={() => statusMutation.mutate({ id: affiliate.id, status: 'rejected' })} disabled={statusMutation.isPending}>Reject</button></>}{affiliate.status === 'approved' && <button className="text-button" onClick={() => statusMutation.mutate({ id: affiliate.id, status: 'suspended' })} disabled={statusMutation.isPending}>Suspend</button>}{affiliate.status === 'suspended' && <button className="secondary-button" onClick={() => statusMutation.mutate({ id: affiliate.id, status: 'approved' })} disabled={statusMutation.isPending}>Reinstate</button>}</td></tr>)}</tbody></table></div> : <p className="muted">No affiliate applications yet.</p>}{statusMutation.isError && <div className="alert alert--error">Unable to update the affiliate status.</div>}</section><section className="panel"><div className="panel-heading"><div><span className="kicker">Wallet redemptions</span><h3>Pending payout review</h3></div><HandCoins size={19} /></div>{redemptions.data?.length ? <div className="table-wrap"><table><thead><tr><th>Affiliate</th><th>Amount</th><th>UPI</th><th>Status</th><th>Requested</th><th>Action</th></tr></thead><tbody>{redemptions.data.map((redemption) => { const affiliate = redemption.affiliate as Resource | undefined; return <tr key={redemption.id}><td>{String(affiliate?.fullName ?? 'Affiliate')}</td><td>{formatMoney(redemption.amountPaise)}</td><td>{String(redemption.payoutUpiId ?? affiliate?.payoutUpiId ?? 'Not provided')}</td><td>{String(redemption.status)}</td><td>{new Date(String(redemption.createdAt)).toLocaleDateString('en-IN')}</td><td className="table-actions">{redemption.status === 'requested' && <><button className="secondary-button" onClick={() => { if (window.confirm('Only mark paid after completing the offline payout. Continue?')) payoutMutation.mutate({ id: redemption.id, status: 'paid' }) }} disabled={payoutMutation.isPending}>Mark paid</button><button className="text-button" onClick={() => payoutMutation.mutate({ id: redemption.id, status: 'rejected' })} disabled={payoutMutation.isPending}>Reject</button></>}</td></tr> })}</tbody></table></div> : <p className="muted">No redemption requests yet.</p>}{payoutMutation.isError && <div className="alert alert--error">Unable to review this payout request.</div>}</section></>
}

function Customers({ canManage, canAnonymize }: { canManage: boolean; canAnonymize: boolean }) {
  const [search, setSearch] = useTableSearch()
  const [selected, setSelected] = useState<string | null>(null)
  const query = useQuery({ queryKey: ['customers', search], queryFn: () => get<Resource[]>(withSearch('/admin/customers?limit=100', search)) })
  if (selected) return <CustomerDetail id={selected} canManage={canManage} canAnonymize={canAnonymize} onBack={() => setSelected(null)} />
  return <><div className="page-intro"><div><span className="kicker">Customer care / privacy-safe view</span><h2>Customers</h2><p className="muted">Review masked contact details, orders, consent, notes and privacy actions.</p></div><button className="secondary-button" onClick={() => query.refetch()}>Refresh <Activity size={16} /></button></div>{query.isLoading ? <TableSkeleton /> : query.isError ? <ErrorPanel onRetry={() => query.refetch()} /> : <DataTable rows={query.data ?? []} fields={['fullName', 'email', 'phone', 'createdAt']} onRow={(row) => setSelected(row.id)} searchValue={search} onSearch={setSearch} />}</>
}

function CustomerDetail({ id, canManage, canAnonymize, onBack }: { id: string; canManage: boolean; canAnonymize: boolean; onBack: () => void }) {
  const query = useQuery({ queryKey: ['customer', id], queryFn: () => get<Resource>(`/admin/customers/${id}`) })
  const [note, setNote] = useState('')
  const [feedback, setFeedback] = useState('')
  const noteMutation = useMutation({ mutationFn: () => post(`/admin/customers/${id}/notes`, { body: note.trim() }), onSuccess: async () => { setNote(''); setFeedback('Note added.'); await query.refetch() } })
  const exportMutation = useMutation({ mutationFn: () => post<Resource>(`/admin/customers/${id}/export-data`, {}), onSuccess: (data) => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `skinfox-customer-${id}.json`; anchor.click(); URL.revokeObjectURL(url); setFeedback('Customer data export downloaded.') } })
  const anonymizeMutation = useMutation({ mutationFn: () => post(`/admin/customers/${id}/anonymize`, {}), onSuccess: async () => { setFeedback('Customer was anonymized.'); await query.refetch() } })
  if (query.isLoading) return <TableSkeleton />
  if (query.isError) return <ErrorPanel onRetry={() => query.refetch()} />
  const customer: Resource = query.data ?? { id }
  return <><div className="editor-top"><button className="back-button" onClick={onBack}><ArrowLeft size={16} /> Customers</button><div><span className="kicker">Customer detail</span><h2>{String(customer.fullName ?? 'Customer')}</h2></div><div className="page-actions"><button className="secondary-button" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>{exportMutation.isPending ? 'Exporting…' : 'Export data'}</button>{canAnonymize && <button className="danger-button" onClick={() => { if (window.confirm('Anonymize this customer and revoke their identifiable profile?')) anonymizeMutation.mutate() }} disabled={anonymizeMutation.isPending}>Anonymize</button>}</div></div><div className="detail-grid"><section className="panel"><span className="kicker">Profile</span><div className="line-row"><span>Email</span><strong>{String(customer.email ?? '—')}</strong></div><div className="line-row"><span>Phone</span><strong>{String(customer.phone ?? '—')}</strong></div><div className="line-row"><span>Orders</span><strong>{Array.isArray(customer.orders) ? customer.orders.length : 0}</strong></div><div className="line-row"><span>Consent records</span><strong>{Array.isArray(customer.consents) ? customer.consents.length : 0}</strong></div></section><section className="panel"><span className="kicker">Support notes</span>{Array.isArray(customer.notes) && customer.notes.length ? customer.notes.map((item: Resource) => <div className="attention-row" key={item.id}><ClipboardList size={16} /><span><strong>{String(item.body)}</strong><small>{String(item.createdAt ?? '')}</small></span></div>) : <p className="muted">No notes yet.</p>}{canManage && <><textarea aria-label="Customer note" className="note-editor" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add an internal support note" /><button className="primary-button" onClick={() => noteMutation.mutate()} disabled={noteMutation.isPending || note.trim().length < 2}>{noteMutation.isPending ? 'Adding…' : 'Add note'}</button></>}{(noteMutation.isError || exportMutation.isError || anonymizeMutation.isError) && <div className="alert alert--error" role="alert">Unable to complete that customer action.</div>}{feedback && <div className="alert alert--success" role="status">{feedback}</div>}</section></div></>
}

function Orders({ canManage }: { canManage: boolean }) {
  const [search, setSearch] = useTableSearch()
  const [status, setStatus] = useState('all')
  const [paymentStatus, setPaymentStatus] = useState('all')
  const [paymentMethod, setPaymentMethod] = useState('all')
  const [source, setSource] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState('createdAt:desc')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const pageSize = 25
  const deferredSearch = useDeferredValue(search)
  useEffect(() => { setPage(1) }, [deferredSearch, status, paymentStatus, paymentMethod, source, from, to, sort])
  const [sortField, sortDirection] = sort.split(':')
  const params = new URLSearchParams({ page: String(page), limit: String(pageSize), sort: sortField, direction: sortDirection })
  if (deferredSearch.trim()) params.set('q', deferredSearch.trim())
  if (status !== 'all') params.set('status', status)
  if (paymentStatus !== 'all') params.set('paymentStatus', paymentStatus)
  if (paymentMethod !== 'all') params.set('paymentMethod', paymentMethod)
  if (source !== 'all') params.set('source', source)
  if (from) params.set('from', from + 'T00:00:00.000Z')
  if (to) params.set('to', to + 'T23:59:59.999Z')
  const query = useQuery({ queryKey: ['orders', params.toString()], queryFn: () => getWithMeta<AdminOrder[]>('/admin/orders?' + params.toString()) })
  const attentionParams = new URLSearchParams({ page: '1', limit: '5', status: 'needs_action' })
  const attention = useQuery({ queryKey: ['orders-attention'], queryFn: () => getWithMeta<AdminOrder[]>('/admin/orders?' + attentionParams.toString()) })
  if (selected) return <OrderDetail id={selected} onBack={() => setSelected(null)} canManage={canManage} />
  const rows = query.data?.data ?? []
  const meta = query.data?.meta ?? {}
  const counts = (meta.counts && typeof meta.counts === 'object' ? meta.counts : {}) as Record<string, unknown>
  const sources = Array.isArray(meta.sources) ? meta.sources.map(String) : []
  const paymentMethods = Array.isArray(meta.paymentMethods) ? meta.paymentMethods.map(String) : []
  const total = Number(meta.total ?? rows.length)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasFilters = Boolean(deferredSearch.trim() || status !== 'all' || paymentStatus !== 'all' || paymentMethod !== 'all' || source !== 'all' || from || to)
  const clearFilters = () => { setSearch(''); setStatus('all'); setPaymentStatus('all'); setPaymentMethod('all'); setSource('all'); setFrom(''); setTo(''); setPage(1) }
  const hasOperationalCounts = Object.keys(counts).length > 0
  const countFor = (key: string) => hasOperationalCounts ? Number(counts[key] ?? 0).toLocaleString('en-IN') : '—'
  const statusTabs = [['all', 'All orders'], ['needs_action', 'Needs action'], ['pending_payment', 'Awaiting payment'], ['confirmed', 'Confirmed'], ['processing', 'Processing'], ['packed', 'Packed'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']]
  const formatDate = (value: unknown) => { const date = new Date(String(value ?? '')); return Number.isNaN(date.valueOf()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date) }
  const getCustomer = (row: AdminOrder): Resource => row.customer ?? ({} as Resource)
  const getAddress = (row: AdminOrder): Record<string, unknown> => row.shippingAddress && typeof row.shippingAddress === 'object' ? row.shippingAddress : {}
  const getItems = (row: AdminOrder) => Array.isArray(row.items) ? row.items : []
  const getQuantity = (row: AdminOrder) => getItems(row).reduce((total, item) => total + Number(item.quantity ?? 0), 0)
  const payment = (row: AdminOrder) => {
    const payments = Array.isArray(row.payments) ? row.payments : []
    const captured = payments.reduce((total, item) => total + Number(item.capturedPaise ?? 0), 0)
    const current = payments[payments.length - 1]
    const provider = String(current?.provider ?? '')
    const method = provider.includes('cod') ? 'COD' : provider.includes('razorpay') ? 'Razorpay' : provider ? provider.replaceAll('_', ' ') : 'Unrecorded'
    const state = row.status === 'pending_payment' || row.status === 'payment_failed' ? 'Awaiting payment' : captured > 0 ? 'Paid' : current?.status ? String(current.status).replaceAll('_', ' ') : 'Unpaid'
    return { method, state, captured }
  }
  const nextAction = (row: AdminOrder) => {
    const address = getAddress(row)
    if (['pending_payment', 'payment_failed'].includes(String(row.status))) return 'Review payment'
    if (['confirmed', 'processing', 'packed'].includes(String(row.status)) && !Object.keys(address).length) return 'Add address'
    if (row.status === 'confirmed') return 'Start processing'
    if (row.status === 'processing') return 'Pack order'
    if (row.status === 'packed') return 'Mark shipped'
    if (row.status === 'shipped') return 'Mark delivered'
    if (row.status === 'delivered') return 'Complete'
    return 'View details'
  }
  const statusLabel = (value: unknown) => String(value ?? 'unknown').replaceAll('_', ' ')
  const statusClass = (value: unknown) => 'orders-badge orders-badge--' + String(value ?? 'unknown').replaceAll('_', '-')
  return <div className="orders-workspace">
    <div className="orders-hero"><div><span className="kicker">SkinFox operations</span><h2>Orders &amp; fulfilment</h2><p className="muted">{new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())} · {total.toLocaleString('en-IN')} matching orders</p></div><div className="page-actions"><span className="orders-last-updated">{query.data ? 'Updated just now' : 'Loading order data'}</span><button className="secondary-button" onClick={() => { void query.refetch(); void attention.refetch() }} disabled={query.isFetching}><Activity size={16} />{query.isFetching ? 'Refreshing…' : 'Refresh'}</button></div></div>
    <div className="orders-tabs" role="tablist" aria-label="Order status"><div className="orders-tabs-scroll">{statusTabs.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={status === key} className={status === key ? 'is-active' : ''} onClick={() => setStatus(key)}><span>{label}</span><strong>{key === 'all' ? total.toLocaleString('en-IN') : countFor(key)}</strong></button>)}</div></div>
    <section className="panel orders-filter-panel"><div className="orders-filter-top"><label className="orders-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search orders</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, customer, waitlist ID, product or SKU" aria-label="Search orders" /></label><div className="orders-filter-actions"><label>Sort<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="createdAt:desc">Newest first</option><option value="createdAt:asc">Oldest first</option><option value="totalPaise:desc">Highest value</option><option value="totalPaise:asc">Lowest value</option><option value="remainingBalancePaise:desc">Highest balance due</option><option value="remainingBalancePaise:asc">Lowest balance due</option></select></label>{hasFilters && <button type="button" className="text-button" onClick={clearFilters}>Clear filters</button>}</div></div><div className="orders-filter-grid"><label>Payment status<select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}><option value="all">All payment states</option><option value="captured">Captured</option><option value="authorised">Authorised</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select></label><label>Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="all">All payment methods</option>{paymentMethods.map((item) => <option value={item} key={item}>{item.includes('cod') ? 'Cash on delivery' : item.includes('razorpay') ? 'Razorpay' : item.replaceAll('_', ' ')}</option>)}</select></label><label>Order origin<select value={source} onChange={(event) => setSource(event.target.value)}><option value="all">All origins</option>{sources.map((item) => <option value={item} key={item}>{item === 'waitlist' ? 'Waitlist order' : item === 'storefront' ? 'Storefront' : item.replaceAll('_', ' ')}</option>)}</select></label><label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div></section>
    <div className="orders-layout"><section className="panel orders-table-panel"><div className="orders-table-heading"><div><span className="kicker">Order queue</span><h3>{total.toLocaleString('en-IN')} orders</h3></div><span className="orders-table-note">Amounts and statuses are read from the recorded order snapshot.</span></div>{query.isLoading ? <TableSkeleton /> : query.isError ? <ErrorPanel onRetry={() => void query.refetch()} /> : rows.length === 0 ? <div className="dashboard-empty-state orders-empty"><ShoppingBag size={25} /><strong>{hasFilters ? 'No orders match these filters.' : 'No orders yet.'}</strong><small>{hasFilters ? 'Clear a filter to see the full queue.' : 'Orders will appear here after checkout.'}</small>{hasFilters && <button type="button" className="secondary-button" onClick={clearFilters}>Clear filters</button>}</div> : <div className="table-wrap orders-table-wrap"><table className="orders-table"><thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Products</th><th scope="col">Total</th><th scope="col">Payment</th><th scope="col">Fulfilment</th><th scope="col">Next action</th><th scope="col" aria-label="Open order" /></tr></thead><tbody>{rows.map((row) => { const customer = getCustomer(row); const address = getAddress(row); const items = getItems(row); const paymentState = payment(row); const firstItem = items[0]; const quantity = getQuantity(row); return <tr key={row.id} className="orders-table-row" tabIndex={0} onClick={() => setSelected(String(row.id))} onKeyDown={(event) => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); setSelected(String(row.id)) } }}><td data-label="Order"><button type="button" className="orders-order-link" onClick={(event) => { event.stopPropagation(); setSelected(String(row.id)) }}><strong>{String(row.orderNumber ?? row.id)}</strong><small>{formatDate(row.createdAt)}</small></button>{row.source === 'waitlist' && <span className="orders-origin">Waitlist order</span>}</td><td data-label="Customer"><span className="orders-customer"><strong>{String(customer.fullName ?? 'Customer')}</strong><small>{String(address.city ?? address.pincode ?? customer.email ?? 'Address not added')}</small></span></td><td data-label="Products"><span className="orders-products"><span className="orders-product-thumb">{firstItem?.primaryImage ? <img src={productAssetUrl(String(firstItem.primaryImage))} alt="" loading="lazy" /> : <Package size={15} aria-hidden="true" />}</span><span><strong>{firstItem ? String(firstItem.productName ?? 'Product') : 'No product details'}</strong><small>{items.length > 1 ? `+${items.length - 1} more · ` : ''}{quantity} {quantity === 1 ? 'unit' : 'units'}</small></span></span></td><td data-label="Total"><strong className="orders-money">{formatPaise(row.totalPaise)}</strong>{Number(row.remainingBalancePaise ?? 0) > 0 && <small className="orders-balance">Due {formatPaise(row.remainingBalancePaise)}</small>}</td><td data-label="Payment"><span className={'orders-badge orders-badge--payment-' + paymentState.state.toLowerCase().replaceAll(' ', '-')}><span>{paymentState.state}</span></span><small className="orders-payment-method">{paymentState.method}</small></td><td data-label="Fulfilment"><span className={statusClass(row.status)}>{statusLabel(row.status)}</span></td><td data-label="Next action"><span className={nextAction(row) === 'Complete' ? 'orders-next-action orders-next-action--quiet' : 'orders-next-action'}>{nextAction(row)}</span></td><td data-label="Actions" className="orders-table-actions"><button type="button" className="icon-button" aria-label={`Open order ${String(row.orderNumber ?? row.id)}`} onClick={(event) => { event.stopPropagation(); setSelected(String(row.id)) }}><ChevronRight size={17} /></button></td></tr> })}</tbody></table></div>}{totalPages > 1 && <div className="orders-pagination"><span>Page {page} of {totalPages}</span><div><button type="button" className="secondary-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || query.isFetching}>Previous</button><button type="button" className="secondary-button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || query.isFetching}>Next</button></div></div>}</section><aside className="orders-side"><section className="panel orders-side-panel"><div className="panel-heading"><div><span className="kicker">Current queue</span><h3>Fulfilment overview</h3><p className="panel-subtitle">All matching orders by their current status.</p></div><ClipboardList size={18} /></div><div className="orders-status-grid">{[['confirmed', 'Confirmed'], ['processing', 'Processing'], ['packed', 'Packed'], ['shipped', 'Shipped'], ['delivered', 'Delivered']].map(([key, label]) => <div key={key}><span>{label}</span><strong>{countFor(key)}</strong></div>)}</div></section><section className="panel orders-side-panel"><div className="panel-heading"><div><span className="kicker">Action queue</span><h3>Needs attention</h3></div><span className="orders-count-badge">{countFor('needs_action')}</span></div>{attention.isLoading ? <div className="dashboard-list-skeleton"><span /><span /><span /></div> : attention.isError ? <p className="muted">Unable to load action queue.</p> : attention.data?.data?.length ? <div className="orders-attention-list">{attention.data.data.map((row) => <button type="button" className="orders-attention-row" key={row.id} onClick={() => setSelected(String(row.id))}><span className="orders-attention-icon"><CircleAlert size={14} /></span><span><strong>{String(row.orderNumber ?? row.id)}</strong><small>{nextAction(row)} · {formatPaise(row.totalPaise)}</small></span><ChevronRight size={15} /></button>)}</div> : <div className="dashboard-empty-state"><Check size={22} /><strong>Nothing needs attention</strong><small>Payment and fulfilment queues are clear.</small></div>}</section><section className="panel orders-side-panel orders-side-panel--compact"><div className="panel-heading"><div><span className="kicker">Payment overview</span><h3>Recorded payment state</h3></div><HandCoins size={18} /></div><div className="orders-payment-overview"><div><span>Awaiting payment</span><strong>{countFor('pending_payment')}</strong></div><div><span>Payment failed</span><strong>{countFor('payment_failed')}</strong></div><div><span>Confirmed orders</span><strong>{countFor('confirmed')}</strong></div></div><p className="fine-print">Payment counts follow the order status snapshot and recorded payment events.</p></section></aside></div>
  </div>
}
function OrderLifecycleDetail({ id, onBack, canManage }: { id: string; onBack: () => void; canManage: boolean }) {
  const query = useQuery({ queryKey: ['order', id], queryFn: () => get<AdminOrder>(`/admin/orders/${id}`) })
  const qc = useQueryClient()
  const [reason, setReason] = useState('Operations update')
  const [feedback, setFeedback] = useState('')
  const allowedActions: Record<string, string[]> = { pending_payment: ['confirm', 'cancel'], payment_failed: ['confirm', 'cancel'], confirmed: ['process', 'cancel'], processing: ['pack', 'cancel'], packed: ['ship'], shipped: ['deliver'] }
  const mutation = useMutation({ mutationFn: (action: string) => api(`/admin/orders/${id}/${action}`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ reason }) }), onSuccess: async (_, action) => { setFeedback(`Order ${action} completed.`); await qc.invalidateQueries({ queryKey: ['order', id] }); await qc.invalidateQueries({ queryKey: ['order-tools', id] }) } })
  if (query.isLoading) return <TableSkeleton />
  if (query.isError || !query.data) return <ErrorPanel onRetry={() => void query.refetch()} />
  const order = query.data
  const actions = allowedActions[String(order.status ?? '')] ?? []
  const customer: Resource = order.customer ?? ({} as Resource)
  const address: Record<string, unknown> = order.shippingAddress && typeof order.shippingAddress === 'object' ? order.shippingAddress : {}
  const items = Array.isArray(order.items) ? order.items : []
  const payments = Array.isArray(order.payments) ? order.payments : []
  const captured = payments.reduce((total, item) => total + Number(item.capturedPaise ?? 0), 0)
  const money = (value: unknown) => formatPaise(value)
  const date = (value: unknown) => { const parsed = new Date(String(value ?? '')); return Number.isNaN(parsed.valueOf()) ? 'Unavailable' : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(parsed) }
  return <div className="order-detail-view"><div className="editor-top"><button className="back-button" onClick={onBack}><ArrowLeft size={16} /> Orders &amp; fulfilment</button><div><span className="kicker">Order detail</span><h2>{String(order.orderNumber ?? order.id)}</h2><p className="muted">Created {date(order.createdAt)} · {order.source === 'waitlist' ? 'Waitlist order' : 'Storefront order'}</p></div><span className={statusClassForOrder(order.status)}>{String(order.status ?? 'unknown').replaceAll('_', ' ')}</span></div><div className="order-detail-grid"><div className="order-detail-main"><section className="panel order-detail-panel"><div className="panel-heading"><div><span className="kicker">Customer</span><h3>{String(customer.fullName ?? 'Customer')}</h3></div><Users size={18} /></div><div className="order-detail-columns"><div><span className="order-detail-label">Email</span><strong>{String(customer.email ?? 'Unavailable')}</strong></div><div><span className="order-detail-label">Phone</span><strong>{String(customer.phone ?? 'Unavailable')}</strong></div><div><span className="order-detail-label">Order origin</span><strong>{order.source === 'waitlist' ? 'Waitlist order' : String(order.source ?? 'Storefront')}</strong></div>{order.waitlistReservationId && <div><span className="order-detail-label">Waitlist ID</span><code className="table-id">{String(order.waitlistReservationId)}</code></div>}</div></section><section className="panel order-detail-panel"><div className="panel-heading"><div><span className="kicker">Recorded order snapshot</span><h3>Products &amp; payment</h3></div><ShoppingBag size={18} /></div><div className="order-detail-items">{items.length ? items.map((item) => <div className="order-detail-item" key={String(item.id)}><span className="order-detail-item-thumb">{item.primaryImage ? <img src={productAssetUrl(String(item.primaryImage))} alt="" /> : <Package size={16} aria-hidden="true" />}</span><span className="order-detail-item-copy"><strong>{String(item.productName ?? 'Product')}</strong><small>{String(item.size ?? item.variantName ?? 'Size unavailable')} · {String(item.sku ?? 'SKU unavailable')}</small></span><span className="order-detail-item-qty">× {String(item.quantity ?? 1)}</span><span className="order-detail-item-price"><small>{money(item.unitSellingPricePaise)} / unit</small><strong>{money(item.finalLineTotalPaise)}</strong></span></div>) : <p className="muted">Product details are unavailable for this order.</p>}</div><div className="order-summary"><div><span>Order total</span><strong>{money(order.totalPaise)}</strong></div>{order.mrpSubtotalPaise !== null && order.mrpSubtotalPaise !== undefined && <div><span>MRP subtotal</span><strong>{money(order.mrpSubtotalPaise)}</strong></div>}{Number(order.discountPaise ?? 0) > 0 && <div><span>Recorded discount</span><strong>−{money(order.discountPaise)}</strong></div>}{Number(order.waitlistDiscountPaise ?? 0) > 0 && <div><span>Waitlist discount</span><strong>−{money(order.waitlistDiscountPaise)}</strong></div>}{Number(order.shippingPaise ?? 0) > 0 && <div><span>Shipping</span><strong>{money(order.shippingPaise)}</strong></div>}{Number(order.taxPaise ?? 0) > 0 && <div><span>Tax</span><strong>{money(order.taxPaise)}</strong></div>}{Number(order.reservationCreditPaise ?? 0) > 0 && <div><span>Reservation credit</span><strong>−{money(order.reservationCreditPaise)}</strong></div>}<div className="order-summary-total"><span>Remaining balance</span><strong>{money(order.remainingBalancePaise ?? Math.max(0, Number(order.totalPaise ?? 0) - captured))}</strong></div></div></section><section className="panel order-detail-panel"><div className="panel-heading"><div><span className="kicker">Delivery</span><h3>Shipping address</h3></div><Truck size={18} /></div>{Object.keys(address).length ? <address className="order-address">{[address.fullName, address.addressLine1, address.addressLine2, address.landmark, [address.city, address.state, address.pincode].filter(Boolean).join(', ')].filter(Boolean).map((line) => <span key={String(line)}>{String(line)}</span>)}</address> : <div className="alert"><CircleAlert size={16} />Delivery address is required before fulfilment can continue.</div>}</section></div><aside className="order-detail-side"><section className="panel order-detail-panel"><div className="panel-heading"><div><span className="kicker">Lifecycle</span><h3>Next step</h3></div><Activity size={18} /></div>{canManage ? <><label className="inline-label">Reason<input value={reason} minLength={3} required onChange={(event) => setReason(event.target.value)} /></label><div className="action-row">{actions.map((action) => <button key={action} className="primary-button" disabled={mutation.isPending || reason.trim().length < 3} onClick={() => { setFeedback(''); if (window.confirm(`Confirm order action: ${action}?`)) mutation.mutate(action) }}>{mutation.isPending ? 'Updating…' : action.replaceAll('_', ' ')}</button>)}</div>{!actions.length && <p className="fine-print">No further lifecycle actions are available.</p>}</> : <p className="fine-print">Your role has read-only access to lifecycle actions.</p>}{mutation.isError && <div className="alert alert--error" role="alert">{mutation.error instanceof Error ? mutation.error.message : 'Unable to update the order.'}</div>}{feedback && <div className="alert alert--success" role="status"><Check size={16} />{feedback}</div>}</section><section className="panel order-detail-panel"><div className="panel-heading"><div><span className="kicker">Payment events</span><h3>{payments.length ? `${payments.length} recorded` : 'No payments'}</h3></div><HandCoins size={18} /></div>{payments.length ? payments.map((item) => <div className="order-payment-row" key={String(item.id)}><span><strong>{String(item.provider ?? 'Payment').replaceAll('_', ' ')}</strong><small>{String(item.status ?? 'unknown').replaceAll('_', ' ')}</small></span><strong>{money(item.capturedPaise ?? item.amountPaise)}</strong></div>) : <p className="muted">No payment records attached.</p>}</section><section className="panel order-detail-panel"><div className="panel-heading"><div><span className="kicker">Status timeline</span><h3>Recorded events</h3></div><ClipboardList size={18} /></div>{Array.isArray(order.statusEvents) && order.statusEvents.length ? <div className="order-timeline">{order.statusEvents.map((event) => <div key={String(event.id)}><span className="order-timeline-dot" /><span><strong>{String(event.toStatus ?? 'Status update').replaceAll('_', ' ')}</strong><small>{date(event.createdAt)}{event.reason ? ` · ${String(event.reason)}` : ''}</small></span></div>)}</div> : <p className="muted">No lifecycle events recorded yet.</p>}</section></aside></div></div>
}

function OrderShipmentPanel({ id, canManage }: { id: string; canManage: boolean }) {
  const query = useQuery({ queryKey: ['order-shipment', id], queryFn: () => get<AdminOrder>(`/admin/orders/${id}`) })
  if (!query.data) return null
  return <ShipmentOperations order={query.data} canManage={canManage} onRefresh={() => void query.refetch()} />
}

function ShipmentOperations({ order, canManage, onRefresh }: { order: AdminOrder; canManage: boolean; onRefresh: () => void }) {
  const [weightGrams, setWeightGrams] = useState('500')
  const [lengthCm, setLengthCm] = useState('20')
  const [breadthCm, setBreadthCm] = useState('15')
  const [heightCm, setHeightCm] = useState('8')
  const [quotes, setQuotes] = useState<Resource[]>([])
  const shipment = (order.shipments ?? []).find((item) => String(item.provider ?? '') === 'shiprocket' && String(item.status ?? '') !== 'cancelled')
  const paymentMethod = (order.payments ?? []).some((payment) => String(payment.provider ?? '') === 'cod') ? 'cod' : 'prepaid'
  const packagePayload = () => ({ weightGrams: Number(weightGrams), lengthCm: Number(lengthCm), breadthCm: Number(breadthCm), heightCm: Number(heightCm) })
  const quoteMutation = useMutation({ mutationFn: () => post<Resource>('/admin/orders/' + order.id + '/shipment/quote', { paymentMethod, package: packagePayload() }), onSuccess: (result) => setQuotes(Array.isArray(result.couriers) ? result.couriers as Resource[] : []) })
  const bookMutation = useMutation({ mutationFn: (courier: Resource) => api(`/admin/orders/${order.id}/shipment/book`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ courierId: String(courier.id), courierName: String(courier.name ?? 'Courier'), paymentMethod, package: packagePayload() }) }), onSuccess: onRefresh })
  const actionMutation = useMutation({ mutationFn: (action: string) => post<Resource>(`/admin/orders/${order.id}/shipment/${action}`, {}), onSuccess: onRefresh })
  const money = (value: unknown) => value === null || value === undefined ? 'Rate unavailable' : formatPaise(value)
  return <section className="panel order-detail-panel shipment-operations"><div className="panel-heading"><div><span className="kicker">Shipping provider</span><h3>{shipment ? 'Shiprocket shipment' : 'Book a courier shipment'}</h3><p className="panel-subtitle">Quotes use the packed parcel details and delivery pincode saved on this order.</p></div><Truck size={18} /></div>{shipment ? <><div className="shipment-status-grid"><div><span>Status</span><strong>{String(shipment.status ?? 'pending').replaceAll('_', ' ')}</strong></div><div><span>Courier</span><strong>{String(shipment.courierName ?? shipment.courierId ?? 'Pending')}</strong></div><div><span>AWB</span><strong>{String(shipment.trackingNumber ?? 'Pending')}</strong></div></div><div className="page-actions shipment-actions">{shipment.labelUrl && <a className="secondary-button" href={String(shipment.labelUrl)} target="_blank" rel="noreferrer">Open label</a>}{shipment.manifestUrl && <a className="secondary-button" href={String(shipment.manifestUrl)} target="_blank" rel="noreferrer">Open manifest</a>}{canManage && <><button className="secondary-button" onClick={() => actionMutation.mutate('refresh')} disabled={actionMutation.isPending}>Refresh tracking</button><button className="secondary-button" onClick={() => actionMutation.mutate('pickup')} disabled={actionMutation.isPending}>Request pickup</button><button className="danger-button" onClick={() => { if (window.confirm('Cancel this Shiprocket shipment?')) actionMutation.mutate('cancel') }} disabled={actionMutation.isPending}>Cancel shipment</button></>}</div>{Array.isArray(shipment.events) && shipment.events.length > 0 && <div className="shipment-events">{shipment.events.slice(-5).map((event) => <div key={String(event.id)}><strong>{String(event.status).replaceAll('_', ' ')}</strong><small>{event.createdAt ? new Date(String(event.createdAt)).toLocaleString('en-IN') : 'Recorded event'}</small></div>)}</div>}</> : canManage ? <><div className="form-grid shipment-package-form"><label>Weight (g)<input type="number" min="1" value={weightGrams} onChange={(event) => setWeightGrams(event.target.value)} /></label><label>Length (cm)<input type="number" min="1" value={lengthCm} onChange={(event) => setLengthCm(event.target.value)} /></label><label>Breadth (cm)<input type="number" min="1" value={breadthCm} onChange={(event) => setBreadthCm(event.target.value)} /></label><label>Height (cm)<input type="number" min="1" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} /></label></div><button className="secondary-button" onClick={() => quoteMutation.mutate()} disabled={quoteMutation.isPending}>{quoteMutation.isPending ? 'Getting quotes…' : 'Get courier quotes'}</button>{quotes.length > 0 && <div className="shipment-quote-list">{quotes.map((courier) => <div className="shipment-quote-row" key={String(courier.id)}><span><strong>{String(courier.name)}</strong><small>{courier.estimatedDays ? `${String(courier.estimatedDays)} day estimate` : 'ETA unavailable'} · {courier.codAvailable ? 'COD available' : 'Prepaid'}</small></span><strong>{money(courier.ratePaise)}<button className="primary-button" onClick={() => bookMutation.mutate(courier)} disabled={bookMutation.isPending}>{bookMutation.isPending ? 'Booking…' : 'Book'}</button></strong></div>)}</div>}{(quoteMutation.isError || bookMutation.isError || actionMutation.isError) && <div className="alert alert--error" role="alert">{String((quoteMutation.error ?? bookMutation.error ?? actionMutation.error) instanceof Error ? (quoteMutation.error ?? bookMutation.error ?? actionMutation.error) : 'Shipping action failed.')}</div>}<p className="fine-print">Live booking is protected by SHIPROCKET_BOOKING_ENABLED. Keep it disabled while configuring credentials and package policy.</p></> : <p className="fine-print">Your role can view shipment status but cannot book or modify shipments.</p>}</section>
}

function OrderDetail({ id, onBack, canManage }: { id: string; onBack: () => void; canManage: boolean }) {
  const query = useQuery({ queryKey: ['order-tools', id], queryFn: () => get<Resource>(`/admin/orders/${id}`) })
  return <><OrderLifecycleDetail id={id} onBack={onBack} canManage={canManage} /><OrderShipmentPanel id={id} canManage={canManage} /><OrderOperations order={query.data} canManage={canManage} loading={query.isLoading} /></>
}

function OrderOperations({ order, canManage, loading }: { order?: Resource; canManage: boolean; loading: boolean }) {
  const id = String(order?.id ?? '')
  const [note, setNote] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('Customer request')
  const [invoice, setInvoice] = useState<Resource | null>(null)
  const [feedback, setFeedback] = useState('')
  const noteMutation = useMutation({ mutationFn: () => post(`/admin/orders/${id}/notes`, { body: note.trim() }), onSuccess: () => { setNote(''); setFeedback('Order note added.') } })
  const resendMutation = useMutation({ mutationFn: () => post(`/admin/orders/${id}/resend-confirmation`, {}), onSuccess: () => setFeedback('Confirmation email queued.') })
  const invoiceMutation = useMutation({ mutationFn: () => get<Resource>(`/admin/orders/${id}/invoice`), onSuccess: (data) => setInvoice(data) })
  const refundMutation = useMutation({ mutationFn: () => { const amountPaise = Math.round(Number(refundAmount) * 100); if (!Number.isInteger(amountPaise) || amountPaise <= 0 || refundReason.trim().length < 3) throw new Error('Enter a positive refund amount and a reason.'); return api(`/admin/orders/${id}/refund`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ amountPaise, reason: refundReason.trim(), confirmed: true }) }) }, onSuccess: () => { setRefundAmount(''); setFeedback('Refund processed.') } })
  if (loading || !order) return null
  return <section className="panel order-tools"><div className="panel-heading"><div><span className="kicker">Order tools</span><h3>Support actions</h3></div><ShoppingBag size={19} /></div><div className="page-actions"><button className="secondary-button" onClick={() => invoiceMutation.mutate()} disabled={invoiceMutation.isPending}>{invoiceMutation.isPending ? 'Loading…' : 'Preview invoice'}</button>{canManage && <button className="secondary-button" onClick={() => resendMutation.mutate()} disabled={resendMutation.isPending}>{resendMutation.isPending ? 'Sending…' : 'Resend confirmation'}</button>}</div><label>Internal note<textarea aria-label="Order note" className="note-editor" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add an internal order note" /></label><button className="secondary-button" onClick={() => noteMutation.mutate()} disabled={noteMutation.isPending || note.trim().length < 2}>{noteMutation.isPending ? 'Adding…' : 'Add note'}</button>{canManage && <div className="subpanel"><span className="kicker">Refund</span><div className="form-grid"><label>Amount (₹)<input type="number" min="0.01" step="0.01" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} /></label><label>Reason<input value={refundReason} onChange={(event) => setRefundReason(event.target.value)} /></label></div><button className="secondary-button" onClick={() => { if (window.confirm('Process this refund?')) refundMutation.mutate() }} disabled={refundMutation.isPending || !refundAmount}>{refundMutation.isPending ? 'Processing…' : 'Process refund'}</button></div>}{invoice && <pre className="invoice-preview">{JSON.stringify(invoice, null, 2)}</pre>}{(noteMutation.isError || resendMutation.isError || refundMutation.isError || invoiceMutation.isError) && <div className="alert alert--error" role="alert">Unable to complete that order action.</div>}{feedback && <div className="alert alert--success" role="status">{feedback}</div>}</section>
}

function UsersView() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminRole>('SUPPORT_AGENT')
  const [invitationToken, setInvitationToken] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const query = useQuery({ queryKey: ['users'], queryFn: () => get<Resource[]>('/admin/users') })
  const mutation = useMutation({ mutationFn: () => post<{ invitationToken?: string }>('/admin/users/invite', { email, role }), onSuccess: (data) => { setEmail(''); setInvitationToken(data.invitationToken ?? ''); void query.refetch() } })
  if (selected) return <AdminUserEditor id={selected} onBack={() => setSelected(null)} onSaved={() => { setSelected(null); void query.refetch() }} />
  return <><div className="page-intro"><div><span className="kicker">Governance / least privilege</span><h2>Admin users & roles</h2><p className="muted">Super Admin, catalog, content, order, support and analyst roles.</p></div></div><form className="panel invite-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="admin@skinfox.com" /></label><label>Role<select value={role} onChange={(event) => setRole(event.target.value as AdminRole)}>{(['CATALOG_MANAGER', 'CONTENT_EDITOR', 'ORDER_MANAGER', 'SUPPORT_AGENT', 'ANALYST'] as AdminRole[]).map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label><button className="primary-button" disabled={mutation.isPending}><Plus size={17} />{mutation.isPending ? 'Inviting…' : 'Invite user'}</button></form>{mutation.isError && <div className="alert alert--error" role="alert">{mutation.error instanceof Error ? mutation.error.message : 'Unable to invite this user.'}</div>}{mutation.isSuccess && <div className="alert alert--success" role="status"><Check size={16} />Invitation created successfully.{invitationToken && <><code className="invite-token">{invitationToken}</code><a className="invite-link" href={`/?invitation=${encodeURIComponent(invitationToken)}`}>Open invitation setup</a></>}</div>}{query.isLoading ? <TableSkeleton /> : query.isError ? <ErrorPanel onRetry={() => query.refetch()} /> : <DataTable rows={query.data ?? []} fields={['name', 'email', 'role', 'isActive', 'mfaRequired']} onRow={(row) => setSelected(row.id)} />}</>
}

function AdminUserEditor({ id, onBack, onSaved }: { id: string; onBack: () => void; onSaved: () => void }) {
  const query = useQuery({ queryKey: ['admin-user', id], queryFn: () => get<AdminUser>(`/admin/users/${id}`) })
  const [name, setName] = useState('')
  const [role, setRole] = useState<AdminRole>('SUPPORT_AGENT')
  const [active, setActive] = useState(true)
  const [mfaRequired, setMfaRequired] = useState(true)
  useEffect(() => { if (query.data) { setName(query.data.name); setRole(query.data.role); setActive(query.data.isActive !== false); setMfaRequired(Boolean(query.data.mfaRequired)) } }, [query.data])
  const mutation = useMutation({ mutationFn: () => patch(`/admin/users/${id}`, { name, role, isActive: active, mfaRequired }), onSuccess: onSaved })
  const action = useMutation({ mutationFn: (kind: 'suspend' | 'activate' | 'revoke-sessions') => post(`/admin/users/${id}/${kind}`, {}), onSuccess: () => query.refetch() })
  if (query.isLoading) return <TableSkeleton />
  if (query.isError) return <ErrorPanel onRetry={() => query.refetch()} />
  return <><div className="editor-top"><button className="back-button" onClick={onBack}><ArrowLeft size={16} /> Admin users</button><div><span className="kicker">User access</span><h2>{query.data?.email}</h2></div><button className="primary-button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save access'} <Check size={16} /></button></div><section className="panel editor-form"><div className="form-grid"><label>Name<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} /></label><label>Role<select value={role} onChange={(event) => setRole(event.target.value as AdminRole)}>{(['SUPER_ADMIN', 'CATALOG_MANAGER', 'CONTENT_EDITOR', 'ORDER_MANAGER', 'SUPPORT_AGENT', 'ANALYST'] as AdminRole[]).map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label><label>Active<select value={String(active)} onChange={(event) => setActive(event.target.value === 'true')}><option value="true">Active</option><option value="false">Suspended</option></select></label><label>MFA required<select value={String(mfaRequired)} onChange={(event) => setMfaRequired(event.target.value === 'true')}><option value="true">Required</option><option value="false">Optional</option></select></label></div><div className="page-actions"><button className="secondary-button" onClick={() => action.mutate(active ? 'suspend' : 'activate')} disabled={action.isPending}>{active ? 'Suspend user' : 'Activate user'}</button><button className="secondary-button" onClick={() => action.mutate('revoke-sessions')} disabled={action.isPending}>Revoke sessions</button></div>{(mutation.isError || action.isError) && <div className="alert alert--error" role="alert">Unable to update this admin user.</div>}</section></>
}

function CareFinder() {
  const query = useQuery({ queryKey: ['care-finder'], queryFn: () => get<Resource>('/care-finder') })
  const [manage, setManage] = useState<ResourceConfig | null>(null)
  const [settings, setSettings] = useState(false)
  if (manage) return <><button className="back-button" onClick={() => setManage(null)}><ArrowLeft size={16} /> Care finder overview</button><ResourceView {...manage} /></>
  if (settings && query.data) return <><button className="back-button" onClick={() => setSettings(false)}><ArrowLeft size={16} /> Care finder overview</button><FinderConfigEditor finder={query.data} onSaved={() => { setSettings(false); void query.refetch() }} /></>
  const questions = Array.isArray(query.data?.questions) ? query.data.questions as Resource[] : []
  const rules = Array.isArray(query.data?.rules) ? query.data.rules as Resource[] : []
  const reviewCount = rules.filter((rule) => (rule.metadata as Record<string, unknown> | undefined)?.guidanceStatus !== 'approved').length
  const questionTemplate = { careFinderId: 'default-care-finder', key: '', prompt: '', sortOrder: 0, selectionMode: 'single', required: true, condition: null }
  return <><div className="page-intro"><div><span className="kicker">Weighted recommendations / coverage</span><h2>Care finder builder</h2><p className="muted">Questions, branching, package copy and guidance are database-managed; storefront recommendations use the same rules.</p></div><div className="page-actions"><button className="secondary-button" onClick={() => query.refetch()}>Refresh <Activity size={16} /></button><button className="secondary-button" onClick={() => setSettings(true)}><Pencil size={16} /> Edit experience</button><button className="primary-button" onClick={() => setManage({ endpoint: '/admin/care-finder/questions', title: 'Care finder questions', fields: ['key', 'prompt', 'sortOrder', 'selectionMode', 'required', 'condition'], createTemplate: questionTemplate })}><Pencil size={16} /> Manage questions</button></div></div>{query.isLoading ? <TableSkeleton /> : query.isError ? <ErrorPanel onRetry={() => query.refetch()} /> : <><div className="metric-grid finder-metrics"><article className="metric-card"><span>Questions</span><strong>{questions.length}</strong><small>Branching questions live</small></article><article className="metric-card"><span>Rules</span><strong>{rules.length}</strong><small>Weighted product matches</small></article><article className="metric-card"><span>Guidance review</span><strong>{reviewCount}</strong><small>Require final brand approval</small></article></div><div className="panel"><div className="panel-heading"><div><span className="kicker">{String(query.data?.name ?? 'Active finder')}</span><h3>Consultation flow</h3></div><Sparkles size={19} /></div>{questions.map((question) => <div className="finder-row" key={question.id}><span className="avatar avatar--lilac">{String(Number(question.sortOrder ?? 0) + 1).padStart(2, '0')}</span><span><strong>{String(question.prompt)}</strong><small>{Array.isArray(question.options) ? `${question.options.length} options` : 'Options configured'} · {question.selectionMode === 'multi' ? 'multi-select' : 'single-select'}{question.required === false ? ' · optional' : ''}</small></span><button className="icon-button" aria-label={`Edit ${String(question.key ?? 'question')}`} onClick={() => setManage({ endpoint: '/admin/care-finder/questions', title: 'Care finder questions', fields: ['key', 'prompt', 'sortOrder', 'selectionMode', 'required', 'condition'], createTemplate: questionTemplate })}><Pencil size={16} /></button></div>)}<div className="page-actions"><button className="secondary-button" onClick={() => setManage({ endpoint: '/admin/care-finder/options', title: 'Care finder options', fields: ['questionId', 'value', 'label', 'description', 'sortOrder', 'condition'], createTemplate: { questionId: '', value: '', label: '', description: '', sortOrder: 0, condition: null } })}>Manage options</button><button className="secondary-button" onClick={() => setManage({ endpoint: '/admin/care-finder/rules', title: 'Care finder rules', fields: ['careFinderId', 'answerKey', 'answerValue', 'productId', 'weight', 'metadata'], createTemplate: { careFinderId: 'default-care-finder', answerKey: '', answerValue: '', productId: '', weight: 1, metadata: { role: 'essential', reason: '', frequency: 'As directed on pack', days: ['As directed'], timeOfDay: 'As directed', instructions: 'Follow the final product pack directions.', guidanceStatus: 'needs_review' } } })}>Manage rules</button></div></div></>}</>
}

function FinderConfigEditor({ finder, onSaved }: { finder: Resource; onSaved: () => void }) {
  const config = finder.config && typeof finder.config === 'object' && !Array.isArray(finder.config) ? finder.config : {}
  const [name, setName] = useState(String(finder.name ?? 'SkinFox personalised care finder'))
  const [value, setValue] = useState(JSON.stringify(config, null, 2))
  const mutation = useMutation({ mutationFn: () => { const parsed: unknown = JSON.parse(value); if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Finder configuration must be a JSON object.'); return patch(`/admin/care-finder/${finder.id}`, { name, config: parsed }) }, onSuccess: onSaved })
  return <><div className="page-intro"><div><span className="kicker">Customer consultation / experience copy</span><h2>Edit finder experience</h2><p className="muted">Update package names, introduction, disclaimer and guidance notes. Usage directions remain pack-directed until approved.</p></div><button className="primary-button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save experience'} <Check size={16} /></button></div><section className="panel json-editor-panel"><label className="stack-form"><span>Finder name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label><label className="stack-form"><span>Experience configuration JSON</span><textarea aria-label="Care finder experience JSON" className="settings-editor json-record-editor" value={value} onChange={(event) => setValue(event.target.value)} spellCheck={false} /></label><p className="fine-print">Use <code>packageNames</code> for area-specific names, plus <code>resultDescription</code>, <code>disclaimer</code> and <code>guidanceNote</code>. JSON is validated before persistence.</p>{mutation.isError && <div className="alert alert--error" role="alert">{mutation.error instanceof Error ? mutation.error.message : 'Unable to save finder experience.'}</div>}{mutation.isSuccess && <div className="alert alert--success" role="status">Finder experience saved.</div>}</section></>
}

function SettingsView() { const [section, setSection] = useState('store'); const query = useQuery({ queryKey: ['setting', section], queryFn: () => get<Record<string, unknown>>(`/admin/settings/${section}`) }); const [value, setValue] = useState('{}'); useEffect(() => { setValue(JSON.stringify(query.data ?? {}, null, 2)) }, [query.data]); const mutation = useMutation({ mutationFn: () => { const parsed: unknown = JSON.parse(value); if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Settings must be a JSON object.'); return patch(`/admin/settings/${section}`, parsed) }, onSuccess: () => query.refetch() }); if (query.isError) return <ErrorPanel onRetry={() => query.refetch()} />; return <><div className="page-intro"><div><span className="kicker">Configuration / secrets stay server-side</span><h2>Settings</h2><p className="muted">Store, payment, shipping, notifications, integrations and feature flags.</p></div><button className="primary-button" onClick={() => mutation.mutate()} disabled={mutation.isPending || query.isLoading}><Check size={16} /> {mutation.isPending ? 'Saving…' : 'Save settings'}</button></div><div className="settings-layout"><nav className="settings-nav" aria-label="Settings sections">{['store', 'payments', 'shipping', 'notifications', 'integrations', 'features'].map((item) => <button className={section === item ? 'is-active' : ''} key={item} onClick={() => { mutation.reset(); setSection(item) }}>{item}</button>)}</nav><section className="panel"><span className="kicker">{section}</span><h3>JSON configuration</h3>{query.isLoading ? <TableSkeleton /> : <textarea aria-label={`${section} settings JSON`} className="settings-editor" value={value} onChange={(event) => value !== event.target.value && setValue(event.target.value)} spellCheck={false} />}<p className="fine-print">Secrets are managed through server environment variables and are never stored through this editor. Invalid JSON is rejected before persistence.</p>{mutation.isError && <div className="alert alert--error" role="alert">{mutation.error instanceof Error ? mutation.error.message : 'Invalid configuration. Check JSON and try again.'}</div>}{mutation.isSuccess && <div className="alert alert--success" role="status"><Check size={16} />Settings saved.</div>}</section></div></> }

function ResourceView({ endpoint, title, fields, createTemplate }: ResourceConfig) {
  const [search, setSearch] = useTableSearch()
  const [editor, setEditor] = useState<Resource | 'new' | null>(null)
  const query = useQuery({ queryKey: ['resource', endpoint, search], queryFn: () => get<Resource[]>(withSearch(`${endpoint}?limit=100`, search)) })
  const readOnly = endpoint === '/admin/dashboard/sales' || endpoint === '/admin/audit-logs'
  if (editor) return <ResourceEditor endpoint={endpoint} title={title} template={createTemplate} record={editor === 'new' ? undefined : editor} onBack={() => setEditor(null)} onSaved={() => { setEditor(null); void query.refetch() }} />
  return <><div className="page-intro"><div><span className="kicker">Database-backed workspace</span><h2>{title}</h2><p className="muted">Create, edit, archive and search records with server validation.</p></div><div className="page-actions"><button className="secondary-button" onClick={() => query.refetch()}>Refresh <Activity size={16} /></button>{!readOnly && <button className="primary-button" onClick={() => setEditor('new')}><Plus size={17} /> New record</button>}</div></div>{query.isLoading ? <TableSkeleton /> : query.isError ? <ErrorPanel onRetry={() => query.refetch()} /> : query.data?.length || search ? <DataTable rows={query.data ?? []} fields={fields} onRow={readOnly ? undefined : (row) => setEditor(row)} searchValue={search} onSearch={setSearch} /> : <EmptyPanel title={`No ${title.toLowerCase()} yet`} action={!readOnly ? <button className="secondary-button" onClick={() => setEditor('new')}><Plus size={16} /> Create first record</button> : undefined} />}</>
}

function ResourceEditor({ endpoint, title, template, record, onBack, onSaved }: { endpoint: string; title: string; template?: Record<string, unknown>; record?: Resource; onBack: () => void; onSaved: () => void }) {
  const initial = record ? editableSnapshot(record) : (template ?? {})
  const [value, setValue] = useState(JSON.stringify(initial, null, 2))
  const mutation = useMutation({ mutationFn: async () => {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Record must be a JSON object.')
    return record ? patch(`${endpoint}/${record.id}`, parsed) : post(endpoint, parsed)
  }, onSuccess: onSaved })
  const archive = useMutation({ mutationFn: () => remove(`${endpoint}/${record?.id}`), onSuccess: onSaved })
  return <><div className="editor-top"><button className="back-button" onClick={onBack}><ArrowLeft size={16} /> {title}</button><div><span className="kicker">{record ? 'Edit record' : 'New record'}</span><h2>{record ? String(record.name ?? record.title ?? record.email ?? 'Record') : `Create ${title.toLowerCase()}`}</h2></div><div className="page-actions">{record && <button className="danger-button" type="button" onClick={() => { if (window.confirm(`Archive this ${title.toLowerCase()} record?`)) archive.mutate() }} disabled={archive.isPending}>Archive</button>}<button className="primary-button" type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save record'} <Check size={16} /></button></div></div><section className="panel json-editor-panel"><p className="muted">Edit the JSON fields accepted by the API. IDs and timestamps are managed by the server.</p><textarea aria-label={`${title} JSON record`} className="settings-editor json-record-editor" value={value} onChange={(event) => setValue(event.target.value)} spellCheck={false} />{(mutation.isError || archive.isError) && <div className="alert alert--error" role="alert">{String((mutation.error ?? archive.error) instanceof Error ? (mutation.error ?? archive.error) : 'Unable to save this record.')}</div>}</section></>
}

function editableSnapshot(record: Resource) {
  const blocked = new Set(['id', 'createdAt', 'updatedAt', 'archivedAt'])
  return Object.fromEntries(Object.entries(record).filter(([key, value]) => {
    if (blocked.has(key) || value === undefined) return false
    if (value && typeof value === 'object' && !Array.isArray(value) && 'id' in (value as Record<string, unknown>)) return false
    return true
  }))
}
function tableFieldLabel(field: string) {
  if (field === 'waitlistId') return 'Waitlist ID'
  if (field === 'founderNumber') return 'Waitlist number'
  return field.replace(/([A-Z])/g, ' $1')
}

function renderTableCell(value: unknown, field: string) {
  const formatted = formatAdminCell(value, field)
  if (field === 'waitlistId' && formatted !== '—') return <code className="table-id">{formatted}</code>
  if (field === 'founderNumber' && formatted !== '—') return <span className="waitlist-number-badge">#{formatted}</span>
  if (field === 'status' || field === 'refundStatus') {
    if (formatted === '—') return <span className="table-muted">—</span>
    const state = formatted.toLowerCase().replaceAll(' ', '-')
    return <span className={`status-chip status-chip--${state}`}>{formatted}</span>
  }
  if (field === 'createdAt' && typeof value === 'string') {
    const date = new Date(value)
    if (!Number.isNaN(date.valueOf())) return <time dateTime={value}>{new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)}</time>
  }
  return formatted
}

function DataTable({ rows, fields, onRow, searchValue = '', onSearch }: { rows: Resource[]; fields: string[]; onRow?: (row: Resource) => void; searchValue?: string; onSearch?: (value: string) => void }) {
  const visibleRows = filterRows(rows, fields, searchValue)
  const isWaitlistTable = fields.includes('waitlistId')
  const openRow = (event: KeyboardEvent<HTMLTableRowElement>, row: Resource) => { if (!onRow || !['Enter', ' '].includes(event.key)) return; event.preventDefault(); onRow(row) }
  return <div className={`panel table-panel ${isWaitlistTable ? 'table-panel--waitlist' : ''}`}>
    <div className="table-toolbar"><label className="search-box"><Search size={16} aria-hidden="true" /><span className="sr-only">Search this view</span><input aria-label="Search this view" placeholder="Search this view" value={searchValue} onChange={(event) => onSearch?.(event.target.value)} /></label><span className="table-count" aria-live="polite">{visibleRows.length} {visibleRows.length === 1 ? 'record' : 'records'}</span></div>
    <div className="table-wrap"><table className={isWaitlistTable ? 'admin-data-table--waitlist' : 'admin-data-table'}><thead><tr>{fields.map((field) => <th key={field} scope="col" className={`table-cell--${field}`}>{tableFieldLabel(field)}</th>)}{onRow && <th aria-label="Actions" />}</tr></thead><tbody>{visibleRows.map((row) => <tr key={row.id} onClick={() => onRow?.(row)} onKeyDown={(event) => openRow(event, row)} tabIndex={onRow ? 0 : undefined} aria-label={onRow ? `Open ${String(row.name ?? row.orderNumber ?? row.title ?? 'record')}` : undefined} className={onRow ? 'is-clickable' : ''}>{fields.map((field) => <td key={field} data-label={tableFieldLabel(field)} className={`table-cell--${field}`}>{renderTableCell(row[field], field)}</td>)}{onRow && <td><ChevronRight size={16} aria-hidden="true" /></td>}</tr>)}{!visibleRows.length && <tr><td className="table-empty" colSpan={fields.length + (onRow ? 1 : 0)}>No records match “{searchValue}”.</td></tr>}</tbody></table></div>
  </div>
}
function SkeletonCards() { return <div className="metric-grid">{[1, 2, 3, 4].map((item) => <div className="metric-card skeleton" key={item} />)}</div> }
function TableSkeleton() { return <div className="panel skeleton-table">{[1, 2, 3, 4, 5].map((item) => <div key={item} />)}</div> }
function ErrorPanel({ onRetry }: { onRetry: () => void }) { return <div className="panel empty-panel"><CircleAlert size={26} /><h3>We couldn’t load this view.</h3><p className="muted">The API may be starting or unavailable. Your data is safe.</p><button className="secondary-button" onClick={onRetry}>Try again</button></div> }
function EmptyPanel({ title, action }: { title: string; action?: ReactNode }) { return <div className="panel empty-panel"><ClipboardList size={26} /><h3>{title}</h3><p className="muted">Create the first record to see it here.</p>{action}</div> }

export default App

import { Clipboard, Gift, HandCoins, Link2, LogOut, ShieldCheck, WalletCards } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { get, post } from './api'

type Affiliate = { id: string; fullName: string; email?: string | null; phone: string; panLast4: string; payoutUpiId?: string | null; status: 'pending' | 'approved' | 'rejected' | 'suspended'; referralCode: string; approvedAt?: string | null; rejectionReason?: string | null }
type Dashboard = { affiliate: Affiliate; wallet: { balancePaise: number; minimumRedemptionPaise: number; commissionRatePercent: number }; referral: { code: string; clicks: number; confirmedOrders: number }; walletEntries: Array<{ id: string; type: string; amountPaise: number; description: string; createdAt: string; attribution?: { order?: { orderNumber: string } } | null }>; redemptionRequests: Array<{ id: string; amountPaise: number; status: string; createdAt: string; note?: string | null }> }

const money = (value: number) => `₹${(value / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const storefrontOrigin = () => import.meta.env.VITE_STOREFRONT_URL ?? `${window.location.protocol}//${window.location.hostname}:4173`
function AffiliateBrand() { return <div className="brand"><img className="brand__logo" src="/brand/skinfox-logo.png" alt="SkinFox" /><small>AFFILIATE PARTNERS</small></div> }

export default function App() {
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null)
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const response = await get<{ affiliate: Affiliate | null }>('/affiliate/auth/me')
    setAffiliate(response.affiliate)
    if (response.affiliate) setDashboard(await get<Dashboard>('/affiliate/dashboard'))
    else setDashboard(null)
  }
  useEffect(() => { void refresh().catch(() => undefined).finally(() => setLoading(false)) }, [])

  const logout = async () => { await post('/affiliate/auth/logout', {}); setAffiliate(null); setDashboard(null) }
  if (loading) return <main className="loading"><img className="loading__logo" src="/brand/skinfox-logo.png" alt="SkinFox" /><span className="loader" />Loading SkinFox affiliates…</main>
  if (!affiliate) return <ApplicantPortal onAuthenticated={(nextAffiliate, nextDashboard) => { setAffiliate(nextAffiliate); setDashboard(nextDashboard) }} />
  if (!dashboard) return <main className="loading"><span className="loader" />Loading your dashboard…</main>
  if (affiliate.status !== 'approved') return <PendingScreen affiliate={affiliate} onLogout={logout} />
  return <ApprovedDashboard dashboard={dashboard} onLogout={logout} onRedeemed={refresh} />
}

function ApplicantPortal({ onAuthenticated }: { onAuthenticated: (affiliate: Affiliate, dashboard: Dashboard) => void }) {
  const [mode, setMode] = useState<'login' | 'apply'>('login')
  const [phone, setPhone] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [otp, setOtp] = useState('')
  const [testCode, setTestCode] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitLogin = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(''); try { if (!challengeId) { const response = await post<{ challengeId: string; testOtpCode?: string }>('/affiliate/auth/request-otp', { phone }); setChallengeId(response.challengeId); setTestCode(response.testOtpCode ?? ''); setNotice('OTP sent. Enter the six-digit code to continue.'); } else { const response = await post<{ affiliate: Affiliate }>('/affiliate/auth/verify-otp', { challengeId, phone, code: otp }); const dashboard = await get<Dashboard>('/affiliate/dashboard'); onAuthenticated(response.affiliate, dashboard) } } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to continue.') } finally { setBusy(false) } }
  return <main className="portal"><header><AffiliateBrand /></header><section className="hero"><div><span className="eyebrow"><HandCoins size={15} /> Affiliate programme</span><h1>Share care.<br /><em>Earn fairly.</em></h1><p>Give your community a SkinFox link. Approved partners receive 10% of the discounted product selling value from confirmed referral orders.</p><div className="promise"><ShieldCheck size={18} /><span>Applications are reviewed before referral links are activated. PAN is encrypted and only its last four characters are shown back to you.</span></div></div><div className="auth-card"><div className="tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>Sign in</button><button className={mode === 'apply' ? 'active' : ''} onClick={() => { setMode('apply'); setError(''); }}>Join programme</button></div>{mode === 'login' ? <form className="stack" onSubmit={submitLogin}><h2>Partner sign in</h2><p>Use the mobile number from your application.</p><label>Mobile number<input value={phone} onChange={(event) => setPhone(event.target.value)} required inputMode="tel" placeholder="10-digit mobile number" disabled={Boolean(challengeId)} /></label>{challengeId && <label>Six-digit OTP<input value={otp} onChange={(event) => setOtp(event.target.value)} required inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder="123456" /></label>}{testCode && <div className="test-note">Local test OTP: <strong>{testCode}</strong></div>}{notice && <div className="notice">{notice}</div>}{error && <div className="error">{error}</div>}<button className="primary" disabled={busy}>{busy ? 'Please wait…' : challengeId ? 'Verify and open dashboard' : 'Send OTP'}</button>{challengeId && <button type="button" className="link-button" onClick={() => { setChallengeId(''); setOtp(''); setTestCode(''); }}>Use another number</button>}</form> : <ApplicationForm onComplete={(message) => { setMode('login'); setNotice(message); setChallengeId(''); setOtp('') }} />}</div></section></main>
}

function ApplicationForm({ onComplete }: { onComplete: (message: string) => void }) {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', pan: '', whatsappNumber: '', city: '', state: '', payoutUpiId: '', acceptedTerms: false })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); setBusy(true); try { await post('/affiliate/applications', form); onComplete('Application received. Sign in with the same mobile number to track its approval.') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to submit your application.') } finally { setBusy(false) } }
  return <form className="stack application" onSubmit={submit}><h2>Join SkinFox affiliates</h2><p>We use these details to review and pay your commissions. Use only your own tax and payout information.</p><label>Full name<input value={form.fullName} onChange={(event) => set('fullName', event.target.value)} required minLength={2} /></label><label>Email <small>optional</small><input type="email" value={form.email} onChange={(event) => set('email', event.target.value)} /></label><label>Mobile number<input value={form.phone} onChange={(event) => set('phone', event.target.value)} required inputMode="tel" placeholder="10-digit mobile number" /></label><label>PAN<input value={form.pan} onChange={(event) => set('pan', event.target.value.toUpperCase())} required pattern="[A-Z]{5}[0-9]{4}[A-Z]" placeholder="ABCDE1234F" /><small>Encrypted at rest; not shown in full after submission.</small></label><label>WhatsApp number <small>optional</small><input value={form.whatsappNumber} onChange={(event) => set('whatsappNumber', event.target.value)} inputMode="tel" /></label><div className="two"><label>City <small>optional</small><input value={form.city} onChange={(event) => set('city', event.target.value)} /></label><label>State <small>optional</small><input value={form.state} onChange={(event) => set('state', event.target.value)} /></label></div><label>UPI ID for payout <small>optional</small><input value={form.payoutUpiId} onChange={(event) => set('payoutUpiId', event.target.value)} placeholder="name@bank" /></label><label className="check"><input type="checkbox" checked={form.acceptedTerms} onChange={(event) => set('acceptedTerms', event.target.checked)} required /><span>I confirm these details are mine and agree to the affiliate programme review.</span></label>{error && <div className="error">{error}</div>}<button className="primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</button></form>
}

function PendingScreen({ affiliate, onLogout }: { affiliate: Affiliate; onLogout: () => Promise<void> }) {
  const headline = affiliate.status === 'rejected' ? 'Application needs attention.' : affiliate.status === 'suspended' ? 'Account temporarily paused.' : 'Application under review.'
  return <main className="portal"><header><AffiliateBrand /></header><section className="status-card"><ShieldCheck size={30} /><span className="eyebrow">Affiliate application</span><h1>{headline}</h1><p>{affiliate.status === 'pending' ? 'Your referral link activates only after the SkinFox team approves your application.' : affiliate.rejectionReason ?? 'Please contact SkinFox support for the next step.'}</p><div className="detail"><span>Name</span><strong>{affiliate.fullName}</strong></div><div className="detail"><span>Masked PAN</span><strong>••••{affiliate.panLast4}</strong></div><button className="link-button" onClick={() => void onLogout()}><LogOut size={16} /> Sign out</button></section></main>
}

function ApprovedDashboard({ dashboard, onLogout, onRedeemed }: { dashboard: Dashboard; onLogout: () => Promise<void>; onRedeemed: () => Promise<void> }) {
  const [copied, setCopied] = useState(false)
  const [amount, setAmount] = useState('')
  const [upi, setUpi] = useState(dashboard.affiliate.payoutUpiId ?? '')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const shareLink = useMemo(() => `${storefrontOrigin()}/?ref=${dashboard.referral.code}`, [dashboard.referral.code])
  const copy = async () => {
    try {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareLink)
      } else {
        const field = document.createElement('textarea')
        field.value = shareLink
        field.setAttribute('readonly', '')
        field.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
        document.body.append(field)
        field.focus()
        field.select()
        const copied = document.execCommand('copy')
        field.remove()
        if (!copied) throw new Error('Copy command was blocked.')
      }
      setCopyMessage('')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopyMessage('Automatic copying is blocked by this browser. Select the link and press Ctrl/Cmd + C.')
    }
  }
  const redeem = async (event: FormEvent) => { event.preventDefault(); setError(''); setNotice(''); const amountPaise = Math.round(Number(amount) * 100); try { await post('/affiliate/wallet/redemptions', { amountPaise, payoutUpiId: upi || undefined }); setAmount(''); setNotice('Redemption request submitted for SkinFox operations review.'); await onRedeemed() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to request redemption.') } }
  return <main className="dashboard"><header className="dash-header"><AffiliateBrand /><div><span>Hi, {dashboard.affiliate.fullName.split(' ')[0]}</span><button className="link-button" onClick={() => void onLogout()}><LogOut size={16} /> Sign out</button></div></header><section className="dash-intro"><span className="eyebrow">Your partner dashboard</span><h1>Make care travel further.</h1><p>Earn {dashboard.wallet.commissionRatePercent}% on confirmed referral orders. Wallet redemptions start at {money(dashboard.wallet.minimumRedemptionPaise)}.</p></section><section className="metrics"><article><WalletCards size={20} /><span>Available wallet</span><strong>{money(dashboard.wallet.balancePaise)}</strong></article><article><Link2 size={20} /><span>Referral link clicks</span><strong>{dashboard.referral.clicks}</strong></article><article><Gift size={20} /><span>Confirmed orders</span><strong>{dashboard.referral.confirmedOrders}</strong></article></section><section className="share-card"><div><span className="eyebrow">Your referral link</span><h2>Share your SkinFox edit.</h2><p>Orders placed from this link are attributed to you when the customer checks out.</p></div><div><div className="share-row"><input aria-label="Referral link" value={shareLink} readOnly onFocus={(event) => event.currentTarget.select()} /><button className="primary" onClick={() => void copy()}><Clipboard size={16} />{copied ? 'Copied' : 'Copy link'}</button></div>{copyMessage && <small className="copy-help">{copyMessage}</small>}</div></section><section className="dash-grid"><article className="panel"><span className="eyebrow">Wallet activity</span><h2>Commission ledger</h2>{dashboard.walletEntries.length ? <div className="ledger">{dashboard.walletEntries.map((entry) => <div key={entry.id}><span><strong>{entry.type.replaceAll('_', ' ')}</strong><small>{entry.attribution?.order?.orderNumber ?? entry.description} · {new Date(entry.createdAt).toLocaleDateString('en-IN')}</small></span><b className={entry.amountPaise >= 0 ? 'credit' : 'debit'}>{entry.amountPaise >= 0 ? '+' : '−'}{money(Math.abs(entry.amountPaise))}</b></div>)}</div> : <p className="muted">Your confirmed referral commissions will appear here.</p>}</article><article className="panel"><span className="eyebrow">Redeem wallet</span><h2>Request a payout</h2><p className="muted">Minimum request: {money(dashboard.wallet.minimumRedemptionPaise)}. This creates an internal request; SkinFox operations completes the actual payout offline.</p><form className="stack" onSubmit={redeem}><label>Amount (₹)<input type="number" min="500" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label><label>UPI ID <small>optional</small><input value={upi} onChange={(event) => setUpi(event.target.value)} placeholder="name@bank" /></label>{error && <div className="error">{error}</div>}{notice && <div className="notice">{notice}</div>}<button className="primary" disabled={dashboard.wallet.balancePaise < dashboard.wallet.minimumRedemptionPaise}>Request payout</button></form><div className="requests">{dashboard.redemptionRequests.map((request) => <div key={request.id}><span>{money(request.amountPaise)} · {new Date(request.createdAt).toLocaleDateString('en-IN')}</span><strong>{request.status}</strong></div>)}</div></article></section></main>
}

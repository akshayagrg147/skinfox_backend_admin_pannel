import { ArrowLeft, Eye, EyeOff, KeyRound, LoaderCircle, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react'
import { FormEvent, useState } from 'react'
import {
  createEmailPasswordAccount,
  exchangeFirebaseUser,
  firebaseAuthConfigured,
  firebaseAuthErrorMessage,
  requestPasswordReset,
  signInWithEmailPassword,
  signInWithGoogle,
} from '../lib/firebaseAuth'

export type CustomerAuthCustomer = { id: string; fullName: string; email?: string | null; phone?: string | null; phoneVerified?: boolean; emailVerified?: boolean; founderNumber?: number | null; founderJoinedAt?: string | null; createdAt?: string }
export type CustomerAuthResponse = { customer: CustomerAuthCustomer; provider?: string; requiresEmailVerification?: boolean }

type AuthMode = 'signin' | 'signup' | 'reset'

export function CustomerAuthForm({ apiAvailable, cartToken, destination, onAuthenticated }: { apiAvailable: boolean; cartToken?: string; destination: 'account' | 'checkout' | 'waitlist'; onAuthenticated: (response: CustomerAuthResponse) => Promise<void> | void }) {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const changeMode = (next: AuthMode) => {
    setMode(next)
    setError('')
    setNotice('')
    setPhone('')
    setPassword('')
    setConfirmation('')
  }

  const authenticate = async (credentialUser: Parameters<typeof exchangeFirebaseUser>[0], profilePhone?: string) => {
    if (!apiAvailable) throw new Error('Customer accounts are temporarily unavailable. Please try again shortly.')
    await onAuthenticated(await exchangeFirebaseUser<CustomerAuthResponse>(credentialUser, cartToken || undefined, false, profilePhone ? { phone: profilePhone } : undefined))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setError('')
    setNotice('')
    if (mode === 'reset') {
      setBusy(true)
      try {
        await requestPasswordReset(email)
        setNotice('If an account exists for that email, reset instructions are on their way. Check spam or promotions too.')
      } catch (cause) {
        setError(firebaseAuthErrorMessage(cause, 'We could not send reset instructions. Please try again.'))
      } finally { setBusy(false) }
      return
    }
    if (mode === 'signup' && password !== confirmation) {
      setError('Passwords do not match.')
      return
    }
    const normalizedPhone = phone.replace(/\D/g, '')
    if (mode === 'signup' && !/^[6-9]\d{9}$/.test(normalizedPhone)) {
      setError('Enter a valid 10-digit Indian mobile number.')
      return
    }
    setBusy(true)
    try {
      const credential = mode === 'signup'
        ? await createEmailPasswordAccount(name, email, password)
        : await signInWithEmailPassword(email, password)
      await authenticate(credential.user, mode === 'signup' ? normalizedPhone : undefined)
    } catch (cause) {
      setError(firebaseAuthErrorMessage(cause, mode === 'signup' ? 'We could not create your account. Please try again.' : 'We could not sign you in. Please try again.'))
    } finally { setBusy(false) }
  }

  const google = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const credential = await signInWithGoogle({ destination, ...(cartToken ? { cartToken } : {}) })
      if (credential) await authenticate(credential.user)
    } catch (cause) {
      setError(firebaseAuthErrorMessage(cause, 'We could not sign you in with Google. Please try again.'))
    } finally { setBusy(false) }
  }

  const title = mode === 'signup' ? 'Create your account.' : mode === 'reset' ? 'Reset your password.' : 'Welcome back.'
  const submitLabel = mode === 'signup' ? 'Create account' : 'Sign in'

  return <div className="customer-auth-form">
    <div className="customer-auth-form__intro">
      <span className="eyebrow"><UserRound size={14} /> SkinFox account</span>
      <h2>{title}</h2>
      <p>{mode === 'signup' ? 'A little less to fill in next time. Save delivery details and follow your orders in one place.' : mode === 'reset' ? 'Enter your email and we’ll send you a link to choose a new password.' : destination === 'checkout' ? 'Sign in to continue to delivery and keep your order connected to your account.' : destination === 'waitlist' ? 'Sign in to reserve priority launch access and keep your waitlist payment connected to your account.' : 'Your orders, delivery details and everyday care, all in one place.'}</p>
    </div>
    {!firebaseAuthConfigured && <p className="auth-config-note" role="status">Sign-in is temporarily unavailable. Please try again later or contact <a href="mailto:contact@skinfox.in">our support team</a>.</p>}
    {!apiAvailable && <p className="auth-config-note" role="status">We’re having trouble connecting to your account. Please try again shortly.</p>}
    {mode !== 'reset' && <>
      <button className="button button--dark account-submit customer-google-button" disabled={busy} type="button" onClick={() => void google()}><span className="google-glyph" aria-hidden="true">G</span>{busy ? 'Connecting…' : 'Continue with Google'}</button>
      <div className="auth-divider"><span>or continue with email</span></div>
    </>}
    <form onSubmit={submit} noValidate aria-busy={busy}>
      {mode === 'signup' && <label className="account-field"><span>Full name</span><div className="auth-input-wrap"><UserRound size={16} aria-hidden="true" /><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required minLength={2} placeholder="Your name" /></div></label>}
      {mode === 'signup' && <label className="account-field"><span>Mobile number</span><div className="auth-input-wrap"><Phone size={16} aria-hidden="true" /><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="tel" autoComplete="tel" required placeholder="9876543210" /></div><small className="account-field__hint">For delivery updates about your order.</small></label>}
      <label className="account-field"><span>Email address</span><div className="auth-input-wrap"><Mail size={16} aria-hidden="true" /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="you@example.com" /></div></label>
      {mode !== 'reset' && <label className="account-field"><span>Password</span><div className="auth-input-wrap"><KeyRound size={16} aria-hidden="true" /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={8} placeholder="At least 8 characters" /><button type="button" className="auth-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>}
      {mode === 'signup' && <label className="account-field"><span>Confirm password</span><div className="auth-input-wrap"><KeyRound size={16} aria-hidden="true" /><input type={showPassword ? 'text' : 'password'} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required minLength={8} placeholder="Repeat your password" /></div></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="auth-notice" role="status">{notice}</p>}
      <button className="button button--copper account-submit" disabled={busy || !apiAvailable} type="submit">{busy ? <><LoaderCircle size={16} className="auth-spinner" aria-hidden="true" /> Please wait…</> : <><Mail size={16} aria-hidden="true" />{mode === 'reset' ? 'Send reset link' : submitLabel}</>}</button>
    </form>
    <div className="customer-auth-form__links">
      {mode === 'signin' && <><button type="button" className="account-text-button" onClick={() => changeMode('reset')}>Forgot password?</button><span>·</span><button type="button" className="account-text-button" onClick={() => changeMode('signup')}>Create account</button></>}
      {mode === 'signup' && <><span>Already have an account?</span><button type="button" className="account-text-button" onClick={() => changeMode('signin')}>Sign in</button></>}
      {mode === 'reset' && <button type="button" className="account-text-button" onClick={() => changeMode('signin')}><ArrowLeft size={13} /> Back to sign in</button>}
    </div>
    <p className="customer-auth-form__privacy"><ShieldCheck size={15} aria-hidden="true" /><span>Your details are protected. Read our <a href="/privacy-policy">Privacy Policy</a>.</span></p>
  </div>
}

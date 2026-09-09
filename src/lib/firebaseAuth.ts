import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  linkWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
  type UserCredential,
} from 'firebase/auth'
import { postStorefront } from './storefrontApi'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export const firebaseAuthConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId)
let firebaseAuthInstance: ReturnType<typeof getAuth> | null = null
const googleRedirectIntentKey = 'skinfox-google-redirect-intent'

export type GoogleRedirectIntent = { destination: 'account' | 'checkout'; cartToken?: string }

export const getFirebaseAuth = () => {
  if (!firebaseAuthConfigured) throw new Error('Firebase customer authentication is not configured for this storefront.')
  if (firebaseAuthInstance) return firebaseAuthInstance
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  firebaseAuthInstance = getAuth(app)
  return firebaseAuthInstance
}

const actionCodeSettings = () => typeof window === 'undefined' ? undefined : { url: `${window.location.origin}/#account`, handleCodeInApp: false }

export const firebaseAuthErrorMessage = (cause: unknown, fallback = 'We could not complete sign-in. Please try again.') => {
  const code = typeof cause === 'object' && cause && 'code' in cause ? String((cause as { code?: unknown }).code) : ''
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/invalid-login-credentials': 'The email or password is incorrect.',
    'auth/user-disabled': 'This account is disabled. Contact SkinFox support.',
    'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
    'auth/weak-password': 'Choose a stronger password with at least 8 characters.',
    'auth/password-does-not-meet-requirements': 'Choose a stronger password and include a mix of letters and numbers.',
    'auth/too-many-requests': 'Too many attempts. Please wait a little and try again.',
    'auth/popup-closed-by-user': 'The Google sign-in window was closed before completion.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Try again to continue.',
    'auth/account-exists-with-different-credential': 'An account already exists with another sign-in method. Sign in with that method first, then link this one from your account.',
    'auth/network-request-failed': 'The network connection failed. Check your connection and try again.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase yet.',
  }
  return messages[code] ?? fallback
}

export const signInWithEmailPassword = (email: string, password: string) => signInWithEmailAndPassword(getFirebaseAuth(), email.trim().toLowerCase(), password)

export const createEmailPasswordAccount = async (name: string, email: string, password: string) => {
  const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim().toLowerCase(), password)
  if (name.trim()) {
    await updateProfile(credential.user, { displayName: name.trim() })
    // Refresh the ID token so the backend can use the new display name when
    // it creates the SkinFox customer record.
    await credential.user.getIdToken(true)
  }
  try {
    await sendEmailVerification(credential.user, actionCodeSettings())
  } catch {
    // Account creation still succeeds if the verification email provider is
    // temporarily unavailable; the account screen offers a resend action.
  }
  return credential
}

export const requestPasswordReset = (email: string) => sendPasswordResetEmail(getFirebaseAuth(), email.trim().toLowerCase(), actionCodeSettings())

export const resendEmailVerification = async (user?: User | null) => {
  const current = user ?? getFirebaseAuth().currentUser
  if (!current) throw new Error('Sign in again before requesting a verification email.')
  await sendEmailVerification(current, actionCodeSettings())
}

export const refreshFirebaseUser = async () => {
  const auth = getFirebaseAuth()
  const user = auth.currentUser
  if (!user) throw new Error('Your Firebase session has expired. Please sign in again.')
  await reload(user)
  await user.getIdToken(true)
  return user
}

export const linkEmailPassword = async (email: string, password: string) => {
  const auth = getFirebaseAuth()
  const user = auth.currentUser
  if (!user) throw new Error('Sign in before adding email and password login.')
  const credential = await linkWithCredential(user, EmailAuthProvider.credential(email.trim().toLowerCase(), password))
  try { await sendEmailVerification(credential.user, actionCodeSettings()) } catch { /* The account can resend from the dashboard. */ }
  return credential
}

export const signInWithGoogle = async (intent: GoogleRedirectIntent = { destination: 'account' }): Promise<UserCredential | null> => {
  const auth = getFirebaseAuth()
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const useRedirect = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches)
  if (useRedirect) {
    sessionStorage.setItem(googleRedirectIntentKey, JSON.stringify(intent))
    await signInWithRedirect(auth, provider)
    return null
  }
  try {
    return await signInWithPopup(auth, provider)
  } catch (cause) {
    const code = typeof cause === 'object' && cause && 'code' in cause ? String((cause as { code?: unknown }).code) : ''
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      sessionStorage.setItem(googleRedirectIntentKey, JSON.stringify(intent))
      await signInWithRedirect(auth, provider)
      return null
    }
    throw cause
  }
}

export const consumeGoogleRedirect = async (): Promise<{ credential: UserCredential; intent: GoogleRedirectIntent } | null> => {
  if (!firebaseAuthConfigured) return null
  const credential = await getRedirectResult(getFirebaseAuth())
  if (!credential) return null
  let intent: GoogleRedirectIntent = { destination: 'account' }
  try {
    const stored = sessionStorage.getItem(googleRedirectIntentKey)
    if (stored) intent = { ...intent, ...JSON.parse(stored) as GoogleRedirectIntent }
  } catch {
    // Ignore malformed stale redirect state and continue with the account view.
  } finally {
    sessionStorage.removeItem(googleRedirectIntentKey)
  }
  return { credential, intent }
}

export const exchangeFirebaseUser = async <T extends { customer: unknown }>(user: User, cartToken?: string, link = false) => {
  const idToken = await user.getIdToken()
  const csrf = link && typeof document !== 'undefined'
    ? document.cookie.split('; ').find((entry) => entry.startsWith('sf_customer_csrf='))?.split('=').slice(1).join('=')
    : undefined
  const headers = csrf ? { 'x-customer-csrf-token': decodeURIComponent(csrf) } : undefined
  return postStorefront<T>('/customer/auth/firebase', { idToken, ...(cartToken ? { cartToken } : {}), ...(link ? { link: true } : {}) }, headers)
}

export const signOutFirebase = async () => {
  if (firebaseAuthConfigured) await signOut(getFirebaseAuth())
}

import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, RecaptchaVerifier, signInWithPhoneNumber, signInWithPopup, signOut, type ConfirmationResult, type User } from 'firebase/auth'
import { postStorefront } from './storefrontApi'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

// Vitest deliberately exercises the local static OTP fallback; real builds use
// Firebase whenever the public web configuration is present.
export const firebaseAuthConfigured = import.meta.env.MODE !== 'test' && Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId)
let verifier: RecaptchaVerifier | null = null

export const getFirebaseAuth = () => {
  if (!firebaseAuthConfigured) throw new Error('Firebase customer authentication is not configured for this storefront.')
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  return getAuth(app)
}

export const startFirebasePhoneSignIn = async (phone: string, containerId: string): Promise<ConfirmationResult> => {
  const auth = getFirebaseAuth()
  if (typeof document === 'undefined') throw new Error('Phone sign-in is only available in a browser.')
  clearFirebaseRecaptcha()
  const container = document.getElementById(containerId)
  if (!container) throw new Error('Security check could not be loaded. Please refresh and try again.')
  verifier = new RecaptchaVerifier(auth, container, { size: 'invisible' })
  return signInWithPhoneNumber(auth, phone.startsWith('+') ? phone : `+91${phone}`, verifier)
}

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  return signInWithPopup(getFirebaseAuth(), provider)
}

export const exchangeFirebaseUser = async <T extends { customer: unknown }>(user: User, cartToken?: string, link = false) => {
  const idToken = await user.getIdToken()
  return postStorefront<T>('/customer/auth/firebase', { idToken, ...(cartToken ? { cartToken } : {}), ...(link ? { link: true } : {}) })
}

export const clearFirebaseRecaptcha = () => {
  if (!verifier) return
  verifier.clear()
  verifier = null
}

export const signOutFirebase = async () => {
  if (firebaseAuthConfigured) await signOut(getFirebaseAuth())
  clearFirebaseRecaptcha()
}

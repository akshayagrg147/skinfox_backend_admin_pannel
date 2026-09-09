import { applicationDefault, cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type DecodedIdToken, type UserRecord } from 'firebase-admin/auth'

let cachedApp: App | null | undefined

const configuredServiceAccount = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { project_id?: string; client_email?: string; private_key?: string }
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null
    return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key.replace(/\\n/g, '\n') }
  } catch {
    return null
  }
}

export const firebaseAdminIsConfigured = (env: NodeJS.ProcessEnv = process.env) => Boolean(
  // FIREBASE_PROJECT_ID only identifies the project; it is not a credential.
  // On Google Cloud, GOOGLE_CLOUD_PROJECT indicates that ADC is available.
  env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() || env.GOOGLE_APPLICATION_CREDENTIALS?.trim() || env.GOOGLE_CLOUD_PROJECT?.trim(),
)

const getFirebaseApp = (): App | null => {
  if (cachedApp !== undefined) return cachedApp
  if (!firebaseAdminIsConfigured()) {
    cachedApp = null
    return cachedApp
  }
  try {
    cachedApp = getApps().length ? getApp() : (() => {
      const serviceAccount = configuredServiceAccount()
      return serviceAccount
        ? initializeApp({ credential: cert(serviceAccount), projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.projectId })
        : initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID })
    })()
  } catch {
    cachedApp = null
  }
  return cachedApp
}

export const verifyFirebaseIdToken = async (idToken: string, checkRevoked = true): Promise<DecodedIdToken> => {
  const app = getFirebaseApp()
  if (!app) throw new Error('Firebase Admin is not configured')
  return getAuth(app).verifyIdToken(idToken, checkRevoked)
}

export const getFirebaseUserRecord = async (uid: string): Promise<UserRecord> => {
  const app = getFirebaseApp()
  if (!app) throw new Error('Firebase Admin is not configured')
  return getAuth(app).getUser(uid)
}

type Envelope<T> = { data: T; meta?: Record<string, unknown>; error?: { message?: string } }

const apiBase = import.meta.env.VITE_API_URL ?? ''
const csrf = () => document.cookie.split('; ').find((item) => item.startsWith('sf_affiliate_csrf='))?.split('=').slice(1).join('=')

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('accept', 'application/json')
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  if ((init.method ?? 'GET') !== 'GET') { const token = csrf(); if (token) headers.set('x-affiliate-csrf-token', token) }
  const response = await fetch(`${apiBase}/api/v1${path}`, { ...init, headers, credentials: 'include' })
  const payload = await response.json().catch(() => ({})) as Envelope<T>
  if (!response.ok) throw new Error(payload.error?.message ?? `Request failed (${response.status})`)
  return payload.data
}

export const get = <T>(path: string) => request<T>(path)
export const post = <T>(path: string, value: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(value) })

export type ApiEnvelope<T> = { data: T; meta?: { requestId?: string; total?: number; page?: number; limit?: number; hasNextPage?: boolean; [key: string]: unknown } }
const apiBase = import.meta.env.VITE_API_URL ?? ''

export class ApiRequestError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

const csrfToken = () => document.cookie.split('; ').find((item) => item.startsWith('sf_csrf='))?.split('=').slice(1).join('=')

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const method = init.method ?? 'GET'
  const headers = new Headers(init.headers)
  headers.set('accept', 'application/json')
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  if (method !== 'GET') { const csrf = csrfToken(); if (csrf) headers.set('x-csrf-token', csrf) }
  const response = await fetch(`${apiBase}/api/v1${path}`, { ...init, headers, credentials: 'include' })
  const payload = await response.json().catch(() => ({})) as ApiEnvelope<T> & { error?: { message?: string; fieldErrors?: Record<string, string> } }
  if (!response.ok) throw new ApiRequestError(payload.error?.message ?? `Request failed (${response.status})`, response.status)
  return payload
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> { return (await request<T>(path, init)).data }
export const get = <T>(path: string) => api<T>(path)
export const getWithMeta = <T>(path: string) => request<T>(path)
export const post = <T>(path: string, value: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(value) })
export const patch = <T>(path: string, value: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(value) })
export const remove = <T>(path: string) => api<T>(path, { method: 'DELETE' })

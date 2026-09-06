export type ApiEnvelope<T> = { data: T; meta?: Record<string, unknown> }

const apiBase = import.meta.env.VITE_API_URL ?? ''
export async function storefrontRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('accept', 'application/json')
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  const response = await fetch(`${apiBase}/api/v1${path}`, { ...init, headers, credentials: 'include' })
  const payload = await response.json() as ApiEnvelope<T> & { error?: { message?: string } }
  if (!response.ok) throw new Error(payload.error?.message ?? `Request failed (${response.status})`)
  return payload.data
}

export const getStorefront = <T>(path: string) => storefrontRequest<T>(path)
export const postStorefront = <T>(path: string, value: unknown, headers?: Record<string, string>) => storefrontRequest<T>(path, { method: 'POST', headers, body: JSON.stringify(value) })
export const patchStorefront = <T>(path: string, value: unknown, headers?: Record<string, string>) => storefrontRequest<T>(path, { method: 'PATCH', headers, body: JSON.stringify(value) })
export const deleteStorefront = <T>(path: string, headers?: Record<string, string>) => storefrontRequest<T>(path, { method: 'DELETE', headers })

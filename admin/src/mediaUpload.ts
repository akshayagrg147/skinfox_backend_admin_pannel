import { api, apiBase, csrfToken } from './api'

export type ProductMediaDraft = {
  id?: string
  src: string
  alt: string
  sortOrder: number
  type: 'image' | 'video'
  mobileSrc?: string
  poster?: string
  mediaAssetId?: string
  provider?: string
  width?: number
  height?: number
  /** True only for an asset created by this upload session (not a checksum duplicate). */
  uploaded?: boolean
}

type PresignResponse = {
  duplicate: boolean
  provider?: 'local' | 'imagekit'
  key?: string
  uploadUrl?: string
  fileName?: string
  folder?: string
  token?: string
  expire?: number
  signature?: string
  publicKey?: string
  asset?: { id: string; provider?: string; deliveryUrl?: string | null; key?: string; width?: number | null; height?: number | null }
}

type CompletedAsset = { id: string; src?: string; deliveryUrl?: string | null; provider?: string; key: string; width?: number | null; height?: number | null }

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
const MAX_IMAGE_BYTES = 10_000_000

function uploadUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `${apiBase}${value}`
}

function requestWithProgress(url: string, init: { method: 'PUT' | 'POST'; body: XMLHttpRequestBodyInit; contentType?: string; onProgress?: (value: number) => void; csrf?: boolean }) {
  return new Promise<unknown>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(init.method, uploadUrl(url), true)
    xhr.withCredentials = Boolean(init.csrf)
    if (init.contentType) xhr.setRequestHeader('content-type', init.contentType)
    if (init.csrf) {
      const token = csrfToken()
      if (token) xhr.setRequestHeader('x-csrf-token', token)
    }
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) init.onProgress?.(Math.round((event.loaded / event.total) * 100)) }
    xhr.onerror = () => reject(new Error('The image upload could not reach the server.'))
    xhr.onabort = () => reject(new Error('The image upload was cancelled.'))
    xhr.onload = () => {
      const payload = (() => { try { return JSON.parse(xhr.responseText) } catch { return {} } })() as { data?: unknown; error?: { message?: string } }
      if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(payload.error?.message ?? `Upload failed (${xhr.status}).`))
      resolve(payload.data ?? payload)
    }
    xhr.send(init.body)
  })
}

async function checksum(file: File) {
  const bytes = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

async function dimensions(file: File): Promise<{ width?: number; height?: number }> {
  if (typeof createImageBitmap !== 'function') return {}
  const bitmap = await createImageBitmap(file)
  const value = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return value
}

async function validateImage(file: File) {
  if (!ACCEPTED_TYPES.has(file.type)) throw new Error('Use a JPEG, PNG, WebP, or AVIF image.')
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) throw new Error('Each product image must be smaller than 10 MB.')
  try { await dimensions(file) } catch { throw new Error('This file is not a readable image.') }
}

export async function uploadProductImage(file: File, alt: string, onProgress?: (value: number) => void): Promise<ProductMediaDraft> {
  await validateImage(file)
  const [fileChecksum, size] = await Promise.all([checksum(file), dimensions(file)])
  const presigned = await api<PresignResponse>('/admin/media/presign', { method: 'POST', body: JSON.stringify({ filename: file.name, mimeType: file.type, sizeBytes: file.size, checksum: fileChecksum, alt }) })
  if (presigned.duplicate) {
    const asset = presigned.asset
    const src = asset?.deliveryUrl ?? (asset?.provider === 'local' && asset.key ? `/api/v1/media/${encodeURIComponent(asset.key)}` : '')
    if (!asset?.id || !src) throw new Error('This image already exists, but its delivery URL is unavailable.')
    return { type: 'image', src, alt, sortOrder: 0, mediaAssetId: asset.id, provider: asset.provider, width: asset.width ?? size.width, height: asset.height ?? size.height, uploaded: false }
  }
  if (!presigned.uploadUrl || !presigned.key || !presigned.provider) throw new Error('The upload session could not be created.')
  let providerAssetId: string | undefined
  let src: string | undefined
  if (presigned.provider === 'imagekit') {
    if (!presigned.token || !presigned.signature || !presigned.expire || !presigned.publicKey || !presigned.fileName) throw new Error('The ImageKit upload session is incomplete.')
    const form = new FormData()
    form.append('file', file)
    form.append('fileName', presigned.fileName)
    form.append('token', presigned.token)
    form.append('signature', presigned.signature)
    form.append('expire', String(presigned.expire))
    form.append('publicKey', presigned.publicKey)
    if (presigned.folder) form.append('folder', presigned.folder)
    form.append('useUniqueFileName', 'false')
    const uploaded = await requestWithProgress(presigned.uploadUrl, { method: 'POST', body: form, onProgress }) as { fileId?: string; url?: string; width?: number; height?: number }
    providerAssetId = uploaded.fileId
    src = uploaded.url
  } else {
    await requestWithProgress(presigned.uploadUrl, { method: 'PUT', body: file, contentType: file.type, csrf: true, onProgress })
    src = `/api/v1/media/${encodeURIComponent(presigned.key)}`
  }
  if (presigned.provider === 'imagekit' && (!providerAssetId || !src)) throw new Error('ImageKit did not return a usable image.')
  const completed = await api<CompletedAsset>('/admin/media/complete', { method: 'POST', body: JSON.stringify({ key: presigned.key, provider: presigned.provider, providerAssetId, src, originalFilename: file.name, mimeType: file.type, sizeBytes: file.size, checksum: fileChecksum, alt, width: size.width, height: size.height }) })
  return { type: 'image', src: completed.src ?? completed.deliveryUrl ?? src!, alt, sortOrder: 0, mediaAssetId: completed.id, provider: completed.provider, width: completed.width ?? size.width, height: completed.height ?? size.height, uploaded: true }
}

export const maxProductImages = 10

import { describe, expect, it, vi } from 'vitest'
import { lookupPincode } from './pincode.js'

const response = (payload: unknown, ok = true) => ({
  ok,
  json: vi.fn().mockResolvedValue(payload),
}) as unknown as Response

describe('Indian pincode lookup', () => {
  it('maps the directory district and state to a customer location', async () => {
    const fetcher = vi.fn().mockResolvedValue(response([{ Status: 'Success', PostOffice: [{ District: 'Mumbai City', State: 'Maharashtra' }] }]))
    await expect(lookupPincode('400001', fetcher)).resolves.toEqual({ city: 'Mumbai City', state: 'Maharashtra' })
    expect(fetcher).toHaveBeenCalledWith('https://api.postalpincode.in/pincode/400001', expect.objectContaining({ headers: { accept: 'application/json' } }))
  })

  it('returns null when the directory has no matching pincode', async () => {
    await expect(lookupPincode('999999', vi.fn().mockResolvedValue(response([{ Status: 'Error', PostOffice: null }])))).resolves.toBeNull()
  })

  it('fails soft when the directory is unavailable', async () => {
    await expect(lookupPincode('400001', vi.fn().mockResolvedValue(response({}, false)))).resolves.toBeNull()
  })
})

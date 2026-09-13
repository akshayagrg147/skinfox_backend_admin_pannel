/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest'
import { ShiprocketAdapter } from './shiprocket.js'

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('ShiprocketAdapter', () => {
  it('requires server credentials before making a request', async () => {
    const client = new ShiprocketAdapter('', '', undefined, vi.fn() as any)
    await expect(client.serviceability({ pickupPincode: '400001', deliveryPincode: '110001', paymentMethod: 'prepaid', weightKg: 0.5 })).rejects.toThrow('SHIPROCKET_NOT_CONFIGURED')
  })

  it('authenticates once and normalises courier serviceability', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ token: 'token-1' }))
      .mockResolvedValueOnce(response({ data: { available_courier_companies: [{ courier_company_id: 7, courier_name: 'Delhivery', rate: 84.5, cod: 1, estimated_delivery_days: 3, etd: '2026-09-16' }] } }))
    const client = new ShiprocketAdapter('api@example.com', 'password', 'https://shiprocket.test', fetcher as any)
    const result = await client.serviceability({ pickupPincode: '400001', deliveryPincode: '110001', paymentMethod: 'cod', weightKg: 0.5 })
    expect(result.serviceable).toBe(true)
    expect(result.codAvailable).toBe(true)
    expect(result.couriers[0]).toMatchObject({ id: '7', name: 'Delhivery', ratePaise: 8450, estimatedDays: 3 })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(String(fetcher.mock.calls[1]?.[0])).toContain('/courier/serviceability/')
  })

  it('refreshes an expired token after a 401', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ token: 'old-token' }))
      .mockResolvedValueOnce(response({ message: 'expired' }, 401))
      .mockResolvedValueOnce(response({ token: 'new-token' }))
      .mockResolvedValueOnce(response({ data: { available_courier_companies: [] } }))
    const client = new ShiprocketAdapter('api@example.com', 'password', 'https://shiprocket.test', fetcher as any)
    const result = await client.serviceability({ pickupPincode: '400001', deliveryPincode: '110001', paymentMethod: 'prepaid', weightKg: 0.5 })
    expect(result.serviceable).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(4)
  })
})

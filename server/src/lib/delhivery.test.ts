import { describe, expect, it, vi } from 'vitest'
import { DelhiveryAdapter } from './delhivery.js'

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('DelhiveryAdapter', () => {
  it('requires a server token before making a request', async () => {
    const client = new DelhiveryAdapter('', 'https://delhivery.test', vi.fn() as unknown as typeof fetch)
    await expect(client.serviceability({ pickupPincode: '400001', deliveryPincode: '110001', paymentMethod: 'prepaid', weightKg: 0.5 })).rejects.toThrow('DELHIVERY_NOT_CONFIGURED')
  })

  it('checks a pincode and calculates a provider rate', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ delivery_codes: [{ postal_code: { pin: '110001', delivery: 'Y', cash: 'Y' } }] }))
      .mockResolvedValueOnce(jsonResponse({ total_amount: 84.5 }))
    const client = new DelhiveryAdapter('token-1', 'https://delhivery.test', fetcher as unknown as typeof fetch)
    const result = await client.serviceability({ pickupPincode: '400001', deliveryPincode: '110001', paymentMethod: 'cod', weightKg: 0.5 })
    expect(result).toMatchObject({ provider: 'delhivery', serviceable: true, codAvailable: true })
    expect(result.couriers[0]).toMatchObject({ id: 'delhivery', name: 'Delhivery', ratePaise: 8450 })
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/c/api/pin-codes/json/')
    expect(String(fetcher.mock.calls[1]?.[0])).toContain('/api/kinko/v1/invoice/charges/.json')
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({ authorization: 'Token token-1' })
  })

  it('sends Delhivery order creation as format/data form data and parses the AWB', async () => {
    const original = { ...process.env }
    Object.assign(process.env, { DELHIVERY_CLIENT_NAME: 'SkinFox', DELHIVERY_PICKUP_LOCATION: 'Bhiwandi', DELHIVERY_PICKUP_PINCODE: '421302', DELHIVERY_SELLER_GST_TIN: 'GSTIN', DELHIVERY_DEFAULT_HSN_CODE: '330499' })
    const fetcher = vi.fn().mockResolvedValueOnce(jsonResponse({ packages: [{ waybill: 'AWB123' }] }))
    const client = new DelhiveryAdapter('token-1', 'https://delhivery.test', fetcher as unknown as typeof fetch)
    const result = await client.createOrder({ orderNumber: 'SF-1', orderDate: '2026-09-15T00:00:00.000Z', pickupLocation: 'Bhiwandi', paymentMethod: 'prepaid', totalPaise: 59900, customer: { name: 'Test User', phone: '9876543210' }, address: { line1: '1 Main Street', city: 'Delhi', state: 'Delhi', pincode: '110001' }, items: [{ name: 'Cleanser', sku: 'CLN-1', quantity: 1, sellingPricePaise: 59900 }], package: { weightKg: 0.5, lengthCm: 20, breadthCm: 15, heightCm: 8 } })
    expect(result).toMatchObject({ providerOrderId: 'SF-1', providerShipmentId: 'AWB123' })
    const body = String(fetcher.mock.calls[0]?.[1]?.body)
    expect(body).toContain('format=json')
    expect(new URLSearchParams(body).get('format')).toBe('json')
    expect(JSON.parse(new URLSearchParams(body).get('data') ?? '{}').shipments[0]).toMatchObject({ order: 'SF-1', client: 'SkinFox', payment_mode: 'Pre-paid' })
    Object.keys(process.env).forEach((key) => { if (!(key in original)) delete process.env[key] })
    Object.assign(process.env, original)
  })

  it('normalises an unavailable COD pincode', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(jsonResponse({ delivery_codes: [{ postal_code: { pin: '110001', delivery: 'Y', cash: 'N' } }] })).mockResolvedValueOnce(jsonResponse({ total_amount: 80 }))
    const client = new DelhiveryAdapter('token-1', 'https://delhivery.test', fetcher as unknown as typeof fetch)
    const result = await client.serviceability({ pickupPincode: '400001', deliveryPincode: '110001', paymentMethod: 'cod', weightKg: 0.5 })
    expect(result.serviceable).toBe(false)
    expect(result.codAvailable).toBe(false)
  })

  it('sends an admin-selected pickup date, time, and package count', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(jsonResponse({ pickup_id: 'PU-123', status: 'success' }))
    const client = new DelhiveryAdapter('token-1', 'https://delhivery.test', fetcher as unknown as typeof fetch)
    await client.requestPickup('AWB123', { pickupDate: '2026-09-25', pickupTime: '17:30', packageCount: 3 })
    const request = fetcher.mock.calls[0]?.[1]
    expect(String(request?.body)).toContain('pickup_date=2026-09-25')
    expect(String(request?.body)).toContain('pickup_time=17%3A30%3A00')
    expect(String(request?.body)).toContain('expected_package_count=3')
  })

  it('preserves the provider rejection reason for pickup failures', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(jsonResponse({ error: { rmk: 'Invalid Pickup Location' } }, 400))
    const client = new DelhiveryAdapter('token-1', 'https://delhivery.test', fetcher as unknown as typeof fetch)
    await expect(client.requestPickup('AWB123', { pickupDate: '2026-09-25', pickupTime: '17:30' })).rejects.toMatchObject({ code: 'DELHIVERY_PROVIDER_ERROR', statusCode: 502, message: 'Invalid Pickup Location' })
  })
})

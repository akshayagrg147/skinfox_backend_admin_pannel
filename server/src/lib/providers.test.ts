import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ImageKitAdapter, RazorpayAdapter } from './providers.js'

const jsonResponse = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json' },
})

describe('RazorpayAdapter', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('creates an INR order using server-only Basic authentication', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'order_test_123', status: 'created' }))
    vi.stubGlobal('fetch', fetchMock)
    const provider = new RazorpayAdapter('rzp_test_public', 'test_secret')

    await expect(provider.createOrder({ amountPaise: 9900, receipt: 'waitlist-receipt', notes: { reservation: 'abc' } }))
      .resolves.toEqual({ providerOrderId: 'order_test_123', status: 'created' })

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.razorpay.com/v1/orders')
    expect(options.method).toBe('POST')
    expect(options.headers).toMatchObject({ authorization: `Basic ${Buffer.from('rzp_test_public:test_secret').toString('base64')}` })
    expect(JSON.parse(String(options.body))).toEqual({ amount: 9900, currency: 'INR', receipt: 'waitlist-receipt', notes: { reservation: 'abc' } })
  })

  it('accepts only the HMAC signature generated from the stored order and payment IDs', () => {
    const provider = new RazorpayAdapter('rzp_test_public', 'test_secret')
    const signature = createHmac('sha256', 'test_secret').update('order_test_123|pay_test_456').digest('hex')
    expect(provider.verifyPayment({ orderId: 'order_test_123', paymentId: 'pay_test_456', signature })).toBe(true)
    expect(provider.verifyPayment({ orderId: 'order_test_123', paymentId: 'pay_test_456', signature: 'test-signature' })).toBe(false)
  })

  it('checks the captured payment details with Razorpay', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'pay_test_456', order_id: 'order_test_123', amount: 9900, currency: 'INR', status: 'captured' }))
    vi.stubGlobal('fetch', fetchMock)
    const provider = new RazorpayAdapter('rzp_test_public', 'test_secret')

    await expect(provider.fetchPayment('pay_test_456')).resolves.toEqual({
      providerPaymentId: 'pay_test_456', providerOrderId: 'order_test_123', amountPaise: 9900, currency: 'INR', status: 'captured',
    })
    expect(fetchMock).toHaveBeenCalledWith('https://api.razorpay.com/v1/payments/pay_test_456', expect.objectContaining({ method: 'GET' }))
  })

  it('requests a full optimum-speed refund with an idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'rfnd_test_789', status: 'processed' }))
    vi.stubGlobal('fetch', fetchMock)
    const provider = new RazorpayAdapter('rzp_test_public', 'test_secret')

    await expect(provider.refund({ paymentId: 'pay_test_456', amountPaise: 9900, idempotencyKey: 'cancel-abc' }))
      .resolves.toEqual({ providerRefundId: 'rfnd_test_789', status: 'processed' })
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(options.headers).toMatchObject({ 'X-Razorpay-Idempotency-Key': 'cancel-abc' })
    expect(JSON.parse(String(options.body))).toMatchObject({ amount: 9900, speed: 'optimum' })
  })

  it('fails closed when payment credentials are absent', async () => {
    const provider = new RazorpayAdapter('', '')
    expect(provider.configured()).toBe(false)
    await expect(provider.createOrder({ amountPaise: 9900, receipt: 'waitlist' })).rejects.toThrow('RAZORPAY_NOT_CONFIGURED')
  })
})

describe('ImageKitAdapter', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('creates a short-lived signed browser upload grant without exposing the private key', () => {
    const adapter = new ImageKitAdapter('private_test_key', 'public_test_key', 'https://ik.imagekit.io/skinfox', '/skinfox/products')
    const auth = adapter.uploadAuth()
    expect(auth.publicKey).toBe('public_test_key')
    expect(auth.uploadUrl).toBe('https://upload.imagekit.io/api/v1/files/upload')
    expect(auth.folder).toBe('/skinfox/products')
    expect(auth.expire).toBeGreaterThan(Math.floor(Date.now() / 1000))
    expect(auth.signature).toBe(createHmac('sha1', 'private_test_key').update(`${auth.token}${auth.expire}`).digest('hex'))
    expect(JSON.stringify(auth)).not.toContain('private_test_key')
  })

  it('only accepts HTTPS delivery URLs from the configured ImageKit endpoint', () => {
    const adapter = new ImageKitAdapter('private_test_key', 'public_test_key', 'https://ik.imagekit.io/skinfox')
    expect(adapter.validDeliveryUrl('https://ik.imagekit.io/skinfox/products/a.webp')).toBe(true)
    expect(adapter.validDeliveryUrl('http://ik.imagekit.io/skinfox/products/a.webp')).toBe(false)
    expect(adapter.validDeliveryUrl('https://evil.example/products/a.webp')).toBe(false)
  })

  it('looks up the provider asset with server-side Basic authentication', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ fileId: 'file_test_123', fileType: 'image', url: 'https://ik.imagekit.io/skinfox/products/a.webp', size: 1234 }))
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new ImageKitAdapter('private_test_key', 'public_test_key', 'https://ik.imagekit.io/skinfox')
    await expect(adapter.inspectFile('file_test_123')).resolves.toMatchObject({ fileId: 'file_test_123', fileType: 'image' })
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.imagekit.io/v1/files/file_test_123')
    expect(options.headers).toMatchObject({ authorization: `Basic ${Buffer.from('private_test_key:').toString('base64')}` })
  })

  it('deletes an unreferenced provider asset with server-side authentication', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new ImageKitAdapter('private_test_key', 'public_test_key', 'https://ik.imagekit.io/skinfox')
    await expect(adapter.deleteFile('file_test_123')).resolves.toBeUndefined()
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.imagekit.io/v1/files/file_test_123')
    expect(options.method).toBe('DELETE')
    expect(options.headers).toMatchObject({ authorization: `Basic ${Buffer.from('private_test_key:').toString('base64')}` })
  })
})

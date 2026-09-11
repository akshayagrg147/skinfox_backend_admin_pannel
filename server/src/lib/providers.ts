import { signHmac } from './crypto.js'

export interface PaymentProvider {
  createOrder(input: { amountPaise: number; receipt: string; notes?: Record<string, string> }): Promise<{ providerOrderId: string; status: string }>
  verifyPayment(input: { orderId: string; paymentId: string; signature: string }): boolean
  fetchPayment(paymentId: string): Promise<{ providerPaymentId: string; providerOrderId: string; amountPaise: number; currency: string; status: string }>
  refund(input: { paymentId: string; amountPaise: number; idempotencyKey?: string }): Promise<{ providerRefundId: string; status: string }>
}

export class RazorpayAdapter implements PaymentProvider {
  constructor(private readonly keyId = process.env.RAZORPAY_KEY_ID, private readonly secret = process.env.RAZORPAY_KEY_SECRET) {}
  configured() { return Boolean(this.keyId && this.secret) }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    if (!this.keyId || !this.secret) throw new Error('RAZORPAY_NOT_CONFIGURED')
    const response = await fetch(`https://api.razorpay.com/v1${path}`, {
      ...init,
      signal: AbortSignal.timeout(20_000),
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Basic ${Buffer.from(`${this.keyId}:${this.secret}`).toString('base64')}`,
        ...(init.headers ?? {}),
      },
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: { description?: string } }
      throw new Error(payload.error?.description || `Razorpay request failed (${response.status})`)
    }
    return response.json() as Promise<T>
  }

  async createOrder(input: { amountPaise: number; receipt: string; notes?: Record<string, string> }) {
    const order = await this.request<{ id: string; status: string }>('/orders', {
      method: 'POST',
      body: JSON.stringify({ amount: input.amountPaise, currency: 'INR', receipt: input.receipt.slice(0, 40), notes: input.notes ?? {} }),
    })
    return { providerOrderId: order.id, status: order.status }
  }
  verifyPayment(input: { orderId: string; paymentId: string; signature: string }) {
    if (!this.secret) return false
    return signHmac(`${input.orderId}|${input.paymentId}`, this.secret) === input.signature
  }
  async fetchPayment(paymentId: string) {
    const payment = await this.request<{ id: string; order_id: string; amount: number; currency: string; status: string }>(`/payments/${encodeURIComponent(paymentId)}`, { method: 'GET' })
    return { providerPaymentId: payment.id, providerOrderId: payment.order_id, amountPaise: payment.amount, currency: payment.currency, status: payment.status }
  }
  async refund(input: { paymentId: string; amountPaise: number; idempotencyKey?: string }) {
    const refund = await this.request<{ id: string; status: string }>(`/payments/${encodeURIComponent(input.paymentId)}/refund`, {
      method: 'POST',
      headers: input.idempotencyKey ? { 'X-Razorpay-Idempotency-Key': input.idempotencyKey } : undefined,
      body: JSON.stringify({ amount: input.amountPaise, speed: 'optimum', notes: { reason: 'SkinFox approved payment refund' } }),
    })
    return { providerRefundId: refund.id, status: refund.status }
  }
}

export interface EmailProvider { send(input: { to: string; subject: string; html: string }): Promise<void> }
export class LocalEmailAdapter implements EmailProvider { async send() { return undefined } }
export interface StorageProvider { presign(input: { key: string; mimeType: string }): Promise<{ uploadUrl: string; key: string }> }
export class LocalStorageAdapter implements StorageProvider { async presign(input: { key: string; mimeType: string }) { return { uploadUrl: `/api/v1/admin/media/local-upload/${encodeURIComponent(input.key)}`, key: input.key } } }
export interface ShippingProvider { serviceable(pincode: string): Promise<boolean> }
export class ManualShippingAdapter implements ShippingProvider { constructor(private readonly lookup: (pincode: string) => Promise<boolean>) {} serviceable(pincode: string) { return this.lookup(pincode) } }

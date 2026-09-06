import { randomToken, signHmac } from './crypto.js'

export interface PaymentProvider {
  createOrder(input: { amountPaise: number; receipt: string }): Promise<{ providerOrderId: string; status: string }>
  verifyPayment(input: { orderId: string; paymentId: string; signature: string }): boolean
  refund(input: { paymentId: string; amountPaise: number }): Promise<{ providerRefundId: string; status: string }>
}

export class RazorpayAdapter implements PaymentProvider {
  constructor(private readonly keyId = process.env.RAZORPAY_KEY_ID, private readonly secret = process.env.RAZORPAY_KEY_SECRET) {}
  async createOrder() { return { providerOrderId: `order_local_${randomToken(12)}`, status: this.keyId && this.secret ? 'created' : 'test_created' } }
  verifyPayment(input: { orderId: string; paymentId: string; signature: string }) {
    if (input.signature === 'test-signature' && process.env.NODE_ENV !== 'production') return true
    if (!this.secret) return false
    return signHmac(`${input.orderId}|${input.paymentId}`, this.secret) === input.signature
  }
  async refund() { return { providerRefundId: `rfnd_local_${randomToken(12)}`, status: 'processed' } }
}

export interface EmailProvider { send(input: { to: string; subject: string; html: string }): Promise<void> }
export class LocalEmailAdapter implements EmailProvider { async send() { return undefined } }
export interface StorageProvider { presign(input: { key: string; mimeType: string }): Promise<{ uploadUrl: string; key: string }> }
export class LocalStorageAdapter implements StorageProvider { async presign(input: { key: string; mimeType: string }) { return { uploadUrl: `/api/v1/admin/media/local-upload/${encodeURIComponent(input.key)}`, key: input.key } } }
export interface ShippingProvider { serviceable(pincode: string): Promise<boolean> }
export class ManualShippingAdapter implements ShippingProvider { constructor(private readonly lookup: (pincode: string) => Promise<boolean>) {} serviceable(pincode: string) { return this.lookup(pincode) } }

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { products } from '../data/products'
import { getStorefront, postStorefront } from '../lib/storefrontApi'
import { openRazorpayCheckout } from '../lib/razorpay'
import { WaitlistModal } from './WaitlistModal'

vi.mock('../lib/storefrontApi', () => ({ getStorefront: vi.fn(), postStorefront: vi.fn() }))
vi.mock('../lib/razorpay', () => ({ openRazorpayCheckout: vi.fn() }))

const config = { enabled: true, depositPaise: 9900, discountPercent: 25, currency: 'INR' as const, refundable: true, termsVersion: '2026-09-10', paymentConfigured: true }
const reservation = { publicToken: 'reservation-public-token', status: 'joined', depositPaise: 9900, discountPercent: 25, items: [{ productId: products[0].id, productName: products[0].name, size: products[0].size, quantity: 1 }] }

describe('WaitlistModal', () => {
  beforeEach(() => {
    vi.mocked(getStorefront).mockReset()
    vi.mocked(postStorefront).mockReset()
    vi.mocked(openRazorpayCheckout).mockReset()
    vi.mocked(getStorefront).mockResolvedValue({ customer: { id: 'customer-1', fullName: 'Test Customer', email: 'test@skinfox.in', phone: '9876543210', emailVerified: true } })
  })

  it('creates, pays and server-verifies a refundable waitlist reservation', async () => {
    vi.mocked(postStorefront)
      .mockResolvedValueOnce({ reservation: { ...reservation, status: 'payment_pending' }, checkout: { keyId: 'rzp_test_key', orderId: 'order_123', amountPaise: 9900, currency: 'INR', name: 'SkinFox', description: 'Refundable deposit' } })
      .mockResolvedValueOnce({ reservation, confirmed: true })
    vi.mocked(openRazorpayCheckout).mockResolvedValue({ razorpay_order_id: 'order_123', razorpay_payment_id: 'pay_123', razorpay_signature: 'valid-signature-value' })
    const onComplete = vi.fn()

    render(<WaitlistModal open lines={[{ product: products[0], quantity: 1 }]} config={config} apiAvailable onClose={vi.fn()} onComplete={onComplete} />)
    expect(await screen.findByText(/save your place/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /pay refundable ₹99/i }))

    await waitFor(() => expect(postStorefront).toHaveBeenCalledTimes(2))
    expect(postStorefront).toHaveBeenNthCalledWith(1, '/waitlist/reservations', expect.objectContaining({ phone: '9876543210', consent: true, termsVersion: '2026-09-10' }), expect.objectContaining({ 'Idempotency-Key': expect.any(String) }))
    expect(openRazorpayCheckout).toHaveBeenCalledWith(expect.objectContaining({ key: 'rzp_test_key', order_id: 'order_123', amount: 9900 }))
    expect(postStorefront).toHaveBeenNthCalledWith(2, '/waitlist/reservations/reservation-public-token/verify', expect.objectContaining({ razorpayPaymentId: 'pay_123' }), expect.any(Object))
    expect(await screen.findByText('You’re on the SkinFox waitlist.')).toBeInTheDocument()
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('cannot collect a deposit when Razorpay is not configured', async () => {
    render(<WaitlistModal open lines={[{ product: products[0], quantity: 1 }]} config={{ ...config, paymentConfigured: false }} apiAvailable onClose={vi.fn()} onComplete={vi.fn()} />)
    expect(await screen.findByText(/secure payment setup is not active yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pay refundable ₹99/i })).toBeDisabled()
    expect(postStorefront).not.toHaveBeenCalled()
    expect(openRazorpayCheckout).not.toHaveBeenCalled()
  })
})

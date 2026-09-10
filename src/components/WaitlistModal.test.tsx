import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { products } from '../data/products'
import { getStorefront, postStorefront } from '../lib/storefrontApi'
import { openRazorpayCheckout } from '../lib/razorpay'
import { WaitlistModal } from './WaitlistModal'

vi.mock('../lib/storefrontApi', () => ({ getStorefront: vi.fn(), postStorefront: vi.fn() }))
vi.mock('../lib/razorpay', () => ({ openRazorpayCheckout: vi.fn() }))

const config = { enabled: true, depositPaise: 9900, discountPercent: 25, currency: 'INR' as const, refundable: false, termsVersion: '2026-09-10-nonrefundable', paymentConfigured: true, stage: 'waitlist' as const, founderCapacity: 200, founderClaimed: 83, founderRemaining: 117, foundingClosed: false, founderPricePaise: 59900, launchPricePaise: 64900, regularPricePaise: 70000 }
const reservation = { publicToken: 'reservation-public-token', waitlistId: 'SFWL-2026-12AB34CD56', status: 'joined', depositPaise: 9900, discountPercent: 25, founderNumber: 84, founderCapacity: 200, items: [{ productId: products[0].id, productName: products[0].name, size: products[0].size, quantity: 1 }] }

describe('WaitlistModal', () => {
  beforeEach(() => {
    vi.mocked(getStorefront).mockReset()
    vi.mocked(postStorefront).mockReset()
    vi.mocked(openRazorpayCheckout).mockReset()
    vi.mocked(getStorefront).mockResolvedValue({ customer: { id: 'customer-1', fullName: 'Test Customer', email: 'test@skinfox.in', phone: '9876543210', emailVerified: true } })
  })

  it('creates, pays and server-verifies a non-refundable waitlist reservation', async () => {
    vi.mocked(postStorefront)
      .mockResolvedValueOnce({ reservation: { ...reservation, status: 'payment_pending' }, checkout: { keyId: 'rzp_test_key', orderId: 'order_123', amountPaise: 9900, currency: 'INR', name: 'SkinFox', description: 'Non-refundable reservation fee' } })
      .mockResolvedValueOnce({ reservation, confirmed: true })
    vi.mocked(openRazorpayCheckout).mockResolvedValue({ razorpay_order_id: 'order_123', razorpay_payment_id: 'pay_123', razorpay_signature: 'valid-signature-value' })
    const onComplete = vi.fn()

    render(<WaitlistModal open lines={[{ product: products[0], quantity: 1 }]} config={config} apiAvailable onClose={vi.fn()} onComplete={onComplete} />)
    expect(await screen.findByText(/reserve your place/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /pay ₹99 & join/i }))

    await waitFor(() => expect(postStorefront).toHaveBeenCalledTimes(2))
    expect(postStorefront).toHaveBeenNthCalledWith(1, '/waitlist/reservations', expect.objectContaining({ phone: '9876543210', consent: true, termsVersion: '2026-09-10-nonrefundable' }), expect.objectContaining({ 'Idempotency-Key': expect.any(String) }))
    expect(openRazorpayCheckout).toHaveBeenCalledWith(expect.objectContaining({ key: 'rzp_test_key', order_id: 'order_123', amount: 9900 }))
    expect(postStorefront).toHaveBeenNthCalledWith(2, '/waitlist/reservations/reservation-public-token/verify', expect.objectContaining({ razorpayPaymentId: 'pay_123' }), expect.any(Object))
    expect(await screen.findByText('You’re officially part of the Founding 200.')).toBeInTheDocument()
    expect(screen.getByText('You’re #84 of 200')).toBeInTheDocument()
    expect(screen.getByText('SFWL-2026-12AB34CD56')).toBeInTheDocument()
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('cannot collect a deposit when Razorpay is not configured', async () => {
    render(<WaitlistModal open lines={[{ product: products[0], quantity: 1 }]} config={{ ...config, paymentConfigured: false }} apiAvailable onClose={vi.fn()} onComplete={vi.fn()} />)
    expect(await screen.findByText(/secure payment setup is not active yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pay ₹99 & join/i })).toBeDisabled()
    expect(postStorefront).not.toHaveBeenCalled()
    expect(openRazorpayCheckout).not.toHaveBeenCalled()
  })

  it('shows and pays the reservation fee per selected product unit', async () => {
    const fiveUnitReservation = {
      ...reservation,
      depositPaise: 49500,
      items: [
        { productId: products[0].id, productName: products[0].name, size: products[0].size, quantity: 2 },
        { productId: products[1].id, productName: products[1].name, size: products[1].size, quantity: 3 },
      ],
    }
    vi.mocked(postStorefront)
      .mockResolvedValueOnce({ reservation: { ...fiveUnitReservation, status: 'payment_pending' }, checkout: { keyId: 'rzp_test_key', orderId: 'order_495', amountPaise: 49500, currency: 'INR', name: 'SkinFox', description: 'Non-refundable reservation fee' } })
      .mockResolvedValueOnce({ reservation: fiveUnitReservation, confirmed: true })
    vi.mocked(openRazorpayCheckout).mockResolvedValue({ razorpay_order_id: 'order_495', razorpay_payment_id: 'pay_495', razorpay_signature: 'valid-signature-value' })

    render(<WaitlistModal open lines={[{ product: products[0], quantity: 2 }, { product: products[1], quantity: 3 }]} config={config} apiAvailable onClose={vi.fn()} onComplete={vi.fn()} />)

    expect(await screen.findByText('5 selected items')).toBeInTheDocument()
    expect(screen.getByText('₹99 × 5 product units')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /pay ₹495 & join/i }))

    await waitFor(() => expect(openRazorpayCheckout).toHaveBeenCalledWith(expect.objectContaining({ order_id: 'order_495', amount: 49500 })))
    expect(postStorefront).toHaveBeenNthCalledWith(1, '/waitlist/reservations', expect.objectContaining({
      items: [
        { productId: products[0].id, quantity: 2 },
        { productId: products[1].id, quantity: 3 },
      ],
    }), expect.any(Object))
  })

  it('does not ask the customer to pay again when Razorpay succeeds but confirmation is delayed', async () => {
    vi.mocked(postStorefront)
      .mockResolvedValueOnce({ reservation: { ...reservation, status: 'payment_pending' }, checkout: { keyId: 'rzp_test_key', orderId: 'order_123', amountPaise: 9900, currency: 'INR', name: 'SkinFox', description: 'Non-refundable reservation fee' } })
      .mockRejectedValueOnce(new Error('Request failed (500)'))
    vi.mocked(openRazorpayCheckout).mockResolvedValue({ razorpay_order_id: 'order_123', razorpay_payment_id: 'pay_123', razorpay_signature: 'valid-signature-value' })
    const onComplete = vi.fn()

    render(<WaitlistModal open lines={[{ product: products[0], quantity: 1 }]} config={config} apiAvailable onClose={vi.fn()} onComplete={onComplete} />)
    await screen.findByText(/reserve your place/i)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /pay ₹99 & join/i }))

    expect(await screen.findByText('We’re confirming your payment.')).toBeInTheDocument()
    expect(screen.getByText(/please do not pay again/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pay ₹99 & join/i })).not.toBeInTheDocument()
    expect(screen.getByText('SFWL-2026-12AB34CD56')).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
  })
})

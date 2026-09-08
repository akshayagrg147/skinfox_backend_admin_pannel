import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomerAccount } from './CustomerAccount'
import { getStorefront, postStorefront } from '../lib/storefrontApi'

vi.mock('../lib/storefrontApi', () => ({
  getStorefront: vi.fn(),
  postStorefront: vi.fn(),
}))

const getMock = vi.mocked(getStorefront)
const postMock = vi.mocked(postStorefront)

describe('CustomerAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMock.mockImplementation((path: string) => {
      if (path === '/customer/auth/me') return Promise.resolve({ customer: null }) as never
      if (path === '/customer/orders') return Promise.resolve([{ publicToken: 'order-token', orderNumber: 'SF-2026-ABCD', status: 'confirmed', totalPaise: 70000, createdAt: '2026-09-08T00:00:00.000Z', items: [{ id: 'line-1', productName: 'Rayyvia Sun Protect', size: '60 g', quantity: 1, finalLineTotalPaise: 70000 }], shippingAddress: { city: 'Mumbai', pincode: '400001' } }]) as never
      if (path === '/customer/addresses') return Promise.resolve([{ id: 'address-1', label: 'Home', fullName: 'Asha Sharma', phone: '9876543210', addressLine1: '12 Marine Drive', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', isDefault: true }]) as never
      return Promise.resolve({}) as never
    })
  })

  it('manually signs in by OTP and displays only the signed-in customer order history', async () => {
    const onCustomerChange = vi.fn()
    postMock.mockImplementation((path: string) => {
      if (path === '/customer/auth/request-otp') return Promise.resolve({ challengeId: 'challenge-1', phone: '9876543210', testOtpCode: '123456' }) as never
      if (path === '/customer/auth/verify-otp') return Promise.resolve({ customer: { id: 'customer-1', fullName: 'Asha Sharma', phone: '9876543210' } }) as never
      return Promise.resolve({}) as never
    })

    render(<CustomerAccount open onClose={() => undefined} apiAvailable onCustomerChange={onCustomerChange} />)

    await screen.findByRole('heading', { name: /sign in to see your orders/i })
    fireEvent.change(screen.getByRole('textbox', { name: 'Mobile number' }), { target: { value: '9876543210' } })
    fireEvent.click(screen.getByRole('button', { name: /continue with otp/i }))

    await screen.findByRole('heading', { name: /check your messages/i })
    expect(screen.getByText('Testing code')).toHaveTextContent('Testing code')
    expect(screen.getByText('123456')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Six-digit OTP' }), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /verify and open account/i }))

    await screen.findByRole('heading', { name: /hello, asha sharma/i })
    const orders = screen.getByRole('tabpanel')
    expect(within(orders).getByText('SF-2026-ABCD')).toBeInTheDocument()
    expect(within(orders).getByText('Rayyvia Sun Protect')).toBeInTheDocument()
    expect(within(orders).getByText(/mumbai/i)).toBeInTheDocument()
    expect(onCustomerChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'customer-1', phone: '9876543210' }))
  })

  it('keeps saved addresses in a separate account tab', async () => {
    getMock.mockImplementation((path: string) => {
      if (path === '/customer/auth/me') return Promise.resolve({ customer: { id: 'customer-1', fullName: 'Asha Sharma', phone: '9876543210' } }) as never
      if (path === '/customer/orders') return Promise.resolve([]) as never
      if (path === '/customer/addresses') return Promise.resolve([{ id: 'address-1', label: 'Home', fullName: 'Asha Sharma', phone: '9876543210', addressLine1: '12 Marine Drive', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', isDefault: true }]) as never
      return Promise.resolve({}) as never
    })

    render(<CustomerAccount open onClose={() => undefined} apiAvailable onCustomerChange={() => undefined} />)

    await screen.findByRole('heading', { name: /hello, asha sharma/i })
    fireEvent.click(screen.getByRole('tab', { name: /addresses 1/i }))
    await waitFor(() => expect(screen.getByText(/12 Marine Drive/i)).toBeInTheDocument())
    expect(screen.getByText('Default')).toBeInTheDocument()
  })
})

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomerAccount } from './CustomerAccount'
import { getStorefront } from '../lib/storefrontApi'
import { createEmailPasswordAccount, exchangeFirebaseUser, requestPasswordReset, signInWithEmailPassword } from '../lib/firebaseAuth'

vi.mock('../lib/storefrontApi', () => ({ getStorefront: vi.fn(), postStorefront: vi.fn() }))
vi.mock('../lib/firebaseAuth', () => ({
  firebaseAuthConfigured: true,
  createEmailPasswordAccount: vi.fn(),
  exchangeFirebaseUser: vi.fn(),
  requestPasswordReset: vi.fn(),
  signInWithEmailPassword: vi.fn(),
  signInWithGoogle: vi.fn(),
  firebaseAuthErrorMessage: (_cause: unknown, fallback: string) => fallback,
  linkEmailPassword: vi.fn(),
  refreshFirebaseUser: vi.fn(),
  resendEmailVerification: vi.fn(),
  signOutFirebase: vi.fn(),
}))

const getMock = vi.mocked(getStorefront)
const signInMock = vi.mocked(signInWithEmailPassword)
const signUpMock = vi.mocked(createEmailPasswordAccount)
const exchangeMock = vi.mocked(exchangeFirebaseUser)
const resetMock = vi.mocked(requestPasswordReset)

const firebaseUser = { getIdToken: vi.fn().mockResolvedValue('test-token') } as never

describe('CustomerAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMock.mockImplementation((path: string) => {
      if (path === '/customer/auth/me') return Promise.resolve({ customer: null }) as never
      if (path === '/customer/orders') return Promise.resolve([{ publicToken: 'order-token', orderNumber: 'SF-2026-ABCD', status: 'confirmed', totalPaise: 70000, createdAt: '2026-09-08T00:00:00.000Z', items: [{ id: 'line-1', productName: 'Rayyvia Sun Protect', size: '60 g', quantity: 1, finalLineTotalPaise: 70000 }], shippingAddress: { city: 'Mumbai', pincode: '400001' } }]) as never
      if (path === '/customer/addresses') return Promise.resolve([{ id: 'address-1', label: 'Home', fullName: 'Asha Sharma', phone: '9876543210', addressLine1: '12 Marine Drive', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', isDefault: true }]) as never
      return Promise.resolve({}) as never
    })
    signInMock.mockResolvedValue({ user: firebaseUser } as never)
    signUpMock.mockResolvedValue({ user: firebaseUser } as never)
    exchangeMock.mockResolvedValue({ customer: { id: 'customer-1', fullName: 'Asha Sharma', email: 'asha@example.com', emailVerified: true } } as never)
  })

  it('signs in with email and password and displays only the signed-in customer order history', async () => {
    const onCustomerChange = vi.fn()
    render(<CustomerAccount open onClose={() => undefined} apiAvailable onCustomerChange={onCustomerChange} />)

    await screen.findByRole('heading', { name: /welcome back/i })
    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), { target: { value: 'asha@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'correct horse battery staple' } })
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    await screen.findByRole('heading', { name: /hello, asha sharma/i })
    const orders = screen.getByRole('tabpanel')
    expect(within(orders).getByText('SF-2026-ABCD')).toBeInTheDocument()
    expect(within(orders).getByText('Rayyvia Sun Protect')).toBeInTheDocument()
    expect(onCustomerChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'customer-1', email: 'asha@example.com' }))
  })

  it('creates an email account and displays the verification reminder', async () => {
    exchangeMock.mockResolvedValue({ customer: { id: 'customer-2', fullName: 'Neha Rao', email: 'neha@example.com', emailVerified: false } } as never)
    render(<CustomerAccount open onClose={() => undefined} apiAvailable onCustomerChange={() => undefined} />)
    await screen.findByRole('heading', { name: /welcome back/i })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /full name/i }), { target: { value: 'Neha Rao' } })
    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), { target: { value: 'neha@example.com' } })
    const passwords = screen.getAllByPlaceholderText(/at least 8 characters/i)
    fireEvent.change(passwords[0], { target: { value: 'strong password 123' } })
    fireEvent.change(screen.getByPlaceholderText('Repeat your password'), { target: { value: 'strong password 123' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    await screen.findByText(/verify your email before ordering/i)
    expect(signUpMock).toHaveBeenCalledWith('Neha Rao', 'neha@example.com', 'strong password 123')
  })

  it('requests a neutral password reset message', async () => {
    resetMock.mockResolvedValue(undefined)
    render(<CustomerAccount open onClose={() => undefined} apiAvailable onCustomerChange={() => undefined} />)
    await screen.findByRole('heading', { name: /welcome back/i })
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), { target: { value: 'unknown@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))
    await screen.findByText(/if an account exists for that email/i)
    expect(resetMock).toHaveBeenCalledWith('unknown@example.com')
  })

  it('keeps saved addresses in a separate account tab', async () => {
    getMock.mockImplementation((path: string) => {
      if (path === '/customer/auth/me') return Promise.resolve({ customer: { id: 'customer-1', fullName: 'Asha Sharma', email: 'asha@example.com', emailVerified: true } }) as never
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

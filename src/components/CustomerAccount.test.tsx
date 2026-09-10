import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomerAccount } from './CustomerAccount'
import { deleteStorefront, getStorefront, patchStorefront, postStorefront } from '../lib/storefrontApi'
import { createEmailPasswordAccount, exchangeFirebaseUser, requestPasswordReset, signInWithEmailPassword } from '../lib/firebaseAuth'

vi.mock('../lib/storefrontApi', () => ({ getStorefront: vi.fn(), postStorefront: vi.fn(), patchStorefront: vi.fn(), deleteStorefront: vi.fn() }))
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
const postMock = vi.mocked(postStorefront)
const patchMock = vi.mocked(patchStorefront)
const deleteMock = vi.mocked(deleteStorefront)
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
    postMock.mockResolvedValue({} as never)
    patchMock.mockResolvedValue({} as never)
    deleteMock.mockResolvedValue({ deleted: true } as never)
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

  it('keeps a new email account in the verification state until the email is verified', async () => {
    exchangeMock.mockResolvedValue({ customer: { id: 'customer-2', fullName: 'Neha Rao', email: 'neha@example.com', emailVerified: false } } as never)
    render(<CustomerAccount open onClose={() => undefined} apiAvailable onCustomerChange={() => undefined} />)
    await screen.findByRole('heading', { name: /welcome back/i })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /full name/i }), { target: { value: 'Neha Rao' } })
    fireEvent.change(screen.getByRole('textbox', { name: /mobile number/i }), { target: { value: '9876543210' } })
    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), { target: { value: 'neha@example.com' } })
    const passwords = screen.getAllByPlaceholderText(/at least 8 characters/i)
    fireEvent.change(passwords[0], { target: { value: 'strong password 123' } })
    fireEvent.change(screen.getByPlaceholderText('Repeat your password'), { target: { value: 'strong password 123' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    await screen.findByRole('heading', { name: /check your inbox/i })
    expect(screen.queryByRole('tab', { name: /orders/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /addresses/i })).not.toBeInTheDocument()
    expect(signUpMock).toHaveBeenCalledWith('Neha Rao', 'neha@example.com', 'strong password 123')
    expect(exchangeMock).toHaveBeenCalledWith(firebaseUser, undefined, false, { phone: '9876543210' })
  })

  it('requires a valid mobile number before creating an email account', async () => {
    render(<CustomerAccount open onClose={() => undefined} apiAvailable onCustomerChange={() => undefined} />)
    await screen.findByRole('heading', { name: /welcome back/i })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /full name/i }), { target: { value: 'Neha Rao' } })
    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), { target: { value: 'neha@example.com' } })
    const passwords = screen.getAllByPlaceholderText(/at least 8 characters/i)
    fireEvent.change(passwords[0], { target: { value: 'strong password 123' } })
    fireEvent.change(screen.getByPlaceholderText('Repeat your password'), { target: { value: 'strong password 123' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    await screen.findByText(/valid 10-digit indian mobile number/i)
    expect(signUpMock).not.toHaveBeenCalled()
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
    const addressTab = screen.getByRole('tab', { name: /addresses 1/i })
    addressTab.focus()
    fireEvent.keyDown(addressTab, { key: 'Home' })
    const ordersTab = screen.getByRole('tab', { name: /orders 0/i })
    expect(ordersTab).toHaveFocus()
    expect(ordersTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: /orders 0/i })).toBeInTheDocument()
  })

  it('allows a signed-in customer to edit their profile name and phone', async () => {
    getMock.mockImplementation((path: string) => {
      if (path === '/customer/auth/me') return Promise.resolve({ customer: { id: 'customer-1', fullName: 'Asha Sharma', email: 'asha@example.com', phone: '9876543210', emailVerified: true } }) as never
      if (path === '/customer/orders') return Promise.resolve([]) as never
      if (path === '/customer/addresses') return Promise.resolve([]) as never
      return Promise.resolve({}) as never
    })
    patchMock.mockResolvedValue({ id: 'customer-1', fullName: 'Asha Verma', email: 'asha@example.com', phone: '9876543211', emailVerified: true } as never)
    render(<CustomerAccount open onClose={() => undefined} apiAvailable onCustomerChange={() => undefined} initialSection="profile" />)
    await screen.findByRole('heading', { name: /hello, asha sharma/i })
    fireEvent.click(screen.getByRole('button', { name: /my profile/i }))
    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /full name/i }), { target: { value: 'Asha Verma' } })
    fireEvent.change(screen.getByRole('textbox', { name: /mobile number/i }), { target: { value: '9876543211' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await screen.findByText(/profile details have been saved/i)
    expect(patchMock).toHaveBeenCalledWith('/customer/auth/profile', { fullName: 'Asha Verma', phone: '9876543211' }, {})
    expect(screen.getByRole('heading', { name: /hello, asha verma/i })).toBeInTheDocument()
  })

  it('allows a signed-in customer to add a saved delivery address', async () => {
    let savedAddresses: Array<Record<string, unknown>> = []
    getMock.mockImplementation((path: string) => {
      if (path === '/customer/auth/me') return Promise.resolve({ customer: { id: 'customer-1', fullName: 'Asha Sharma', email: 'asha@example.com', phone: '9876543210', emailVerified: true } }) as never
      if (path === '/customer/orders') return Promise.resolve([]) as never
      if (path === '/customer/addresses') return Promise.resolve(savedAddresses) as never
      return Promise.resolve({}) as never
    })
    postMock.mockImplementation((_path, value) => {
      savedAddresses = [{ id: 'address-new', ...(value as Record<string, unknown>), isDefault: true }]
      return Promise.resolve(savedAddresses[0]) as never
    })
    render(<CustomerAccount open onClose={() => undefined} apiAvailable onCustomerChange={() => undefined} initialSection="addresses" />)
    await screen.findByRole('heading', { name: /hello, asha sharma/i })
    fireEvent.click(screen.getByRole('button', { name: /saved addresses/i }))
    fireEvent.click(screen.getByRole('button', { name: /^add address$/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /address label/i }), { target: { value: 'Work' } })
    fireEvent.change(screen.getByRole('textbox', { name: /^full name$/i }), { target: { value: 'Asha Sharma' } })
    fireEvent.change(screen.getByRole('textbox', { name: /mobile number/i }), { target: { value: '9876543210' } })
    fireEvent.change(screen.getByRole('textbox', { name: /address line/i }), { target: { value: '12 Marine Drive' } })
    fireEvent.change(screen.getByRole('textbox', { name: /^city$/i }), { target: { value: 'Mumbai' } })
    fireEvent.change(screen.getByRole('textbox', { name: /^state$/i }), { target: { value: 'Maharashtra' } })
    fireEvent.change(screen.getByRole('textbox', { name: /pincode/i }), { target: { value: '400001' } })
    fireEvent.click(screen.getByRole('button', { name: /save address/i }))
    await screen.findByText('Work')
    expect(postMock).toHaveBeenCalledWith('/customer/addresses', expect.objectContaining({ label: 'Work', addressLine1: '12 Marine Drive', city: 'Mumbai', pincode: '400001' }), {})
    expect(screen.getByText(/address saved successfully/i)).toBeInTheDocument()
  })

  it('shows the customer-facing waitlist ID in reservation history', async () => {
    getMock.mockImplementation((path: string) => {
      if (path === '/customer/auth/me') return Promise.resolve({ customer: { id: 'customer-1', fullName: 'Asha Sharma', email: 'asha@example.com', phone: '9876543210', emailVerified: true } }) as never
      if (path === '/customer/orders' || path === '/customer/addresses') return Promise.resolve([]) as never
      if (path === '/customer/waitlist') return Promise.resolve([{
        publicToken: 'private-reservation-token',
        waitlistId: 'SFWL-2026-12AB34CD56',
        status: 'joined',
        depositPaise: 19800,
        discountPercent: 25,
        refundPaise: 0,
        createdAt: '2026-09-10T00:00:00.000Z',
        items: [{ productId: 'product-1', productName: 'Rayyvia Sun Protect', productSlug: 'rayyvia-sun-protect', size: '60 g', quantity: 2 }],
      }]) as never
      return Promise.resolve({}) as never
    })

    render(<CustomerAccount open onClose={() => undefined} apiAvailable onCustomerChange={() => undefined} initialSection="waitlist" />)

    expect(await screen.findByText('SFWL-2026-12AB34CD56')).toBeInTheDocument()
    expect(screen.getByText(/use your waitlist id whenever you contact skinfox/i)).toBeInTheDocument()
    expect(screen.queryByText('private-reservation-token')).not.toBeInTheDocument()
  })
})

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Header } from './Header'

const props = {
  cartCount: 0,
  onAccount: vi.fn(),
  onCart: vi.fn(),
  onQuiz: vi.fn(),
  onSearch: vi.fn(),
}

describe('Header mobile menu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.className = ''
  })

  it('keeps every mobile navigation action available and locks the page behind the menu', async () => {
    render(<Header {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))

    expect(document.body).toHaveClass('is-locked')
    const mobileNavigation = screen.getByRole('navigation', { name: 'Mobile navigation' })
    expect(mobileNavigation).toBeInTheDocument()
    expect(within(mobileNavigation).getByRole('link', { name: 'Shop the edit' })).toHaveAttribute('href', '#shop')
    expect(within(mobileNavigation).getByRole('button', { name: 'My account' })).toBeInTheDocument()
    expect(within(mobileNavigation).getByRole('button', { name: 'Find my care' })).toBeInTheDocument()
    expect(within(mobileNavigation).getByRole('link', { name: 'Explore the range' })).toHaveAttribute('href', '#range')
    expect(within(mobileNavigation).getByRole('link', { name: 'Our story' })).toHaveAttribute('href', '#story')
    expect(within(mobileNavigation).getByRole('link', { name: 'Care & support' })).toHaveAttribute('href', '#faq')

    const desktopNavigation = screen.getByRole('navigation', { name: 'Main navigation' })
    const desktopLinks = within(desktopNavigation).getAllByRole('link')
    expect(desktopLinks.map((link) => link.getAttribute('href'))).toEqual(['#shop', '#range', '#story', '#faq'])
    expect(desktopLinks.map((link) => link.textContent)).toEqual(['Shop the edit', 'Explore the range', 'Our story', 'Care & support'])

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
      expect(document.body).not.toHaveClass('is-locked')
    })
  })

  it('shows the marked account options for a signed-in customer', () => {
    const onLogout = vi.fn()
    render(<Header {...props} customerName="Vishal" onLogout={onLogout} />)

    fireEvent.click(screen.getByRole('button', { name: /open account for vishal/i }))
    const menu = screen.getByRole('menu', { name: 'Your account' })
    for (const label of ['My Profile', 'Orders', 'Supercoin', 'Saved Cards & Wallet', 'Saved Addresses', 'Notifications', 'Logout']) {
      expect(within(menu).getByRole('menuitem', { name: label })).toBeInTheDocument()
    }

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Saved Addresses' }))
    expect(props.onAccount).toHaveBeenCalledWith('addresses')

    fireEvent.click(screen.getByRole('button', { name: /open account for vishal/i }))
    fireEvent.click(within(screen.getByRole('menu', { name: 'Your account' })).getByRole('menuitem', { name: 'Logout' }))
    expect(onLogout).toHaveBeenCalledOnce()
  })
})

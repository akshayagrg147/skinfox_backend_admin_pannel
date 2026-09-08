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
    expect(within(mobileNavigation).getByRole('link', { name: 'Shop the collection' })).toHaveAttribute('href', '#shop')
    expect(within(mobileNavigation).getByRole('button', { name: 'My account' })).toBeInTheDocument()
    expect(within(mobileNavigation).getByRole('button', { name: 'Find my care' })).toBeInTheDocument()
    expect(within(mobileNavigation).getByRole('link', { name: 'Label transparency' })).toHaveAttribute('href', '#ingredients')
    expect(within(mobileNavigation).getByRole('link', { name: 'Our story' })).toHaveAttribute('href', '#story')
    expect(within(mobileNavigation).getByRole('link', { name: 'Questions, answered' })).toHaveAttribute('href', '#faq')

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
      expect(document.body).not.toHaveClass('is-locked')
    })
  })
})

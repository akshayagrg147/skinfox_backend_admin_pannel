import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LegalPage } from './LegalPage'

describe('LegalPage', () => {
  it('presents the customer privacy policy and a privacy contact route', () => {
    render(<LegalPage kind="privacy" onBack={() => undefined} />)

    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'contact@skinfox.in' })[0]).toHaveAttribute('href', 'mailto:contact@skinfox.in')
    expect(screen.getByRole('heading', { name: /your choices and rights/i })).toBeInTheDocument()
  })

  it('presents terms, including customer order and account information', () => {
    const onBack = vi.fn()
    render(<LegalPage kind="terms" onBack={onBack} />)

    expect(screen.getByRole('heading', { name: 'Terms & Conditions' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /orders, availability and pricing/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /customer accounts and otp/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /back to store/i }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})

import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LaunchOfferPopup } from './LaunchOfferPopup'

const promotion = {
  id: 'launch-40',
  enabled: true,
  discountPercent: 40,
  maximumOrders: 500,
  successfulOrders: 180,
  offlineReservations: 0,
  remainingOrders: 320,
  status: 'active' as const,
  message: 'Launch offer',
}

describe('LaunchOfferPopup', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => vi.useRealTimers())

  it('reveals the live launch offer after a short delay and dismisses it', () => {
    render(<LaunchOfferPopup promotion={promotion} eligible />)

    expect(screen.queryByRole('dialog', { name: 'SkinFox launch offer' })).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(900))

    expect(screen.getByRole('dialog', { name: 'SkinFox launch offer' })).toBeInTheDocument()
    expect(screen.getByLabelText('320 of 500 launch reservations remain')).toHaveTextContent('320reservations left')
    expect(screen.getByRole('link', { name: /shop the offer/i })).toHaveAttribute('href', '#shop')

    fireEvent.click(screen.getByRole('button', { name: /maybe later/i }))
    expect(document.body).not.toHaveClass('is-locked')
    expect(sessionStorage.getItem('skinfox-launch-offer-seen:launch-40')).toBe('seen')
  })

  it('does not interrupt the visitor again during the same browser session', () => {
    sessionStorage.setItem('skinfox-launch-offer-seen:launch-40', 'seen')
    render(<LaunchOfferPopup promotion={promotion} eligible />)

    act(() => vi.advanceTimersByTime(2_000))
    expect(screen.queryByRole('dialog', { name: 'SkinFox launch offer' })).not.toBeInTheDocument()
  })

  it('stays hidden when the launch offer is not eligible', () => {
    render(<LaunchOfferPopup promotion={promotion} eligible={false} />)

    act(() => vi.advanceTimersByTime(2_000))
    expect(screen.queryByRole('dialog', { name: 'SkinFox launch offer' })).not.toBeInTheDocument()
  })
})

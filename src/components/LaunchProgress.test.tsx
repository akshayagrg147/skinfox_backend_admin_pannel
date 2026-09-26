import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LaunchProgress } from './LaunchProgress'

describe('LaunchProgress', () => {
  it('uses the live promotion values for the compact announcement counter', () => {
    render(<LaunchProgress promotion={{
      id: 'launch',
      enabled: true,
      discountPercent: 40,
      maximumOrders: 500,
      successfulOrders: 180,
      remainingOrders: 320,
      status: 'active',
      message: 'Launch access',
    }} />)

    expect(screen.getByLabelText('320 of 500 launch orders remain')).toHaveTextContent('320orders left')
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getProductById } from '../data/products'
import { HydrelleRoutineComparison } from './HydrelleRoutineComparison'

const hydrelle = getProductById('hydrelle-dry-skin-specialist')

describe('HydrelleRoutineComparison', () => {
  it('presents the illustrative comparison and the exact Hydrelle pack with an honest disclaimer', () => {
    render(<HydrelleRoutineComparison product={hydrelle} onView={vi.fn()} />)

    expect(screen.getByRole('region', { name: /before the ritual/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /side-by-side moisture ritual visual/i })).toHaveAttribute(
      'src',
      '/products/hydrelle-routine-comparison-v1.webp',
    )
    expect(screen.getByRole('img', { name: /hydrelle 200 g moisturising lotion tube/i })).toHaveAttribute(
      'src',
      hydrelle.storyImage,
    )
    const supportingViews = screen.getByRole('list', { name: /illustrative pore and pigmentation/i })
    expect(screen.getAllByRole('img', { name: /fictional adult model/i })).toHaveLength(3)
    expect(supportingViews).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /appearance of visible pores/i })).toHaveAttribute(
      'src',
      '/products/hydrelle-pore-appearance-study-v1.webp',
    )
    expect(screen.getByRole('img', { name: /uneven pigmentation/i })).toHaveAttribute(
      'src',
      '/products/hydrelle-pigmentation-study-v1.webp',
    )
    expect(screen.getByText(/not actual customer results/i)).toBeInTheDocument()
  })

  it('opens the Hydrelle product details from the comparison', () => {
    const onView = vi.fn()
    render(<HydrelleRoutineComparison product={hydrelle} onView={onView} />)

    fireEvent.click(screen.getByRole('button', { name: /explore hydrelle/i }))
    expect(onView).toHaveBeenCalledWith(hydrelle)
  })
})

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { products } from '../data/products'
import { RoutineQuiz } from './RoutineQuiz'
import { getStorefront, postStorefront } from '../lib/storefrontApi'

vi.mock('../lib/storefrontApi', () => ({ postStorefront: vi.fn(), getStorefront: vi.fn() }))
const mockedPost = vi.mocked(postStorefront)
const mockedGet = vi.mocked(getStorefront)

const finder = {
  questions: [
    { key: 'careArea', prompt: 'Where shall we begin?', options: [{ value: 'skin', label: 'Skin' }] },
    { key: 'secondaryGoals', prompt: 'What else matters to you?', selectionMode: 'multi' as const, required: true, options: [{ value: 'comfort', label: 'Comfort' }, { value: 'moisture', label: 'Moisture' }] },
    { key: 'routinePreference', prompt: 'Choose your rhythm', options: [{ value: 'simple', label: 'Simple' }] },
  ],
}

const skipPhotoStep = () => fireEvent.click(screen.getByRole('button', { name: 'Continue without a photo' }))

describe('SkinFox care guide navigation', () => {
  beforeEach(() => {
    sessionStorage.clear()
    // Default: no analysis available, so the questions run unchanged.
    mockedPost.mockRejectedValue(new Error('offline'))
    mockedGet.mockResolvedValue({ configured: true, allowed: true, remaining: 2, limit: 2 })
  })

  it('announces each new question and preserves multi-select focus and answers when navigating back', async () => {
    render(<RoutineQuiz open onClose={vi.fn()} onAdd={vi.fn()} catalogue={products} finder={finder} />)
    skipPhotoStep()

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Where shall we begin?' })).toHaveFocus())
    fireEvent.click(screen.getByRole('button', { name: 'Skin' }))
    const nextQuestion = await screen.findByRole('heading', { name: 'What else matters to you?' })
    await waitFor(() => expect(nextQuestion).toHaveFocus())
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    const comfort = screen.getByRole('button', { name: 'Comfort' })
    comfort.focus()
    fireEvent.click(comfort)
    expect(comfort).toHaveFocus()
    expect(comfort).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Moisture' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('heading', { name: 'Choose your rhythm' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('button', { name: 'Comfort' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Moisture' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('cancels an automatic question advance when the finder is closed and reopened', async () => {
    const props = { onClose: vi.fn(), onAdd: vi.fn(), catalogue: products, finder }
    const { rerender } = render(<RoutineQuiz {...props} open />)
    skipPhotoStep()
    fireEvent.click(screen.getByRole('button', { name: 'Skin' }))
    expect(screen.getByRole('button', { name: 'Skin' })).toBeDisabled()
    rerender(<RoutineQuiz {...props} open={false} />)
    rerender(<RoutineQuiz {...props} open />)
    skipPhotoStep()
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 220)) })

    expect(screen.getByRole('heading', { name: 'Where shall we begin?' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'What else matters to you?' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skin' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps an optional reference photo on the device and out of the saved session', async () => {
    // jsdom decodes no images, so stand in for the canvas normalisation step.
    class DecodableImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      naturalWidth = 64
      naturalHeight = 64
      set src(_value: string) { setTimeout(() => this.onload?.(), 0) }
    }
    vi.stubGlobal('Image', DecodableImage)

    const { container } = render(<RoutineQuiz open onClose={vi.fn()} onAdd={vi.fn()} catalogue={products} finder={finder} />)

    expect(screen.getByRole('heading', { name: 'Start with a photo?' })).toBeInTheDocument()

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [new File(['pixels'], 'face.png', { type: 'image/png' })] } })

    const reference = await screen.findByAltText(/your reference photo/i)
    expect(reference.getAttribute('src')).toMatch(/^data:image\/png/)
    expect(screen.getByRole('heading', { name: 'Where shall we begin?' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Skin' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Comfort' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Simple' }))

    await waitFor(() => expect(sessionStorage.getItem('skinfox-care-finder-session')).toBeTruthy())
    expect(sessionStorage.getItem('skinfox-care-finder-session')).not.toContain('data:image')
  })

  it('offers a fallback when the browser cannot open the camera', async () => {
    render(<RoutineQuiz open onClose={vi.fn()} onAdd={vi.fn()} catalogue={products} finder={finder} />)

    fireEvent.click(screen.getByRole('button', { name: /take a photo/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/camera/i)
    expect(screen.getByRole('button', { name: /choose a photo/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Start with a photo?' })).toBeInTheDocument()
  })

  it('releases the camera when the finder is closed', async () => {
    const stop = vi.fn()
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
    const props = { onClose: vi.fn(), onAdd: vi.fn(), catalogue: products, finder }

    const { rerender } = render(<RoutineQuiz {...props} open />)
    fireEvent.click(screen.getByRole('button', { name: /take a photo/i }))

    await waitFor(() => expect(getUserMedia).toHaveBeenCalled())
    const preview = await screen.findByLabelText('Camera preview')
    // The stream must actually reach the element, not just be opened.
    await waitFor(() => expect((preview as HTMLVideoElement).srcObject).toBe(stream))
    expect(stop).not.toHaveBeenCalled()

    rerender(<RoutineQuiz {...props} open={false} />)
    await waitFor(() => expect(stop).toHaveBeenCalled())
  })

  it('pre-fills answers from the photo analysis and skips what it already knows', async () => {
    class DecodableImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      naturalWidth = 64
      naturalHeight = 64
      set src(_value: string) { setTimeout(() => this.onload?.(), 0) }
    }
    vi.stubGlobal('Image', DecodableImage)
    mockedPost.mockResolvedValue({
      configured: true,
      usable: true,
      observations: ['Skin looks dry across the cheeks'],
      answers: { careArea: 'skin' },
      note: 'Cosmetic guidance only.',
    })

    const { container } = render(<RoutineQuiz open onClose={vi.fn()} onAdd={vi.fn()} catalogue={products} finder={finder} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [new File(['pixels'], 'face.png', { type: 'image/png' })] } })

    // The first question was answered by the photo, so the flow lands on the second.
    expect(await screen.findByRole('heading', { name: 'What else matters to you?' })).toBeInTheDocument()
    expect(screen.getByText('Skin looks dry across the cheeks')).toBeInTheDocument()
    expect(screen.getByText('Cosmetic guidance only.')).toBeInTheDocument()

    const [, body] = mockedPost.mock.calls[0]
    expect((body as { image: string }).image).toMatch(/^data:image\//)
  })

  it('replaces capture with the questions once the daily photo limit is used up', async () => {
    mockedGet.mockResolvedValue({ configured: true, allowed: false, remaining: 0, limit: 2 })

    render(<RoutineQuiz open onClose={vi.fn()} onAdd={vi.fn()} catalogue={products} finder={finder} />)

    expect(await screen.findByRole('heading', { name: 'Let’s carry on with the questions.' })).toBeInTheDocument()
    expect(screen.getByText(/used today’s 2 photo checks/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /take a photo/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /continue to the questions/i }))
    expect(screen.getByRole('heading', { name: 'Where shall we begin?' })).toBeInTheDocument()
  })

  it('shows how many photo checks are left', async () => {
    mockedGet.mockResolvedValue({ configured: true, allowed: true, remaining: 1, limit: 2 })

    render(<RoutineQuiz open onClose={vi.fn()} onAdd={vi.fn()} catalogue={products} finder={finder} />)

    expect(await screen.findByText('1 of 2 photo checks left today')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /take a photo/i })).toBeInTheDocument()
  })

  it('hydrates API recommendation prices and keeps every recommended product in the routine', async () => {
    const recommendation = {
      package: {
        name: 'The Skin Reset',
        description: 'A considered edit.',
        totalPaise: 0,
        mrpTotalPaise: 0,
        savingsPaise: 0,
        items: [
          { product: { slug: 'rayyvia-sun-protect' }, role: 'essential', reason: 'Protection', frequency: 'Daily', days: ['Every day'], timeOfDay: 'Morning', instructions: 'Follow the label.', guidanceStatus: 'approved', pricePaise: 52500, mrpPaise: 70000 },
          { product: { slug: 'coco-kiss-moisturizing-lotion' }, role: 'essential', reason: 'Moisture', frequency: 'As directed on pack', days: ['As directed'], timeOfDay: 'As directed', instructions: 'Follow the label.', guidanceStatus: 'approved', pricePaise: 45000, mrpPaise: 60000 },
        ],
      },
      summary: { careArea: 'skin', primaryGoal: 'dry_skin', secondaryGoals: [] },
      routine: { weeklyPlan: [], repeatForDays: 30 },
      guidanceReview: [],
      explanation: 'Two products matched.',
      disclaimer: 'Cosmetic care guidance only.',
      guidanceNote: 'Follow the label.',
    }
    sessionStorage.setItem('skinfox-care-finder-session', JSON.stringify({ answers: { careArea: 'skin' }, result: recommendation }))

    render(<RoutineQuiz open onClose={vi.fn()} onAdd={vi.fn()} catalogue={products} finder={finder} />)

    expect(await screen.findByText('₹525')).toBeInTheDocument()
    expect(screen.getByText('₹450')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your complete care rhythm.' })).toBeInTheDocument()
    expect(screen.getByText('Daily focus')).toBeInTheDocument()
    expect(screen.getByText('Weekly rhythm')).toBeInTheDocument()
    expect(screen.getByText('Monthly consistency')).toBeInTheDocument()
    expect(screen.getAllByText('Coco Kiss').length).toBeGreaterThan(1)
    expect(screen.getAllByText('Rayyvia Sun Protect').length).toBeGreaterThan(1)
    expect(screen.queryByText(/N\/A/i)).not.toBeInTheDocument()
  })
})

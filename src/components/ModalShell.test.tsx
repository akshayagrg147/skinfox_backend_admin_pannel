import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { ModalShell } from './ModalShell'

function ChangingModal() {
  const [value, setValue] = useState('')
  return <ModalShell open onClose={() => undefined} title="Test dialog"><input aria-label="Phone number" value={value} onChange={(event) => setValue(event.target.value)} /></ModalShell>
}

describe('ModalShell focus management', () => {
  it('keeps a form input focused when modal content rerenders', async () => {
    render(<ChangingModal />)
    const close = screen.getByRole('button', { name: 'Close Test dialog' })
    await waitFor(() => expect(close).toHaveFocus())

    const input = screen.getByRole('textbox', { name: 'Phone number' })
    input.focus()
    fireEvent.change(input, { target: { value: '9' } })
    await new Promise((resolve) => window.setTimeout(resolve, 60))

    expect(input).toHaveFocus()
    expect(input).toHaveValue('9')
  })
})

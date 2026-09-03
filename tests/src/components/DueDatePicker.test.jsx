import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DueDatePicker from '../../../src/components/DueDatePicker.jsx'

const TZ = 'America/Detroit' // UTC-4 in September — west of Greenwich on purpose

function dateInput() {
  return screen.getByLabelText('due date')
}

describe('DueDatePicker', () => {
  it('saves a picked date as an instant inside that local day', async () => {
    const onSave = vi.fn()
    render(<DueDatePicker dueAt={null} timezone={TZ} onSave={onSave} />)
    await userEvent.type(dateInput(), '2026-09-11')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    const [iso] = onSave.mock.calls[0]
    const local = new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
    expect(local).toBe('2026-09-11')
  })

  it('does not land the deadline on the previous day west of Greenwich', () => {
    // The trap: `new Date('2026-09-11')` is UTC midnight, which is still the
    // 10th at 8pm in Detroit. A picker built that way silently moves every
    // deadline a day earlier for half the planet.
    const naive = new Date('2026-09-11')
    expect(naive.toLocaleDateString('en-CA', { timeZone: TZ })).toBe('2026-09-10')
  })

  it('clears the date rather than deleting anything else', async () => {
    const onSave = vi.fn()
    render(<DueDatePicker dueAt="2026-09-11T23:59:59.999Z" timezone={TZ} onSave={onSave} />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    // null IS how an entry stops being a task — there is no separate delete.
    expect(onSave).toHaveBeenCalledWith(null)
  })

  it('offers no Clear button when there is nothing to clear', () => {
    render(<DueDatePicker dueAt={null} timezone={TZ} onSave={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
  })

  it('seeds the field with the local day, not the UTC one', () => {
    // 11:59:59pm on Sep 11 in Detroit is already Sep 12 in UTC. Slicing the ISO
    // string would show the picker open on the wrong day.
    render(<DueDatePicker dueAt="2026-09-12T03:59:59.999Z" timezone={TZ} onSave={vi.fn()} />)
    expect(dateInput()).toHaveValue('2026-09-11')
  })

  it('cancels without saving', async () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(<DueDatePicker dueAt={null} timezone={TZ} onSave={onSave} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})

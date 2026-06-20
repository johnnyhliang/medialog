import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import EntryCard from './src/components/EntryCard.jsx'

vi.mock('./src/components/NoteEditor.jsx', () => ({
  default: ({ value, onChange }) => (
    <textarea aria-label="note editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

const base = { id: 'x', url: 'http://a.com', title: 'A Site', note: 'my **takeaway**', status: null, tags: [], pinned: false }
const noop = () => {}
const handlers = { onDelete: noop, onStatusChange: noop, onTagsChange: noop, onTogglePin: noop, onNoteSave: noop }

async function expandCard(container) {
  const card = container.querySelector('.card-collapsed')
  if (card) {
    console.log('Before click, card has class:', card.className)
    await userEvent.click(card)
    console.log('After click, card has class:', card.className)
    
    // Try waiting for the card to expand
    await waitFor(() => {
      const cardNow = container.querySelector('.card:not(.card-collapsed)')
      console.log('Looking for expanded card:', !!cardNow)
      if (!cardNow) throw new Error('Card not expanded')
    }, { timeout: 1000 })
  }
}

test('edits the note and saves on Done - debug', async () => {
  const onNoteSave = vi.fn()
  const { container } = render(<EntryCard entry={base} {...handlers} onNoteSave={onNoteSave} />)
  try {
    await expandCard(container)
    const button = screen.getByRole('button', { name: /edit/i })
    console.log('Edit button found:', !!button)
  } catch (e) {
    console.error('Error:', e.message)
    const card = container.querySelector('.card')
    console.log('Card element:', card?.outerHTML?.substring(0, 200))
  }
})

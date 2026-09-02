import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect, beforeEach } from 'vitest'
import ResurfaceWidget from '../../../../src/components/widgets/ResurfaceWidget.jsx'
import { listResurfaceHighlights } from '../../../../src/lib/db/review.js'

vi.mock('../../../../src/lib/db/review.js', () => ({ listResurfaceHighlights: vi.fn() }))

const hl = (id, over = {}) => ({
  id,
  text: `quote ${id}`,
  created_at: '2026-03-14T00:00:00.000Z',
  entries: { id: `e${id}`, title: `Article ${id}`, url: null },
  ...over,
})

beforeEach(() => vi.clearAllMocks())

test('renders two quotes with their source and the month they were saved', async () => {
  listResurfaceHighlights.mockResolvedValue([hl('1'), hl('2'), hl('3'), hl('4')])
  render(<ResurfaceWidget supabase={{}} onOpenEntry={vi.fn()} />)
  await screen.findByText('from your archive')
  expect(screen.getAllByRole('button')).toHaveLength(2)
  expect(screen.getAllByText(/saved March 2026/)).toHaveLength(2)
})

test('the picks are stable within a day', async () => {
  // The rotation is seeded by the day number, not by Math.random — the point
  // is that revisiting Home does not reshuffle the cards under the user.
  const rows = ['1', '2', '3', '4', '5'].map((i) => hl(i))
  listResurfaceHighlights.mockResolvedValue(rows)
  const first = render(<ResurfaceWidget supabase={{}} onOpenEntry={vi.fn()} />)
  const a = (await first.findAllByRole('button')).map((b) => b.textContent)
  first.unmount()
  const second = render(<ResurfaceWidget supabase={{}} onOpenEntry={vi.fn()} />)
  const b = (await second.findAllByRole('button')).map((btn) => btn.textContent)
  expect(b).toEqual(a)
})

test('clicking a quote opens its source entry', async () => {
  listResurfaceHighlights.mockResolvedValue([hl('1')])
  const onOpenEntry = vi.fn()
  render(<ResurfaceWidget supabase={{}} onOpenEntry={onOpenEntry} />)
  await userEvent.click(await screen.findByRole('button'))
  expect(onOpenEntry).toHaveBeenCalledWith({ id: 'e1', title: 'Article 1', url: null })
})

test('renders nothing when there are no old highlights', async () => {
  listResurfaceHighlights.mockResolvedValue([])
  const { container } = render(<ResurfaceWidget supabase={{}} onOpenEntry={vi.fn()} />)
  await vi.waitFor(() => expect(listResurfaceHighlights).toHaveBeenCalled())
  expect(container.textContent).toBe('')
})

test('renders nothing when the query fails', async () => {
  // A widget that quietly disappears is the right answer for an optional
  // extra; what changed is that the db layer can no longer hand it an empty
  // list *instead of* an error, so this is now a choice rather than a bug.
  listResurfaceHighlights.mockRejectedValue(new Error('down'))
  const { container } = render(<ResurfaceWidget supabase={{}} onOpenEntry={vi.fn()} />)
  await vi.waitFor(() => expect(listResurfaceHighlights).toHaveBeenCalled())
  expect(container.textContent).toBe('')
})

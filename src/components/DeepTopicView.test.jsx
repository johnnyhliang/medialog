import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, test, expect, beforeEach } from 'vitest'
import DeepTopicView from './DeepTopicView.jsx'

const state = {
  topic: { id: 't1', name: 'Trading & Exchanges', source_kind: 'book', source_url: null, cursor_section_id: 's1' },
  sections: [
    { id: 's1', title: 'Ch.1 Order books', position: 1, status: 'reading' },
    { id: 's2', title: 'Ch.2 Spread', position: 2, status: 'todo' },
  ],
  takeaways: [
    { id: 'e1', section_id: 's1', takeaway: 'price-time priority', note: '', parent_id: null },
  ],
}

vi.mock('../lib/db/deepTopics.js', () => ({
  getDeepTopic: vi.fn(async () => state),
  addSection: vi.fn(async ({ title, position }) => ({ id: 's3', title, position, status: 'todo' })),
  setCursor: vi.fn(async () => {}),
  setSectionStatus: vi.fn(async () => {}),
  addTakeaway: vi.fn(async ({ takeaway, sectionId }) => ({ id: 'e2', section_id: sectionId, takeaway, note: '', parent_id: null })),
  updateTakeaway: vi.fn(async () => {}),
}))

vi.mock('./PdfViewer.jsx', () => ({ default: ({ url }) => <div data-testid="pdf">{url}</div> }))

beforeEach(() => vi.clearAllMocks())

test('renders sections and the cursor takeaway', async () => {
  render(<DeepTopicView supabase={{}} topicId="t1" onBack={vi.fn()} addToast={vi.fn()} />)
  expect((await screen.findAllByText('Ch.1 Order books'))[0]).toBeTruthy()
  expect(screen.getByText('price-time priority')).toBeTruthy()
})

test('adds a takeaway to the current section', async () => {
  const { addTakeaway } = await import('../lib/db/deepTopics.js')
  render(<DeepTopicView supabase={{}} topicId="t1" onBack={vi.fn()} addToast={vi.fn()} />)
  await screen.findAllByText('Ch.1 Order books')
  fireEvent.change(screen.getByPlaceholderText(/takeaway/i), { target: { value: 'market vs limit' } })
  fireEvent.click(screen.getByRole('button', { name: /save takeaway/i }))
  await waitFor(() => expect(addTakeaway).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ topicId: 't1', sectionId: 's1', takeaway: 'market vs limit' }),
  ))
})

test('adds a section and advances the cursor to it', async () => {
  const { addSection, setCursor } = await import('../lib/db/deepTopics.js')
  render(<DeepTopicView supabase={{}} topicId="t1" onBack={vi.fn()} addToast={vi.fn()} />)
  await screen.findAllByText('Ch.1 Order books')
  fireEvent.change(screen.getByPlaceholderText(/add section/i), { target: { value: 'Ch.3 Inventory' } })
  fireEvent.click(screen.getByRole('button', { name: /^add section$/i }))
  await waitFor(() => expect(addSection).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ topicId: 't1', title: 'Ch.3 Inventory', position: 3 }),
  ))
})

test('renders a PDF source pane for pdf resources', async () => {
  const { getDeepTopic } = await import('../lib/db/deepTopics.js')
  getDeepTopic.mockResolvedValueOnce({
    ...state,
    topic: { ...state.topic, source_kind: 'pdf', source_url: 'https://x/f.pdf' },
  })
  render(<DeepTopicView supabase={{}} topicId="t1" onBack={vi.fn()} addToast={vi.fn()} />)
  expect(await screen.findByTestId('pdf')).toHaveTextContent('https://x/f.pdf')
})

test('renders an open-source link for web resources', async () => {
  const { getDeepTopic } = await import('../lib/db/deepTopics.js')
  getDeepTopic.mockResolvedValueOnce({
    ...state,
    topic: { ...state.topic, source_kind: 'web', source_url: 'https://example.com/a' },
  })
  render(<DeepTopicView supabase={{}} topicId="t1" onBack={vi.fn()} addToast={vi.fn()} />)
  expect(await screen.findByRole('link', { name: /open source/i })).toHaveAttribute('href', 'https://example.com/a')
})

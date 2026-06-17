import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import NoteEditor from './NoteEditor.jsx'

vi.mock('./MarkdownView.jsx', () => ({
  default: ({ children }) => <div data-testid="preview">{children}</div>,
}))

vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange }) => (
    <textarea aria-label="codemirror" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

const supabase = { auth: { getUser: vi.fn() }, storage: { from: vi.fn() } }

test('switches between write, preview, and split modes', async () => {
  render(<NoteEditor value="hello" onChange={() => {}} supabase={supabase} />)
  expect(screen.getByLabelText('codemirror')).toBeInTheDocument()
  expect(screen.queryByTestId('preview')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('tab', { name: 'preview' }))
  expect(screen.queryByLabelText('codemirror')).not.toBeInTheDocument()
  expect(screen.getByTestId('preview')).toHaveTextContent('hello')

  await userEvent.click(screen.getByRole('tab', { name: 'split' }))
  expect(screen.getByLabelText('codemirror')).toBeInTheDocument()
  expect(screen.getByTestId('preview')).toBeInTheDocument()
})

test('shows attach button when supabase is provided', () => {
  render(<NoteEditor value="" onChange={() => {}} supabase={supabase} />)
  expect(screen.getByRole('button', { name: 'Attach' })).toBeInTheDocument()
})

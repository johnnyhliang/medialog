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

// Uploads is now the 'uploads' module (minTier 'founder', defaultOn false), so
// visibility depends on tier AND preference — see src/lib/modules.js. The mock has
// to answer both reads: user_entitlements for tier, user_configs for module prefs.
const makeSupabase = ({ tier = 'founder', modules = { __grandfathered: true } } = {}) => ({
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
  storage: { from: vi.fn() },
  from: vi.fn((table) => ({
    select: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue({
        data: table === 'user_entitlements'
          ? { tier, expires_at: null }
          : { modules },
        error: null,
      }),
    })),
  })),
})

const supabase = makeSupabase()

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

test('shows the attach button when the uploads module is visible', async () => {
  render(<NoteEditor value="" onChange={() => {}} supabase={makeSupabase()} />)
  expect(await screen.findByRole('button', { name: /attach/i })).toBeInTheDocument()
})

test('hides the attach button when the module is switched off', async () => {
  render(<NoteEditor value="" onChange={() => {}}
    supabase={makeSupabase({ modules: { uploads: false } })} />)
  // Starts closed and only opens once entitlement resolves, so a slow round-trip
  // can never briefly expose a gated control. Give the effect a chance to run.
  await new Promise((r) => setTimeout(r, 0))
  expect(screen.queryByRole('button', { name: /attach/i })).not.toBeInTheDocument()
})

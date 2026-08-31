import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import NoteEditor from '../../../src/components/NoteEditor.jsx'

const uploadAttachment = vi.fn()
vi.mock('../../../src/lib/storage.js', async (orig) => ({
  ...(await orig()),
  uploadAttachment: (...args) => uploadAttachment(...args),
}))

vi.mock('../../../src/components/MarkdownView.jsx', () => ({
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

// 3.4 — an upload takes seconds and the user keeps typing through it. The old
// code snapshotted `value` before the first await and wrote that snapshot back,
// discarding every character typed during the upload.
test('keeps text typed during an upload', async () => {
  let release
  uploadAttachment.mockImplementation(
    () => new Promise((res) => { release = () => res({ url: 'http://x/i.png', thumbUrl: null }) }),
  )

  let current = 'before'
  const onChange = vi.fn((next) => { current = next; rerender(ui()) })
  const ui = () => <NoteEditor value={current} onChange={onChange} supabase={makeSupabase()} />
  const { rerender } = render(ui())

  const file = new File(['x'], 'i.png', { type: 'image/png' })
  await screen.findByRole('button', { name: /attach/i })
  await userEvent.upload(document.querySelector('input[type="file"]'), file)

  // Typing lands while the upload is still in flight.
  current = 'before + typed during the upload'
  rerender(ui())

  release()
  await waitFor(() => expect(onChange).toHaveBeenCalled())
  expect(onChange.mock.calls.at(-1)[0]).toContain('typed during the upload')
})

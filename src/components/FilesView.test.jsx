import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import FilesView from './FilesView.jsx'

vi.mock('./StorageBar.jsx', () => ({
  default: ({ totalBytes }) => <div data-testid="storage-bar">{totalBytes}</div>
}))
vi.mock('./FileRow.jsx', () => ({
  default: ({ file, onDeleteClick }) => (
    <div data-testid="file-row">
      <span>{file.name}</span>
      <button onClick={() => onDeleteClick(file, 'https://x/f', [])}>delete</button>
    </div>
  )
}))

const MB = 1024 * 1024

function makeFile(name, size = MB) {
  return { name, metadata: { size, mimetype: 'image/png' }, created_at: new Date().toISOString() }
}

function makeSupabase(files = []) {
  const bucket = {
    list: vi.fn().mockResolvedValue({ data: files }),
    remove: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://x/f' } }),
  }
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    storage: { from: () => bucket }
  }
}

test('shows loading state then file list', async () => {
  const supabase = makeSupabase([makeFile('a.jpg')])
  render(<FilesView supabase={supabase} onSelectEntry={() => {}} />)
  expect(screen.getByText(/loading/i)).toBeInTheDocument()
  await waitFor(() => expect(screen.getAllByTestId('file-row')).toHaveLength(1))
})

test('shows empty state when no files', async () => {
  const supabase = makeSupabase([])
  render(<FilesView supabase={supabase} onSelectEntry={() => {}} />)
  await waitFor(() => expect(screen.getByText(/no files uploaded/i)).toBeInTheDocument())
})

test('passes totalBytes to StorageBar', async () => {
  const files = [makeFile('a.jpg', 10 * MB), makeFile('b.jpg', 5 * MB)]
  render(<FilesView supabase={makeSupabase(files)} onSelectEntry={() => {}} />)
  await waitFor(() => expect(screen.getByTestId('storage-bar').textContent).toBe(String(15 * MB)))
})

test('shows sort buttons', async () => {
  render(<FilesView supabase={makeSupabase([makeFile('a.jpg')])} onSelectEntry={() => {}} />)
  await waitFor(() => screen.getByText('Date'))
  expect(screen.getByText('Size')).toBeInTheDocument()
  expect(screen.getByText('Type')).toBeInTheDocument()
})

test('shows delete confirm modal when delete clicked', async () => {
  const supabase = makeSupabase([makeFile('a.jpg')])
  render(<FilesView supabase={supabase} onSelectEntry={() => {}} />)
  await waitFor(() => screen.getAllByTestId('file-row'))
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  expect(screen.getByText(/delete file/i)).toBeInTheDocument()
})

test('removes file and re-fetches on confirm delete', async () => {
  const supabase = makeSupabase([makeFile('a.jpg')])
  render(<FilesView supabase={supabase} onSelectEntry={() => {}} />)
  await waitFor(() => screen.getAllByTestId('file-row'))
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  await userEvent.click(screen.getByRole('button', { name: /delete file/i }))
  expect(supabase.storage.from().remove).toHaveBeenCalled()
})

test('shows load more when more than 30 files', async () => {
  const files = Array.from({ length: 31 }, (_, i) => makeFile(`f${i}.jpg`))
  render(<FilesView supabase={makeSupabase(files)} onSelectEntry={() => {}} />)
  await waitFor(() => expect(screen.getByText(/load more/i)).toBeInTheDocument())
})

test('does not show load more for 30 or fewer files', async () => {
  const files = Array.from({ length: 30 }, (_, i) => makeFile(`f${i}.jpg`))
  render(<FilesView supabase={makeSupabase(files)} onSelectEntry={() => {}} />)
  await waitFor(() => screen.getAllByTestId('file-row'))
  expect(screen.queryByText(/load more/i)).not.toBeInTheDocument()
})

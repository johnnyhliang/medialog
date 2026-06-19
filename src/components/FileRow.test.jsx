import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import FileRow from './FileRow.jsx'

const imageFile = {
  name: 'abc123-00000000-0000-0000-0000-000000000000-photo.png',
  metadata: { size: 2.4 * 1024 * 1024, mimetype: 'image/png' },
  created_at: '2026-06-14T10:00:00Z',
}
const pdfFile = {
  name: 'abc123-00000000-0000-0000-0000-000000000000-report.pdf',
  metadata: { size: 1.1 * 1024 * 1024, mimetype: 'application/pdf' },
  created_at: '2026-06-12T10:00:00Z',
}

function makeSupabase(refs = []) {
  return {
    from: () => ({
      select: () => ({
        like: () => ({
          is: () => Promise.resolve({ data: refs })
        })
      })
    })
  }
}

test('renders image thumbnail for image files', () => {
  render(<FileRow file={imageFile} publicUrl="https://x/photo.png" supabase={makeSupabase()} onDeleteClick={() => {}} onSelectEntry={() => {}} />)
  expect(document.querySelector('img.file-thumb')).not.toBeNull()
})

test('renders file icon for PDFs', () => {
  const { container } = render(<FileRow file={pdfFile} publicUrl="https://x/report.pdf" supabase={makeSupabase()} onDeleteClick={() => {}} onSelectEntry={() => {}} />)
  expect(container.querySelector('img')).toBeNull()
  expect(container.querySelector('.file-icon')).not.toBeNull()
})

test('shows human-readable size', () => {
  render(<FileRow file={imageFile} publicUrl="https://x/photo.png" supabase={makeSupabase()} onDeleteClick={() => {}} onSelectEntry={() => {}} />)
  expect(screen.getByText(/2\.4 MB/i)).toBeInTheDocument()
})

test('shows upload date', () => {
  render(<FileRow file={imageFile} publicUrl="https://x/photo.png" supabase={makeSupabase()} onDeleteClick={() => {}} onSelectEntry={() => {}} />)
  expect(screen.getByText(/Jun 14/)).toBeInTheDocument()
})

test('shows entry quicklinks when references found', async () => {
  const refs = [{ id: 'e1', title: 'My AI essay', topic_id: 't1' }]
  render(<FileRow file={imageFile} publicUrl="https://x/photo.png" supabase={makeSupabase(refs)} onDeleteClick={() => {}} onSelectEntry={() => {}} />)
  await waitFor(() => expect(screen.getByText('My AI essay')).toBeInTheDocument())
})

test('calls onSelectEntry when reference link clicked', async () => {
  const refs = [{ id: 'e1', title: 'My AI essay', topic_id: 't1' }]
  const onSelectEntry = vi.fn()
  render(<FileRow file={imageFile} publicUrl="https://x/photo.png" supabase={makeSupabase(refs)} onDeleteClick={() => {}} onSelectEntry={onSelectEntry} />)
  await waitFor(() => screen.getByText('My AI essay'))
  await userEvent.click(screen.getByText('My AI essay'))
  expect(onSelectEntry).toHaveBeenCalledWith({ id: 'e1', title: 'My AI essay', topic_id: 't1' })
})

test('shows dash when no references', async () => {
  render(<FileRow file={imageFile} publicUrl="https://x/photo.png" supabase={makeSupabase([])} onDeleteClick={() => {}} onSelectEntry={() => {}} />)
  await waitFor(() => expect(screen.getByText(/used in: —/i)).toBeInTheDocument())
})

test('calls onDeleteClick with file, publicUrl, and refs when delete clicked', async () => {
  const refs = [{ id: 'e1', title: 'My AI essay', topic_id: 't1' }]
  const onDeleteClick = vi.fn()
  render(<FileRow file={imageFile} publicUrl="https://x/photo.png" supabase={makeSupabase(refs)} onDeleteClick={onDeleteClick} onSelectEntry={() => {}} />)
  await waitFor(() => screen.getByText('My AI essay'))
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  expect(onDeleteClick).toHaveBeenCalledWith(imageFile, 'https://x/photo.png', refs)
})

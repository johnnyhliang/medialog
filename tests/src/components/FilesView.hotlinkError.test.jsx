import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect, beforeEach } from 'vitest'
import FilesView from '../../../src/components/FilesView.jsx'

// Separate from FilesView.test.jsx because the hotlink scan needs `entries.js`
// and `snapshots.js` stubbed, and the uploads tests there deliberately run
// against the real modules.
vi.mock('../../../src/components/StorageBar.jsx', () => ({ default: () => <div /> }))
vi.mock('../../../src/components/FileRow.jsx', () => ({ default: () => <div /> }))
vi.mock('../../../src/lib/db/entries.js', () => ({ listNotesForHotlinks: vi.fn() }))
vi.mock('../../../src/lib/db/snapshots.js', () => ({
  listSnapshots: vi.fn(async () => []),
  archiveFile: vi.fn(),
  snapshotUrl: vi.fn(),
}))

const { listNotesForHotlinks } = await import('../../../src/lib/db/entries.js')

function makeSupabase() {
  const bucket = {
    list: vi.fn().mockResolvedValue({ data: [] }),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://x/f' } }),
    createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://x/s' }, error: null }),
  }
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    storage: { from: () => bucket },
  }
}

beforeEach(() => vi.clearAllMocks())

async function openHotlinked() {
  render(<FilesView supabase={makeSupabase()} onSelectEntry={vi.fn()} />)
  await userEvent.click(await screen.findByText('Hotlinked'))
}

// This view's entire job is telling you which files are at risk. "None found"
// when the scan actually died is the one wrong answer that costs the user
// something — they stop worrying about link rot on false evidence.
test('a failed scan says the scan failed, not that no files were found', async () => {
  listNotesForHotlinks.mockRejectedValue(new Error('permission denied'))
  await openHotlinked()
  expect(await screen.findByText(/couldn’t scan your notes/i)).toBeTruthy()
  expect(screen.getByText(/permission denied/)).toBeTruthy()
  expect(screen.queryByText(/No externally-hotlinked/i)).toBeNull()
  // and it must not be left stuck on the loading state either
  expect(screen.queryByText(/Scanning notes/i)).toBeNull()
})

test('a genuinely clean library still reports no hotlinked files, with no error', async () => {
  listNotesForHotlinks.mockResolvedValue([{ id: 'e1', title: 'plain', note: 'no images here' }])
  await openHotlinked()
  expect(await screen.findByText(/No externally-hotlinked/i)).toBeTruthy()
  expect(screen.queryByText(/couldn’t scan/i)).toBeNull()
})

// What happens in App.jsx when the database layer throws.
//
// Since the `lib/db/` sweep, a failed query throws instead of returning `[]`.
// These tests cover the two places where getting that wrong is worse than the
// original bug: a delete that mutates local state before the write is
// confirmed, and an error handler that itself throws.

import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('../../src/hooks/useSession.js', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } }, loading: false }),
}))

// vi.mock factories are hoisted above the module body, so anything they close
// over has to be hoisted too.
const { authGetUser, configRow, softDeleteTopic, runBackup } = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  configRow: {
    tier: 'founder',
    modules: { __grandfathered: true },
    auto_backup: true,
    github_token: 'ghp_test',
  },
  softDeleteTopic: vi.fn(),
  runBackup: vi.fn(),
}))

vi.mock('../../src/lib/supabaseClient.js', () => {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: configRow, error: null }),
    then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve),
  }
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        signOut: vi.fn(),
        getUser: authGetUser,
      },
      from: vi.fn().mockReturnValue(chainable),
      storage: {
        from: vi.fn().mockReturnValue({
          list: vi.fn().mockResolvedValue({ data: [] }),
          getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: '' } }),
        }),
      },
      functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    },
  }
})

const INBOX = { id: 'inbox', name: 'Inbox' }
const ALPHA = { id: 't-alpha', name: 'Alpha' }

vi.mock('../../src/lib/db/topics.js', async (importOriginal) => ({
  ...(await importOriginal()),
  listTopics: vi.fn(async () => [INBOX, ALPHA]),
  listDeletedTopics: vi.fn(async () => []),
  listProjects: vi.fn(async () => []),
  softDeleteTopic: (...args) => softDeleteTopic(...args),
}))

// The real sidebar buries the delete behind menus that are not what is under
// test; this stands in for it and calls the same prop App passes down.
vi.mock('../../src/components/TopicList.jsx', () => ({
  default: ({ topics, onDeleteTopic }) => (
    <ul>
      {topics.map((t) => (
        <li key={t.id}>
          <span>topic:{t.name}</span>
          <button onClick={() => onDeleteTopic(t.id)}>delete {t.name}</button>
        </li>
      ))}
    </ul>
  ),
}))

vi.mock('../../src/lib/db/githubBackup.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, runBackup: (...args) => runBackup(...args) }
})

import { supabase } from '../../src/lib/supabaseClient.js'
import { BackupRecordError } from '../../src/lib/db/githubBackup.js'
import App from '../../src/App.jsx'

beforeEach(() => {
  vi.clearAllMocks()
  authGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  runBackup.mockResolvedValue({ unchanged: true })
})

// ---------------------------------------------------------------------------
// Deleting a topic

test('a failed topic delete leaves the topic in local state', async () => {
  softDeleteTopic.mockRejectedValue(new Error('update on entries failed'))
  const user = userEvent.setup()

  await act(async () => { render(<App />) })
  expect(await screen.findByText('topic:Alpha')).toBeTruthy()

  await act(async () => { await user.click(screen.getByText('delete Alpha')) })

  // The write failed, so the topic is still there — and the UI says so rather
  // than claiming the delete worked.
  expect(screen.getByText('topic:Alpha')).toBeTruthy()
  expect(screen.queryByText('Topic moved to trash')).toBeNull()
  expect(screen.getByText('update on entries failed')).toBeTruthy()

  // And the rejection was handled rather than escaping the click handler.
  await new Promise((r) => setTimeout(r, 20))
  expect(unhandled).toEqual([])
})

test('a successful topic delete still removes the topic and toasts', async () => {
  softDeleteTopic.mockResolvedValue(undefined)
  const user = userEvent.setup()

  await act(async () => { render(<App />) })
  expect(await screen.findByText('topic:Alpha')).toBeTruthy()

  await act(async () => { await user.click(screen.getByText('delete Alpha')) })

  expect(screen.queryByText('topic:Alpha')).toBeNull()
  expect(screen.getByText('Topic moved to trash')).toBeTruthy()
})

// ---------------------------------------------------------------------------
// The auto-backup catch block

const unhandled = []
const onUnhandled = (reason) => { unhandled.push(reason) }

beforeEach(() => {
  unhandled.length = 0
  process.on('unhandledRejection', onUnhandled)
})
afterEach(() => { process.off('unhandledRejection', onUnhandled) })

// `beforeTick` runs after the app has mounted and before the backup timer
// fires, so a test can break auth for the backup path only. Breaking it for the
// whole render would trip unrelated start-up code and prove nothing about this
// handler.
async function fireAutoBackup(beforeTick) {
  vi.useFakeTimers()
  try {
    await act(async () => { render(<App />) })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    beforeTick?.()
    await act(async () => { await vi.advanceTimersByTimeAsync(120000) })
  } finally {
    vi.useRealTimers()
  }
  // Node reports an unhandled rejection at the end of a turn of the loop, so
  // give it one with real timers before asserting there was not one.
  await new Promise((r) => setTimeout(r, 20))
}

test('the auto-backup error handler survives an auth failure', async () => {
  runBackup.mockRejectedValue(new Error('github push failed'))
  // The shape a broken session actually returns: no data, an error. The old
  // inline `const { data: { user } } = ...` destructure threw a TypeError here,
  // from inside the catch that was supposed to be handling the first failure.
  await fireAutoBackup(() => {
    authGetUser.mockResolvedValue({ data: null, error: new Error('refresh token expired') })
  })

  expect(unhandled).toEqual([])
})

test('a BackupRecordError is not recorded as a failed backup', async () => {
  // The commit reached GitHub; only the bookkeeping row failed. Writing this to
  // last_error would tell the user their data is unsafe when it is not.
  runBackup.mockRejectedValue(new BackupRecordError(new Error('insert denied'), { counts: {} }))

  await fireAutoBackup()

  const wroteLastError = supabase.from('user_configs').update.mock.calls
    .some(([patch]) => patch && 'last_error' in patch)
  expect(wroteLastError).toBe(false)
  expect(unhandled).toEqual([])
})

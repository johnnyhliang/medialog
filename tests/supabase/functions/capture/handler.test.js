import { describe, test, expect } from 'vitest'
import { handleCapture } from '../../../../supabase/functions/capture/handler.ts'

const TOKEN = 'tok_abc'
const USER = 'user-1'

// A thenable query builder: every postgrest method records itself and returns
// `this`, so any chain the handler writes is accepted and awaiting the chain
// resolves to a canned result. Nothing here talks to Supabase.
function makeSupabase(state = {}) {
  const s = {
    userId: USER,
    inboxId: 'inbox-1',
    duplicate: null,
    insertError: null,
    ...state,
  }
  const chains = []
  const inserts = []

  const CHAIN = [
    'select', 'eq', 'is', 'not', 'order', 'range', 'in', 'delete',
    'maybeSingle', 'single', 'update', 'limit',
  ]

  function resultFor(b) {
    const inserted = b.ops.some((o) => o.name === 'insert')
    if (b.table === 'entries' && inserted) {
      return s.insertError
        ? { data: null, error: { message: s.insertError } }
        : { data: { id: 'entry-1' }, error: null }
    }
    if (b.table === 'entries') return { data: s.duplicate, error: null }
    if (b.table === 'topics') {
      return { data: s.inboxId ? { id: s.inboxId } : null, error: null }
    }
    return { data: [], error: null }
  }

  function builder(table) {
    const b = { table, ops: [] }
    for (const name of CHAIN) {
      b[name] = (...args) => {
        b.ops.push({ name, args })
        return b
      }
    }
    b.insert = (row) => {
      b.ops.push({ name: 'insert', args: [row] })
      inserts.push({ table, row })
      return b
    }
    b.then = (onOk, onErr) => Promise.resolve(resultFor(b)).then(onOk, onErr)
    chains.push(b)
    return b
  }

  return {
    from: (table) => builder(table),
    rpc: async () => ({ data: s.userId, error: null }),
    // Test-only views into what the handler did.
    _chains: chains,
    _inserts: inserts,
    _entryInsert: () => inserts.find((i) => i.table === 'entries')?.row ?? null,
    // A dedupe lookup is a read on `entries` that filtered on url.
    _dedupeLookups: () =>
      chains.filter(
        (c) =>
          c.table === 'entries' &&
          !c.ops.some((o) => o.name === 'insert') &&
          c.ops.some((o) => o.name === 'eq' && o.args[0] === 'url'),
      ),
  }
}

const env = (key) => (key === 'CAPTURE_SECRET' ? 'legacy-secret' : 'legacy-user')

function post(body) {
  return { method: 'POST', json: async () => body }
}

async function capture(body, state) {
  const supabase = makeSupabase(state)
  const res = await handleCapture(post({ token: TOKEN, ...body }), { supabase, env })
  return { res, body: await res.json(), supabase }
}

describe('capture handler', () => {
  test('a title with no url is a valid capture', async () => {
    const { res, body, supabase } = await capture({ title: 'Email the recruiter' })
    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, entry_id: 'entry-1', message: 'saved' })
    const row = supabase._entryInsert()
    expect(row.url).toBe(null)
    expect(row.title).toBe('Email the recruiter')
  })

  test('a url with no title still works', async () => {
    const { res, body, supabase } = await capture({ url: 'https://example.com/a' })
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(supabase._entryInsert().url).toBe('https://example.com/a')
  })

  test('neither url nor title is a bad_request', async () => {
    const { res, body, supabase } = await capture({ note: '' })
    expect(res.status).toBe(400)
    expect(body.error).toBe('bad_request')
    expect(supabase._entryInsert()).toBe(null)
  })

  test('a blank title is not a capture on its own', async () => {
    const { res, body } = await capture({ title: '   ' })
    expect(res.status).toBe(400)
    expect(body.error).toBe('bad_request')
  })

  test('an unsafe url is still rejected', async () => {
    for (const url of ['http://169.254.169.254/latest/meta-data/', 'file:///etc/passwd', 'http://localhost:8000']) {
      const { res, body, supabase } = await capture({ url, title: 'looks fine' })
      expect(res.status).toBe(400)
      expect(body.error).toBe('bad_request')
      // A title present must not buy a bad url a way past the SSRF guard.
      expect(supabase._entryInsert()).toBe(null)
    }
  })

  test('an unparseable due_at is a bad_request', async () => {
    for (const due of ['next friday', '2026-13-45T00:00:00Z', '', 12345]) {
      const { res, body } = await capture({ title: 'Task', due_at: due })
      if (due === '') {
        // Empty means "no deadline", not a malformed one.
        expect(res.status).toBe(200)
        continue
      }
      expect(res.status).toBe(400)
      expect(body.message).toMatch(/due_at/)
    }
  })

  test('a valid due_at is normalised and stored', async () => {
    const { res, supabase } = await capture({
      title: 'Email the recruiter',
      due_at: '2026-09-11T17:00:00Z',
    })
    expect(res.status).toBe(200)
    expect(supabase._entryInsert().due_at).toBe('2026-09-11T17:00:00.000Z')
  })

  test('no due_at stores null rather than an invalid date', async () => {
    const { supabase } = await capture({ title: 'Task' })
    expect(supabase._entryInsert().due_at).toBe(null)
  })

  test('the dedupe lookup is skipped when there is no url', async () => {
    const { supabase } = await capture({ title: 'Task' }, { duplicate: { id: 'other' } })
    // Deduping on a null url would collapse every task onto one row.
    expect(supabase._dedupeLookups()).toHaveLength(0)
    expect(supabase._entryInsert()).not.toBe(null)
  })

  test('the dedupe lookup still runs, and short-circuits, for a url', async () => {
    const { body, supabase } = await capture(
      { url: 'https://example.com/a' },
      { duplicate: { id: 'existing-1' } },
    )
    expect(supabase._dedupeLookups()).toHaveLength(1)
    expect(body).toMatchObject({ ok: true, duplicate: true, entry_id: 'existing-1' })
    expect(supabase._entryInsert()).toBe(null)
  })

  test('a kept title is curated; a note-mirrored one is not', async () => {
    const kept = await capture({ title: 'Email the recruiter' })
    expect(kept.supabase._entryInsert()).toMatchObject({
      title: 'Email the recruiter',
      title_edited: true,
    })

    // A note present mirrors, matching createEntry — otherwise a later note
    // edit would be blocked from updating a title the user never chose.
    const mirrored = await capture({ title: 'Ignored', note: '# Real heading\nbody' })
    expect(mirrored.supabase._entryInsert()).toMatchObject({
      title: 'Real heading',
      title_edited: false,
    })
  })

  test('missing auth is still unauthorized and writes nothing', async () => {
    const supabase = makeSupabase({ userId: null })
    const res = await handleCapture(post({ token: 'bad', title: 'x' }), { supabase, env })
    expect(res.status).toBe(401)
    expect(supabase._inserts).toHaveLength(0)
  })

  test('the legacy secret path still resolves a user', async () => {
    const supabase = makeSupabase()
    const res = await handleCapture(
      post({ secret: 'legacy-secret', title: 'x' }),
      { supabase, env },
    )
    expect(res.status).toBe(200)
    expect(supabase._entryInsert().user_id).toBe('legacy-user')
  })

  test('a missing Inbox is an internal error, not a silent drop', async () => {
    const { res, body, supabase } = await capture({ title: 'x' }, { inboxId: null })
    expect(res.status).toBe(500)
    expect(body.error).toBe('internal')
    expect(supabase._entryInsert()).toBe(null)
  })

  test('non-POST methods are unchanged', async () => {
    const supabase = makeSupabase()
    expect((await handleCapture({ method: 'OPTIONS' }, { supabase, env })).status).toBe(200)
    expect((await handleCapture({ method: 'GET' }, { supabase, env })).status).toBe(405)
  })
})

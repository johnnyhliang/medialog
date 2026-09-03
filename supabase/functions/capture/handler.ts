// The request logic lives here, apart from index.ts, so it can be unit-tested.
// index.ts statically imports `jsr:@supabase/supabase-js@2`, and a `jsr:`
// specifier is unresolvable outside Deno — vitest fails at transform time, not
// at runtime, so no amount of mocking rescues it. Everything this module needs
// from the outside world arrives as an argument instead.

import { isSafeUrl } from '../_shared/isSafeUrl.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_TITLE = 120

// A copy of src/lib/entryTitle.js. The two must agree, because an entry created
// here and one created in the app land in the same table — but the Supabase CLI
// only bundles files under supabase/, so the app's copy cannot be imported.
// Change one, change the other.
function computeTitle(note: string, url: string | null): string {
  const lines = String(note ?? '').split('\n')
  for (const line of lines) {
    const m = line.match(/^#\s+(.+)$/)
    if (m) return m[1].trim().slice(0, MAX_TITLE)
  }
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed) return trimmed.slice(0, MAX_TITLE)
  }
  return String(url ?? '').trim().slice(0, MAX_TITLE) || 'Untitled'
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })
}

function badRequest(message: string): Response {
  return json({ ok: false, error: 'bad_request', message }, 400)
}

// deno-lint-ignore no-explicit-any
type Supabase = any
type Env = (key: string) => string | undefined

export { cors }

export async function handleCapture(
  req: Request,
  { supabase, env }: { supabase: Supabase; env: Env },
): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors })

  const body = await req.json().catch(() => ({}))

  // Auth: a per-user capture token (0063), falling back to the legacy shared
  // secret. The legacy path exists only so existing bookmarklets/Shortcuts keep
  // working through the transition — it attributes every capture to one env-
  // configured account and its secret is inlined into the client bundle. Unset
  // CAPTURE_SECRET once tokens are issued; that is what closes the hole.
  let userId: string | null = null

  if (body.token) {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(String(body.token)),
    )
    const tokenHash = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const { data } = await supabase.rpc('resolve_capture_token', { p_token_hash: tokenHash })
    userId = (data as string | null) ?? null
  } else if (body.secret) {
    const legacy = env('CAPTURE_SECRET')
    if (legacy && body.secret === legacy) {
      userId = env('CAPTURE_USER_ID') ?? null
    }
  }

  if (!userId) {
    return json(
      { ok: false, error: 'unauthorized', message: 'Invalid or missing capture token' },
      401,
    )
  }

  // A capture is a link OR a task ("email the recruiter by Friday"), so a title
  // alone is enough. Requiring a url made the share-sheet useless for anything
  // that isn't a page.
  const url = body.url ? String(body.url) : null
  const rawTitle = typeof body.title === 'string' ? body.title.trim() : ''
  const title = rawTitle ? rawTitle.slice(0, MAX_TITLE) : null

  if (!url && !title) {
    return badRequest('url or title is required')
  }

  // Still the SSRF guard — only the "is it required" question changed, never
  // the "is it safe" one. enrich/snapshot fetch this url later.
  if (url && !isSafeUrl(url)) {
    return badRequest('URL must be a public http(s) address')
  }

  let dueAt: string | null = null
  if (body.due_at !== undefined && body.due_at !== null && body.due_at !== '') {
    // Date.parse of a non-date yields NaN rather than throwing, so an unchecked
    // value reaches Postgres as garbage and fails the insert with a 500 that
    // tells the phone nothing. Reject it here with the shape clients expect.
    const parsed = typeof body.due_at === 'string' ? Date.parse(body.due_at) : NaN
    if (Number.isNaN(parsed)) {
      return badRequest('due_at must be an ISO 8601 timestamp')
    }
    dueAt = new Date(parsed).toISOString()
  }

  async function log(ok: boolean, message: string, entryId?: string) {
    await supabase.from('capture_log').insert({
      user_id: userId,
      url,
      ok,
      message,
      entry_id: entryId ?? null,
    })
    // Prune: keep only the 100 most recent rows for this user
    const { data: old } = await supabase
      .from('capture_log')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(100, 10000)
    if (old && old.length > 0) {
      await supabase.from('capture_log').delete().in('id', old.map((r: { id: string }) => r.id))
    }
  }

  // Duplicate check: if a non-deleted entry with this URL already exists, return
  // early. Skipped entirely for a task — `.eq('url', null)` matches every
  // url-less entry, which would collapse a whole day of tasks onto one row.
  if (url) {
    const { data: existing } = await supabase
      .from('entries')
      .select('id')
      .eq('user_id', userId)
      .eq('url', url)
      .is('deleted_at', null)
      .maybeSingle()

    if (existing) {
      await log(true, 'duplicate — already saved', existing.id)
      return json({
        ok: true,
        duplicate: true,
        entry_id: existing.id,
        message: 'duplicate — already saved',
      })
    }
  }

  const { data: inbox } = await supabase
    .from('topics').select('id').eq('user_id', userId).eq('name', 'Inbox').single()
  if (!inbox) {
    await log(false, 'Inbox topic not found for this user')
    return json(
      { ok: false, error: 'internal', message: 'Inbox topic not found for this user' },
      500,
    )
  }

  // Same rule as createEntry in src/lib/db/entries.js: a note present means the
  // title mirrors the note, and only a title we actually kept is curated. Get
  // this wrong and the first note edit silently overwrites the user's title.
  const note = String(body.note ?? '')
  const mirrored = Boolean(note.trim()) || !title
  const finalTitle = mirrored ? computeTitle(note, url) : title

  const { data: inserted, error } = await supabase.from('entries').insert({
    user_id: userId,
    topic_id: inbox.id,
    url,
    note,
    title: finalTitle,
    title_edited: !mirrored,
    due_at: dueAt,
  }).select('id').single()

  if (error) {
    await log(false, error.message)
    return json(
      { ok: false, error: 'internal', message: error.message },
      500,
    )
  }

  await log(true, 'saved', inserted.id)
  return json({ ok: true, entry_id: inserted.id, message: 'saved' })
}

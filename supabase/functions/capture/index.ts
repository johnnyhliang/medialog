import { createClient } from 'jsr:@supabase/supabase-js@2'

// SSRF guard for the capture function: only allow public http(s) URLs.
// Rejects non-http(s) schemes, localhost, *.local, and private/loopback/
// link-local IP literals (incl. the 169.254.169.254 cloud metadata address).
function isSafeUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false

  const host = u.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false

  const h = host.replace(/^\[|\]$/g, '') // strip IPv6 brackets
  if (h === '::1' || h === '::') return false
  if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return false

  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    if (a === 0 || a === 10 || a === 127) return false
    if (a === 169 && b === 254) return false // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 100 && b >= 64 && b <= 127) return false // CGNAT
  }
  return true
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors })

  const body = await req.json().catch(() => ({}))

  if (body.secret !== Deno.env.get('CAPTURE_SECRET')) {
    return json(
      { ok: false, error: 'unauthorized', message: 'Invalid or missing capture secret' },
      401,
    )
  }

  if (!body.url) {
    return json(
      { ok: false, error: 'bad_request', message: 'url is required' },
      400,
    )
  }

  if (!isSafeUrl(body.url)) {
    return json(
      { ok: false, error: 'bad_request', message: 'URL must be a public http(s) address' },
      400,
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const userId = Deno.env.get('CAPTURE_USER_ID')!

  async function log(ok: boolean, message: string, entryId?: string) {
    await supabase.from('capture_log').insert({
      user_id: userId,
      url: body.url,
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

  // Duplicate check: if a non-deleted entry with this URL already exists, return early.
  const { data: existing } = await supabase
    .from('entries')
    .select('id')
    .eq('user_id', userId)
    .eq('url', body.url)
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

  const { data: inbox } = await supabase
    .from('topics').select('id').eq('user_id', userId).eq('name', 'Inbox').single()
  if (!inbox) {
    await log(false, 'Inbox topic not found for this user')
    return json(
      { ok: false, error: 'internal', message: 'Inbox topic not found for this user' },
      500,
    )
  }

  const { data: inserted, error } = await supabase.from('entries').insert({
    user_id: userId,
    topic_id: inbox.id,
    url: body.url,
    note: body.note ?? '',
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
})

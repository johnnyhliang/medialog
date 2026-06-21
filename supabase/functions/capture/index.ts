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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors })

  const body = await req.json().catch(() => ({}))
  if (body.secret !== Deno.env.get('CAPTURE_SECRET')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  if (body.url && !isSafeUrl(body.url)) {
    return new Response(JSON.stringify({ error: 'unsafe url' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const userId = Deno.env.get('CAPTURE_USER_ID')!

  const { data: inbox } = await supabase
    .from('topics').select('id').eq('user_id', userId).eq('name', 'Inbox').single()
  if (!inbox) {
    return new Response(JSON.stringify({ error: 'no inbox' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const { error } = await supabase.from('entries').insert({
    user_id: userId,
    topic_id: inbox.id,
    url: body.url ?? null,
    note: body.note ?? '',
  })
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})

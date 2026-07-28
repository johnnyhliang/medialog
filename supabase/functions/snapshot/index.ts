// Phase 1 archiver: fetch a hotlinked file (image/PDF/media) and store an owned
// copy in the private `snapshots` bucket, deduped by content hash. Pages
// (kind 'page') are phase 2 and not handled here yet.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } })

const MAX_BYTES = 25 * 1024 * 1024
const ALLOWED = /^(image\/|application\/pdf|audio\/|video\/)/

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  'image/svg+xml': 'svg', 'application/pdf': 'pdf', 'video/mp4': 'mp4', 'audio/mpeg': 'mp3',
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)
  const authed = createClient(
    Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user } } = await authed.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)

  const body = await req.json().catch(() => null)
  const url = body?.url
  const entryId = body?.entryId ?? null
  if (!url || !/^https?:\/\//i.test(url)) return json({ error: 'bad url' }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'medialog-archiver/1.0' } })
    if (!res.ok) return json({ error: `source ${res.status}` }, 502)

    const ct = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (!ALLOWED.test(ct)) return json({ error: `unsupported type ${ct || 'unknown'}` }, 415)

    const buf = await res.arrayBuffer()
    if (buf.byteLength > MAX_BYTES) return json({ error: 'file too large (25 MB cap)' }, 413)

    const hash = await sha256Hex(buf)

    // Already archived? Return the existing row (dedup by content).
    const { data: existing } = await admin
      .from('snapshots').select('*').eq('user_id', user.id).eq('content_hash', hash).maybeSingle()
    if (existing) return json({ snapshot: existing, deduped: true })

    const ext = EXT[ct] || (url.split('.').pop()?.split(/[?#]/)[0] || 'bin').slice(0, 5)
    const path = `${user.id}/${hash}.${ext}`

    const up = await admin.storage.from('snapshots').upload(path, buf, { contentType: ct, upsert: true })
    if (up.error) return json({ error: up.error.message }, 500)

    const { data: row, error } = await admin.from('snapshots').insert({
      user_id: user.id, entry_id: entryId, url, kind: 'file',
      storage_path: path, content_hash: hash, content_type: ct, bytes: buf.byteLength, status: 'done',
    }).select().single()
    if (error) return json({ error: error.message }, 500)

    return json({ snapshot: row })
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 502)
  }
})

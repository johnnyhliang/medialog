import { createClient } from 'jsr:@supabase/supabase-js@2'
import { fetchInboxReels } from './instagram.ts'
import { summarizeReel } from './summarize.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })

  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret) {
    if (req.headers.get('X-Cron-Secret') !== cronSecret) {
      return json({ error: 'forbidden' }, 403)
    }
  }

  const sessionId = Deno.env.get('INSTAGRAM_SESSION_ID')
  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  if (!sessionId) return json({ error: 'INSTAGRAM_SESSION_ID not set' }, 500)

  const ownerId = Deno.env.get('CAPTURE_USER_ID')
  if (!ownerId) return json({ error: 'CAPTURE_USER_ID not set' }, 500)

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  let reels
  try {
    reels = await fetchInboxReels(sessionId)
  } catch (e) {
    console.error('Instagram fetch failed:', e)
    return json({ error: 'instagram_fetch_failed', detail: String(e) }, 502)
  }

  const { data: topicId, error: rpcErr } = await sb.rpc('ensure_reels_topic', { p_user_id: ownerId })
  if (rpcErr || !topicId) return json({ error: 'topic_rpc_failed', detail: String(rpcErr) }, 500)

  let inserted = 0
  for (const reel of reels) {
    const { data: existing } = await sb
      .from('entries')
      .select('id')
      .eq('user_id', ownerId)
      .eq('url', reel.reelUrl)
      .maybeSingle()
    if (existing) continue

    let note = ''
    try {
      note = geminiKey ? await summarizeReel(reel.caption, geminiKey) : reel.caption.slice(0, 300)
    } catch {
      note = reel.caption.slice(0, 300)
    }

    const firstLine = reel.caption.split('\n')[0].trim().slice(0, 80)
    const title = firstLine || 'Instagram Reel'
    const { error: insertErr } = await sb.from('entries').insert({
      user_id: ownerId,
      topic_id: topicId,
      url: reel.reelUrl,
      title,
      note,
    })
    if (!insertErr) inserted++
  }

  return json({ processed: reels.length, inserted })
})

import { createClient } from 'jsr:@supabase/supabase-js@2'

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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const userId = Deno.env.get('CAPTURE_USER_ID')!

  // Find the user's Inbox topic.
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

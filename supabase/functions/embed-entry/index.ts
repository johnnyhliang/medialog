import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: authErr } = await sb.auth.getUser()
  if (authErr || !user) return json({ error: 'unauthorized' }, 401)

  const body = await req.json().catch(() => null)
  if (!body?.text) return json({ error: 'missing text' }, 400)

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return json({ error: 'OPENAI_API_KEY not configured' }, 500)

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: body.text }),
    })
    if (!res.ok) {
      const text = await res.text()
      return json({ error: `openai ${res.status}`, detail: text.slice(0, 500) }, 502)
    }
    const data = await res.json()
    const embedding = data?.data?.[0]?.embedding
    if (!embedding) return json({ error: 'no embedding returned' }, 502)
    return json({ embedding })
  } catch (e) {
    return json({ error: 'request failed', detail: String(e).slice(0, 200) }, 502)
  }
})

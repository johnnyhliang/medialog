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
  const texts: string[] | null = Array.isArray(body?.texts)
    ? body.texts
    : (body?.text ? [body.text] : null)
  if (!texts || texts.length === 0) return json({ error: 'missing text or texts' }, 400)
  // RETRIEVAL_DOCUMENT when storing, RETRIEVAL_QUERY when searching. Asymmetric
  // task types measurably improve retrieval; omitting them embeds docs and
  // queries identically.
  const taskType: string = body?.taskType ?? 'RETRIEVAL_DOCUMENT'

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return json({ error: 'GEMINI_API_KEY not configured' }, 500)

  try {
    const embeddings: number[][] = []
    for (const text of texts) {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            content: { parts: [{ text }] },
            output_dimensionality: 1536,
            taskType,
          }),
        }
      )
      if (!res.ok) {
        const detail = await res.text()
        return json({ error: `gemini ${res.status}`, detail: detail.slice(0, 500) }, 502)
      }
      const data = await res.json()
      const embedding = data?.embedding?.values
      if (!embedding) return json({ error: 'no embedding returned' }, 502)
      embeddings.push(embedding)
    }
    // Single-text callers keep the original shape; batch callers get an array.
    return Array.isArray(body?.texts)
      ? json({ embeddings })
      : json({ embedding: embeddings[0] })
  } catch (e) {
    return json({ error: 'request failed', detail: String(e).slice(0, 200) }, 502)
  }
})

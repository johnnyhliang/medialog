const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors })

  const body = await req.json().catch(() => null)
  if (!body || (!body.messages && !body.prompt)) {
    return json({ error: 'missing prompt or messages' }, 400)
  }

  const baseUrl = Deno.env.get('AI_BASE_URL')
  const apiKey = Deno.env.get('AI_API_KEY')
  const model = body.model || Deno.env.get('AI_MODEL')
  if (!baseUrl || !apiKey || !model) return json({ error: 'AI provider not configured' }, 500)

  const messages = body.messages || [
    ...(body.system ? [{ role: 'system', content: body.system }] : []),
    { role: 'user', content: body.prompt },
  ]
  const payload: Record<string, unknown> = { model, messages, temperature: 0 }
  if (body.json) payload.response_format = { type: 'json_object' }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)
    let res: Response
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) {
      const text = await res.text()
      return json({ error: `provider ${res.status}`, detail: text.slice(0, 500) }, 502)
    }
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content ?? null
    return json({ content })
  } catch (e) {
    return json({ error: 'request failed', detail: String(e).slice(0, 200) }, 502)
  }
})

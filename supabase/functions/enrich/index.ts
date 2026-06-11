import { extractTitle } from '../_shared/extractTitle.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  let url: string | null = new URL(req.url).searchParams.get('url')
  if (!url && req.method === 'POST') {
    try { url = (await req.json())?.url ?? null } catch { url = null }
  }
  if (!url) {
    return new Response(JSON.stringify({ error: 'missing url' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'MediaLogBot/1.0' }, redirect: 'follow' })
    const html = await res.text()
    const result = extractTitle(html, url)
    return new Response(JSON.stringify(result), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (_e) {
    let site = ''
    try { site = new URL(url).hostname } catch { /* ignore */ }
    return new Response(JSON.stringify({ title: null, site }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})

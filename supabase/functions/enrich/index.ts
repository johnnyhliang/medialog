import { extractMetadata } from '../_shared/extractTitle.ts'
import { isSafeUrl } from '../_shared/isSafeUrl.ts'

const MAX_BYTES = 512 * 1024 // only need the <head>; cap the read at 512KB
const TIMEOUT_MS = 5000

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
  if (!isSafeUrl(url)) {
    return new Response(JSON.stringify({ error: 'url not allowed' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let html: string
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'MediaLogBot/1.0' },
        redirect: 'follow',
        signal: controller.signal,
      })
      const buf = new Uint8Array(await res.arrayBuffer())
      html = new TextDecoder().decode(buf.slice(0, MAX_BYTES))
    } finally {
      clearTimeout(timer)
    }
    const result = extractMetadata(html, url)
    return new Response(JSON.stringify(result), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (_e) {
    let site = ''
    try { site = new URL(url).hostname } catch { /* ignore */ }
    return new Response(JSON.stringify({ title: null, site, image: null, description: null }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})

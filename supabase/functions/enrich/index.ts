import { createClient } from 'jsr:@supabase/supabase-js@2'
import { extractMetadata, extractReadableText } from '../_shared/extractTitle.ts'
import { isSafeUrl } from '../_shared/isSafeUrl.ts'

const MAX_BYTES = 512 * 1024
const TIMEOUT_MS = 6000

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const OEMBED_PROVIDERS: Array<{ test: RegExp; endpoint: string }> = [
  { test: /youtube\.com\/watch|youtu\.be\//, endpoint: 'https://www.youtube.com/oembed' },
  { test: /vimeo\.com\//, endpoint: 'https://vimeo.com/api/oembed.json' },
]

async function tryOembed(url: string, controller: AbortController): Promise<{ title: string | null; image: string | null; description: string | null } | null> {
  const provider = OEMBED_PROVIDERS.find((p) => p.test.test(url))
  if (!provider) return null
  try {
    const endpoint = `${provider.endpoint}?url=${encodeURIComponent(url)}&format=json`
    const res = await fetch(endpoint, { signal: controller.signal })
    if (!res.ok) return null
    const json = await res.json()
    return {
      title: json.title ?? null,
      image: json.thumbnail_url ?? null,
      description: json.author_name ? `by ${json.author_name}` : null,
    }
  } catch { return null }
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function unauthorized() {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // Verify caller is a logged-in Supabase user
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return unauthorized()
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: authErr } = await sb.auth.getUser()
  if (authErr || !user) return unauthorized()

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

  let site = ''
  try { site = new URL(url).hostname } catch { /* ignore */ }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let result: { title: string | null; site: string; image: string | null; description: string | null }
    try {
      const oembed = await tryOembed(url, controller)
      if (oembed) {
        result = { ...oembed, site, full_text: null }
      } else {
        const res = await fetch(url, {
          headers: {
            'User-Agent': BROWSER_UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
          redirect: 'follow',
          signal: controller.signal,
        })
        const buf = new Uint8Array(await res.arrayBuffer())
        const html = new TextDecoder().decode(buf.slice(0, MAX_BYTES))
        const meta = extractMetadata(html, url)
        const fullText = extractReadableText(html)
        result = { ...meta, full_text: fullText || null }
      }
    } finally {
      clearTimeout(timer)
    }
    return new Response(JSON.stringify(result), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (_e) {
    return new Response(JSON.stringify({ title: null, site, image: null, description: null, full_text: null }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})

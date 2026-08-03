// Public, unauthenticated renderer for shared items. Given ?slug=, looks it up
// in shared_items (service role), fetches the referenced entry, re-signs any
// attachment images with a long TTL, renders the markdown to a self-contained
// HTML page with OpenGraph tags, and returns it. The anon key never touches the
// real tables — this function is the only public door. Deploy --no-verify-jwt.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { marked } from 'https://esm.sh/marked@12'

const YEARS_10 = 60 * 60 * 24 * 365 * 10

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Strip markdown/html to plain text for the meta description.
function toText(md: string): string {
  return String(md ?? '').replace(/[#*_`>\-\[\]!()]/g, ' ').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim()
}

// Basic sanitize: shared content is the owner's own, but drop script/handlers so
// a viewer of a shared page can't be attacked by pasted markup.
function sanitize(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
}

function notFound(): Response {
  return new Response('<!doctype html><meta charset=utf-8><title>Not found</title><body style="font-family:system-ui;padding:40px"><h1>Not shared</h1><p>This link is private or no longer exists.</p>', {
    status: 404, headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const slug = url.searchParams.get('slug')
  if (!slug) return notFound()

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: share } = await admin
    .from('shared_items').select('kind, ref_id, active').eq('slug', slug).maybeSingle()
  if (!share || share.kind !== 'entry' || share.active === false) return notFound()

  const { data: entry } = await admin
    .from('entries').select('title, note, url, created_at').eq('id', share.ref_id).is('deleted_at', null).maybeSingle()
  if (!entry) return notFound()

  // Re-sign attachment images with a long TTL so they don't break on the public page.
  let note = String(entry.note ?? '')
  const paths = new Set<string>()
  for (const m of note.matchAll(/\/storage\/v1\/object\/sign\/attachments\/([^?)\s"']+)(\?token=[^)\s"']*)?/g)) {
    paths.add(decodeURIComponent(m[1]))
  }
  for (const path of paths) {
    const { data } = await admin.storage.from('attachments').createSignedUrl(path, YEARS_10)
    if (data?.signedUrl) {
      note = note.replaceAll(new RegExp(`https?://[^)\\s"']*/storage/v1/object/sign/attachments/${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\?token=[^)\\s"']*)?`, 'g'), data.signedUrl)
    }
  }

  const title = entry.title || 'Shared note'
  const bodyHtml = sanitize(marked.parse(note) as string)
  const desc = toText(note).slice(0, 180)
  const dateStr = entry.created_at ? new Date(entry.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · MediaLog</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:site_name" content="MediaLog">
<meta name="twitter:card" content="summary">
<meta name="robots" content="noindex">
<style>
  :root { color-scheme: light dark; }
  body { max-width: 720px; margin: 0 auto; padding: 48px 20px 96px; font: 17px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; color: #1a1a1a; background: #fbfbfa; }
  @media (prefers-color-scheme: dark) { body { color: #e6e6e6; background: #16161a; } a { color: #8ab4f8; } }
  h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 4px; }
  .meta { color: #888; font-size: 0.85rem; margin-bottom: 28px; }
  .content img { max-width: 100%; height: auto; border-radius: 8px; }
  .content pre { overflow-x: auto; background: rgba(127,127,127,.12); padding: 12px; border-radius: 8px; }
  .content code { background: rgba(127,127,127,.14); padding: 2px 5px; border-radius: 4px; }
  .content a { word-break: break-word; }
  hr { border: none; border-top: 1px solid rgba(127,127,127,.25); margin: 40px 0 16px; }
  footer { color: #999; font-size: 0.8rem; }
  footer a { color: inherit; }
</style>
</head><body>
<article>
  <h1>${esc(title)}</h1>
  <div class="meta">${dateStr ? esc(dateStr) : ''}${entry.url ? ` · <a href="${esc(entry.url)}" rel="noopener nofollow">source ↗</a>` : ''}</div>
  <div class="content">${bodyHtml}</div>
</article>
<hr>
<footer>Shared from <a href="https://notes.johnnyliang.me" rel="noopener">MediaLog</a></footer>
</body></html>`

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
  })
})

// Find externally-hotlinked media in entry notes — images/PDFs referenced by
// URL rather than uploaded to Storage. The Files page lists Storage uploads;
// this surfaces the *other* files your notes depend on (and that can rot).

const MEDIA_EXT = /\.(png|jpe?g|gif|webp|svg|pdf|mp4|webm|mp3|wav)(\?|#|$)/i

// Uploaded attachments live in Supabase Storage; exclude them — they're already
// shown under Uploads and aren't "hotlinks" that can independently rot.
function isStorageUrl(url) {
  return /\/storage\/v1\/object\//.test(url) || /\/attachments\//.test(url)
}

export function fileTypeFromUrl(url) {
  if (/\.pdf(\?|#|$)/i.test(url)) return 'pdf'
  if (/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(url)) return 'image'
  if (/\.(mp4|webm)(\?|#|$)/i.test(url)) return 'video'
  if (/\.(mp3|wav)(\?|#|$)/i.test(url)) return 'audio'
  return 'file'
}

export function fileNameFromUrl(url) {
  try {
    const path = new URL(url).pathname
    const last = path.split('/').filter(Boolean).pop() || url
    return decodeURIComponent(last)
  } catch {
    return url
  }
}

// All hotlinked media URLs in one note. Markdown images always count; markdown
// links and bare URLs count only when they point at a media file.
export function extractHotlinks(note) {
  const text = String(note ?? '')
  const out = new Map() // url -> type

  const add = (url, type) => {
    if (!/^https?:\/\//i.test(url) || isStorageUrl(url)) return
    if (!out.has(url)) out.set(url, type)
  }

  // markdown images: ![alt](url)
  for (const m of text.matchAll(/!\[[^\]]*\]\(\s*([^)\s]+)/g)) add(m[1], 'image')
  // markdown links: [text](url) — media only
  for (const m of text.matchAll(/(^|[^!])\[[^\]]*\]\(\s*([^)\s]+)/g)) {
    if (MEDIA_EXT.test(m[2])) add(m[2], fileTypeFromUrl(m[2]))
  }
  // bare urls
  for (const m of text.matchAll(/https?:\/\/[^\s)<>"']+/g)) {
    if (MEDIA_EXT.test(m[0])) add(m[0], fileTypeFromUrl(m[0]))
  }

  return [...out.entries()].map(([url, type]) => ({ url, type }))
}

// Roll up hotlinks across many entries into one row per unique URL, tracking
// which entries reference it (for jump-to-entry).
export function collectHotlinks(entries) {
  const byUrl = new Map() // url -> { url, type, name, refs: [{id,title,topic_id}] }
  for (const e of entries) {
    for (const { url, type } of extractHotlinks(e.note)) {
      let row = byUrl.get(url)
      if (!row) {
        row = { url, type, name: fileNameFromUrl(url), refs: [] }
        byUrl.set(url, row)
      }
      if (!row.refs.some((r) => r.id === e.id)) {
        row.refs.push({ id: e.id, title: e.title, topic_id: e.topic_id })
      }
    }
  }
  return [...byUrl.values()]
}

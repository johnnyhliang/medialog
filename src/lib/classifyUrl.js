const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'])
const TEXT_EXTS = new Set(['.txt', '.md', '.csv'])

export function classifyUrl(url) {
  if (!url || typeof url !== 'string') return null
  let pathname
  try {
    pathname = new URL(url).pathname.toLowerCase()
  } catch {
    return null
  }
  const hostname = new URL(url).hostname.toLowerCase()

  if (hostname === 'drive.google.com' || hostname === 'docs.google.com') return 'drive'

  const dot = pathname.lastIndexOf('.')
  if (dot === -1) return null
  const ext = pathname.slice(dot)

  if (ext === '.pdf') return 'pdf'
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (TEXT_EXTS.has(ext)) return 'text'
  return null
}

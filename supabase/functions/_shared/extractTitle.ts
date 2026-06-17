export type LinkMetadata = {
  title: string | null
  site: string
  image: string | null
  description: string | null
}

// Pure HTML metadata extraction. No Deno/Node APIs so it is unit-testable with Vitest.
export function extractMetadata(html: string, url: string): LinkMetadata {
  let site = ''
  try {
    site = new URL(url).hostname
  } catch {
    site = ''
  }

  const ogTitle = metaContent(html, 'og:title')
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const rawTitle = ogTitle || (titleTag && titleTag[1]) || null

  const ogImage = metaContent(html, 'og:image')
  const ogDesc = metaContent(html, 'og:description')
  const metaDesc = metaContent(html, 'description', 'name')

  return {
    title: rawTitle ? clean(rawTitle) : null,
    site,
    image: ogImage ? resolveUrl(ogImage, url) : null,
    description: (ogDesc || metaDesc) ? clean(ogDesc || metaDesc || '') : null,
  }
}

/** @deprecated use extractMetadata */
export function extractTitle(html: string, url: string): { title: string | null; site: string } {
  const { title, site } = extractMetadata(html, url)
  return { title, site }
}

function metaContent(html: string, key: string, attr: 'property' | 'name' = 'property'): string | null {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${key}["']`,
    'i',
  )
  const m = html.match(re)
  return m ? (m[1] || m[2] || null) : null
}

function resolveUrl(value: string, base: string): string | null {
  try {
    return new URL(value, base).href
  } catch {
    return null
  }
}

function clean(s: string): string {
  return decodeEntities(s).replace(/\s+/g, ' ').trim()
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

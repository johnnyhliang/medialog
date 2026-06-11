// Pure HTML title extraction. No Deno/Node APIs so it is unit-testable with Vitest.
export function extractTitle(html: string, url: string): { title: string | null; site: string } {
  let site = ''
  try {
    site = new URL(url).hostname
  } catch {
    site = ''
  }

  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i)
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const raw = (og && og[1]) || (titleTag && titleTag[1]) || null

  return { title: raw ? clean(raw) : null, site }
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

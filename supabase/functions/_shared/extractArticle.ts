// Article body extraction for `full_text` preservation.
//
// This module holds ALL the extraction logic and deliberately imports nothing:
// the DOM + Readability implementations are injected. That keeps it runnable in
// both places we need it — Deno (the `enrich` edge function, via `npm:`
// specifiers) and Node (Vitest, plus the backfill script) — without the module
// itself committing to a resolver that only one of them has.

export const MAX_FULL_TEXT = 60_000

// Below this, a "successful" parse is almost always page chrome, a cookie wall,
// or a paywall stub rather than an article — worth trying the other extractor.
export const MIN_ARTICLE_CHARS = 500

export type Extractor = 'readability' | 'heuristic' | 'none'

export type ArticleExtraction = {
  full_text: string | null
  byline: string | null
  excerpt: string | null
  extractor: Extractor
}

export type ReadableParse = (
  html: string,
  url: string,
) => { textContent?: string | null; byline?: string | null; excerpt?: string | null } | null

type ReadabilityDeps = {
  // `new Readability(document).parse()` — @mozilla/readability
  Readability: new (doc: unknown, opts?: unknown) => { parse(): unknown }
  // `parseHTML(html).document` — linkedom
  parseHTML: (html: string) => { document: unknown }
}

/**
 * Adapt @mozilla/readability + linkedom into a `ReadableParse`. Callers supply
 * the two implementations so this file stays import-free; both the edge function
 * and the tests build the parser from the same code path, so what tests cover is
 * what production runs.
 */
export function makeReadabilityParser(deps: ReadabilityDeps): ReadableParse {
  return (html, url) => {
    const { document } = deps.parseHTML(html)
    // documentURI lets Readability resolve relative links and score by path;
    // linkedom does not set it from parseHTML alone.
    try {
      Object.defineProperty(document, 'documentURI', { value: url, configurable: true })
    } catch { /* non-fatal: extraction works without it */ }
    // Readability mutates the document it is given, so this parser is one-shot
    // per parseHTML call — never reuse a document across calls.
    return (deps.Readability
      ? new deps.Readability(document, { charThreshold: MIN_ARTICLE_CHARS }).parse()
      : null) as ReturnType<ReadableParse>
  }
}

/**
 * Extract an article body from raw HTML.
 *
 * Readability first, the regex heuristic as a fallback, and a graceful "nothing
 * preserved" result as the floor. Never throws: extraction runs inside capture,
 * where a parser blowing up must not fail the save.
 */
export function extractArticle(
  html: string,
  url: string,
  opts: { parse?: ReadableParse | null } = {},
): ArticleExtraction {
  const empty: ArticleExtraction = { full_text: null, byline: null, excerpt: null, extractor: 'none' }
  if (typeof html !== 'string' || !html.trim()) return empty

  let readable: { text: string; byline: string | null; excerpt: string | null } | null = null
  if (opts.parse) {
    try {
      const parsed = opts.parse(html, url)
      const text = normalizeText(parsed?.textContent ?? '')
      if (text) {
        readable = {
          text,
          byline: cleanLine(parsed?.byline) ,
          excerpt: cleanLine(parsed?.excerpt),
        }
      }
    } catch {
      // Malformed markup, a linkedom edge case, or a missing dependency — fall
      // through to the heuristic rather than losing the article entirely.
      readable = null
    }
  }

  let heuristic = ''
  try {
    heuristic = extractReadableText(html)
  } catch {
    heuristic = ''
  }

  // Readability output is far cleaner (no nav/footer/related-links noise), so
  // prefer it whenever it looks like a real article — even when the heuristic
  // returned more characters, because those extra characters are usually chrome.
  if (readable && readable.text.length >= MIN_ARTICLE_CHARS) {
    return {
      full_text: readable.text,
      byline: readable.byline,
      excerpt: deriveExcerpt(readable.excerpt) ?? deriveExcerpt(readable.text),
      extractor: 'readability',
    }
  }
  if (heuristic.length >= MIN_ARTICLE_CHARS) {
    return { full_text: heuristic, byline: readable?.byline ?? null, excerpt: deriveExcerpt(heuristic), extractor: 'heuristic' }
  }

  // Both came up short (JS-rendered page, paywall, redirect stub). Keep the
  // longer scrap if there is one so a short-but-real post is not thrown away.
  const readableText = readable?.text ?? ''
  const best = readableText.length >= heuristic.length ? readableText : heuristic
  if (!best) return empty
  return {
    full_text: best,
    byline: readable?.byline ?? null,
    excerpt: deriveExcerpt(readable?.excerpt) ?? deriveExcerpt(best),
    extractor: best === readableText ? 'readability' : 'heuristic',
  }
}

const EXCERPT_CHARS = 280

// Readability's own excerpt is whatever og:description or the lead paragraph
// happens to be — sometimes the entire first section. Cap everything.
function deriveExcerpt(text: string | null | undefined): string | null {
  if (!text) return null
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!flat) return null
  return flat.length <= EXCERPT_CHARS ? flat : `${flat.slice(0, EXCERPT_CHARS).replace(/\s+\S*$/, '')}…`
}

function cleanLine(s: unknown): string | null {
  if (typeof s !== 'string') return null
  const out = decodeEntities(s).replace(/\s+/g, ' ').trim()
  return out || null
}

export function normalizeText(text: unknown): string {
  if (typeof text !== 'string') return ''
  return decodeEntities(text)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_FULL_TEXT)
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&(nbsp|#160);/g, ' ')
    .replace(/&(mdash|#8212);/g, '—')
    .replace(/&(rsquo|#8217);/g, '’')
    .replace(/&#\d+;/g, '')
}

/**
 * Regex fallback extractor. Cheap, dependency-free, and tolerant of broken
 * markup that a real parser rejects — which is exactly why it stays as the
 * second rung rather than being deleted.
 */
export function extractReadableText(html: string): string {
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(nav|header|footer|aside|form)[^>]*>[\s\S]*?<\/\1>/gi, '')

  const articleM = h.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  const mainM = h.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  const bodyM = h.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const content = articleM?.[1] ?? mainM?.[1] ?? bodyM?.[1] ?? h

  const withBreaks = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|blockquote|h[1-6])>/gi, '\n\n')

  return normalizeText(withBreaks.replace(/<[^>]+>/g, ''))
}

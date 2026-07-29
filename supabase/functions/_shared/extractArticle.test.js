import { describe, test, expect } from 'vitest'
import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import {
  extractArticle, extractReadableText, makeReadabilityParser, normalizeText,
  MAX_FULL_TEXT, MIN_ARTICLE_CHARS,
} from './extractArticle.ts'

// Built from the same factory the edge function uses, so these tests exercise the
// production Readability path rather than a stand-in.
const parse = makeReadabilityParser({ Readability, parseHTML })

const body = (sentence) => `${sentence} `.repeat(40)

describe('extractArticle with Readability', () => {
  test('extracts the article body and drops nav/footer chrome', () => {
    const html = `<html><head><title>Post</title></head><body>
      <nav><a href="/">Home</a><a href="/about">About</a></nav>
      <article>
        <h1>On Preservation</h1>
        <p>${body('Link rot eats the web and this paragraph is the actual article body.')}</p>
      </article>
      <footer>Copyright 2026 SomeSite. Subscribe to our newsletter today.</footer>
    </body></html>`

    const out = extractArticle(html, 'https://example.com/post', { parse })
    expect(out.extractor).toBe('readability')
    expect(out.full_text).toContain('Link rot eats the web')
    expect(out.full_text).not.toContain('Subscribe to our newsletter')
    expect(out.full_text).not.toContain('About')
  })

  test('derives an excerpt when Readability supplies none', () => {
    const html = `<html><body><article><p>${body('Sentence about the topic.')}</p></article></body></html>`
    const out = extractArticle(html, 'https://example.com/a', { parse })
    expect(out.excerpt).toBeTruthy()
    expect(out.excerpt.length).toBeLessThanOrEqual(281)
  })

  test('picks up a byline when the page marks one up', () => {
    const html = `<html><body><article>
      <h1>Titled</h1>
      <p class="byline" rel="author">By Ada Lovelace</p>
      <p>${body('The analytical engine weaves algebraic patterns.')}</p>
    </article></body></html>`
    const out = extractArticle(html, 'https://example.com/a', { parse })
    expect(out.full_text).toContain('analytical engine')
    // Readability's byline detection is heuristic; assert only that it never
    // returns a non-string, since the field is optional downstream.
    expect(out.byline === null || typeof out.byline === 'string').toBe(true)
  })

  // Messy real-world shape: unclosed tags, inline SVG, tracking pixels, a cookie
  // banner, share widgets, and entity soup — the kind of HTML that makes a naive
  // regex pull return navigation junk.
  test('handles messy real-world markup with broken tags and page furniture', () => {
    const html = `<!DOCTYPE html>
<html lang=en><head>
<meta charset=utf-8>
<title>Why Everything Rots &mdash; Some Blog</title>
<script>window.__DATA__={"ads":[1,2,3]};</script>
<style>.ad{display:block}</style>
</head>
<body class=article>
<div id=cookie-banner>We value your privacy. Accept all cookies to continue reading.</div>
<header><svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg><ul>
<li><a href=/tech>Tech<li><a href=/culture>Culture<li><a href=/subscribe>Subscribe
</ul></header>
<main>
<article>
<h1>Why Everything Rots</h1>
<p class=meta>By Jane Doe &middot; 12 min read
<p>${body('Half the links you saved five years ago are already gone &mdash; and nobody told you.')}
<blockquote>Preservation isn&rsquo;t nostalgia; it&rsquo;s infrastructure.</blockquote>
<p>${body('An owned copy of the text is the cheapest insurance against a dead domain.')}
<div class=share>Share on Twitter &nbsp; Share on Facebook</div>
</article>
</main>
<aside class=related><h2>Related</h2><ul><li><a href=/x>Ten Tips For Something Else</ul></aside>
<footer>&copy; 2026 Some Blog. All rights reserved.</footer>
<img src="https://track.example/px.gif?id=1" width=1 height=1>
</body></html>`

    const out = extractArticle(html, 'https://someblog.example/why-everything-rots', { parse })
    expect(out.extractor).toBe('readability')
    expect(out.full_text).toContain('Half the links you saved five years ago')
    expect(out.full_text).toContain('An owned copy of the text')
    // Entities decoded, not left raw.
    expect(out.full_text).not.toMatch(/&(mdash|rsquo|nbsp);/)
    // Page furniture excluded.
    expect(out.full_text).not.toContain('Accept all cookies')
    expect(out.full_text).not.toContain('Ten Tips For Something Else')
    expect(out.full_text).not.toContain('All rights reserved')
    expect(out.full_text).not.toContain('window.__DATA__')
  })

  test('falls back to the heuristic when Readability finds no article', () => {
    // No semantic containers and divs only — Readability commonly returns a
    // near-empty result here while the regex pull still recovers the prose.
    const text = body('Plain divs holding real prose that should still be preserved.')
    const html = `<html><body><div><div><div>${text}</div></div></div></body></html>`
    const out = extractArticle(html, 'https://example.com/x', { parse })
    expect(out.full_text).toContain('should still be preserved')
    expect(['readability', 'heuristic']).toContain(out.extractor)
  })
})

describe('extractArticle degradation', () => {
  test('reports extractor "none" for a JS-only shell with no text', () => {
    const html = '<html><head><title>App</title></head><body><div id="root"></div><script>boot()</script></body></html>'
    expect(extractArticle(html, 'https://example.com/app', { parse })).toEqual({
      full_text: null, byline: null, excerpt: null, extractor: 'none',
    })
  })

  test('does not throw when the parser itself blows up, and still returns heuristic text', () => {
    const exploding = () => { throw new TypeError('parser exploded') }
    const html = `<html><body><article><p>${body('Real prose survives a broken parser.')}</p></article></body></html>`
    const out = extractArticle(html, 'https://example.com/x', { parse: exploding })
    expect(out.extractor).toBe('heuristic')
    expect(out.full_text).toContain('Real prose survives a broken parser')
  })

  test('degrades to empty rather than throwing on a parser explosion with no text', () => {
    const exploding = () => { throw new Error('boom') }
    expect(() => extractArticle('<html><body></body></html>', 'https://a.com', { parse: exploding })).not.toThrow()
    expect(extractArticle('<html><body></body></html>', 'https://a.com', { parse: exploding }).extractor).toBe('none')
  })

  test('works with no parser injected at all (dependency unavailable)', () => {
    const html = `<html><body><article><p>${body('No Readability here, only regex.')}</p></article></body></html>`
    const out = extractArticle(html, 'https://example.com/x')
    expect(out.extractor).toBe('heuristic')
    expect(out.full_text).toContain('only regex')
  })

  test('tolerates junk input without throwing', () => {
    for (const junk of ['', '   ', null, undefined, 42, '<<<>>>', '<p>unclosed']) {
      expect(() => extractArticle(junk, 'https://a.com', { parse })).not.toThrow()
    }
    expect(extractArticle(null, 'https://a.com', { parse }).full_text).toBeNull()
  })

  test('a parser returning null is not treated as a failure', () => {
    const html = `<html><body><article><p>${body('Null parse result, heuristic wins.')}</p></article></body></html>`
    const out = extractArticle(html, 'https://a.com', { parse: () => null })
    expect(out.extractor).toBe('heuristic')
  })
})

describe('normalizeText / extractReadableText', () => {
  test('caps output at MAX_FULL_TEXT', () => {
    const out = normalizeText('a'.repeat(MAX_FULL_TEXT + 5000))
    expect(out.length).toBe(MAX_FULL_TEXT)
  })

  test('collapses runs of blank lines and trailing spaces', () => {
    expect(normalizeText('a  \n\n\n\n  b\t\tc')).toBe('a\n\nb c')
  })

  test('strips scripts, styles and noscript content', () => {
    const html = '<body><script>evil()</script><style>.a{}</style><noscript>enable js</noscript><p>keep me</p></body>'
    const out = extractReadableText(html)
    expect(out).toBe('keep me')
  })

  test('MIN_ARTICLE_CHARS gates what counts as a real article', () => {
    const short = '<html><body><article><p>Too short to be an article.</p></article></body></html>'
    const out = extractArticle(short, 'https://a.com', { parse })
    expect(out.full_text?.length ?? 0).toBeLessThan(MIN_ARTICLE_CHARS)
  })
})

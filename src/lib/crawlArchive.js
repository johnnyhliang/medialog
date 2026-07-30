import { supabase } from './supabaseClient.js'

// Crawl a site for article URLs via sitemap or RSS/Atom.
//
// The parsing lives in the `crawl-archive` edge function. It used to run here in
// the browser via the allorigins.win CORS proxy — a free third-party service that
// could rate-limit or disappear, silently breaking crawling with no signal. Edge
// functions have no CORS constraint, so the proxy was pure liability.
//
// Shape is unchanged: { items: [{ url, title }], via: 'sitemap' | 'feed' }.
export async function crawlArchive(inputUrl) {
  if (!inputUrl?.trim()) throw new Error('Invalid URL')

  const { data, error } = await supabase.functions.invoke('crawl-archive', {
    body: { url: inputUrl.trim() },
  })

  // Non-2xx arrives as an error with the JSON body attached; surface the
  // function's own message ("No sitemap or feed found…") rather than a generic
  // "Edge Function returned a non-2xx status code".
  if (error) {
    const detail = await error.context?.json?.().catch(() => null)
    throw new Error(detail?.error || error.message || 'Crawl failed')
  }
  if (data?.error) throw new Error(data.error)
  if (!data?.items?.length) throw new Error('No sitemap or feed found at this domain.')

  return { items: data.items, via: data.via }
}

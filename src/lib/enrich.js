// Calls the `enrich` edge function. Never throws — enrichment is best-effort,
// a failed title must not block saving an entry.
export async function fetchTitle(supabase, url) {
  const meta = await fetchLinkPreview(supabase, url)
  return meta?.title ?? null
}

const previewCache = new Map()

/** Fetch og:title, image, description for link embed cards. Cached per session. */
export async function fetchLinkPreview(supabase, url) {
  if (!url) return null
  if (previewCache.has(url)) return previewCache.get(url)

  try {
    const { data, error } = await supabase.functions.invoke('enrich', { body: { url } })
    if (error || !data) return null
    previewCache.set(url, data)
    return data
  } catch {
    return null
  }
}

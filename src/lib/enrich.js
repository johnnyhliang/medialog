// Calls the `enrich` edge function. Never throws — enrichment is best-effort,
// a failed title must not block saving an entry.
export async function fetchTitle(supabase, url) {
  try {
    const { data, error } = await supabase.functions.invoke('enrich', { body: { url } })
    if (error || !data) return null
    return data.title ?? null
  } catch {
    return null
  }
}

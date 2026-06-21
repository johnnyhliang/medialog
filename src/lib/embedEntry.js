export async function embedEntryAsync(supabase, entry) {
  const text = [entry.title, entry.note, entry.url].filter(Boolean).join(' ').slice(0, 2000)
  if (!text.trim()) return
  try {
    const { data, error } = await supabase.functions.invoke('embed-entry', { body: { text } })
    if (error || !data?.embedding) return
    await supabase.from('entry_embeddings').upsert({
      entry_id: entry.id,
      embedding: data.embedding,
      embedded_at: new Date().toISOString(),
    })
  } catch {}
}

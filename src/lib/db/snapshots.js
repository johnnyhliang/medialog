// Client wrapper for the file archiver (snapshot edge function + snapshots table).

export async function listSnapshots(supabase) {
  const { data, error } = await supabase
    .from('snapshots')
    .select('id, url, storage_path, content_type, bytes, created_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

// Archive a hotlinked file by URL. Returns the snapshot row (existing if already
// archived). Best-effort: throws with a readable message on failure.
export async function archiveFile(supabase, { url, entryId = null }) {
  const { data, error } = await supabase.functions.invoke('snapshot', { body: { url, entryId } })
  if (error) throw new Error(error.message || 'archive failed')
  if (data?.error) throw new Error(data.error)
  return data.snapshot
}

// A short-lived signed URL to view an owned snapshot copy.
export async function snapshotUrl(supabase, storagePath) {
  const { data } = await supabase.storage.from('snapshots').createSignedUrl(storagePath, 60 * 60)
  return data?.signedUrl ?? null
}

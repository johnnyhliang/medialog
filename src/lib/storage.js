const BUCKET = 'attachments'
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf',
])

function sanitizeName(name) {
  return String(name ?? 'file')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 120) || 'file'
}

export function isAllowedAttachment(file) {
  return file && ALLOWED.has(file.type) && file.size <= MAX_BYTES
}

/** Upload a note attachment; returns the public URL. */
export async function uploadAttachment(supabase, file) {
  if (!isAllowedAttachment(file)) {
    throw new Error('File must be an image or PDF under 10 MB')
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const path = `${user.id}/${crypto.randomUUID()}-${sanitizeName(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/** Insert markdown for an uploaded file at the cursor position. */
export function markdownForAttachment(url, file) {
  if (file.type === 'application/pdf') {
    return `[${file.name}](${url})`
  }
  return `![${file.name}](${url})`
}

import { createThumbnail } from './thumbnail.js'

const BUCKET = 'attachments'
const MAX_BYTES = 10 * 1024 * 1024
export const CAP_BYTES = 500 * 1024 * 1024
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

export async function getUserUsageBytes(supabase, userId) {
  const { data } = await supabase.storage.from(BUCKET).list(userId)
  return (data || []).reduce((sum, f) => sum + (f.metadata?.size || 0), 0)
}

/**
 * Upload a note attachment.
 * Returns { url, thumbUrl } — thumbUrl is set for raster images, null for SVGs/PDFs.
 */
export async function uploadAttachment(supabase, file) {
  if (!isAllowedAttachment(file)) {
    throw new Error('File must be an image or PDF under 10 MB')
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const used = await getUserUsageBytes(supabase, user.id)
  if (used + file.size > CAP_BYTES) {
    const usedMB = Math.round(used / 1024 / 1024)
    throw new Error(`Storage limit reached. You've used ${usedMB} MB of 500 MB. Delete files to free space.`)
  }

  const uuid = crypto.randomUUID()
  const safeName = sanitizeName(file.name)
  const path = `${user.id}/${uuid}-${safeName}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (error) throw error

  const { data: origData, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7) // 7-day expiry
  if (signErr) throw signErr
  const url = origData.signedUrl

  if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
    try {
      const thumbBlob = await createThumbnail(file)
      const thumbPath = `${user.id}/${uuid}-${safeName}.thumb.webp`
      const { error: thumbErr } = await supabase.storage.from(BUCKET).upload(thumbPath, thumbBlob, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/webp',
      })
      if (!thumbErr) {
        const { data: thumbData } = await supabase.storage
          .from(BUCKET).createSignedUrl(thumbPath, 60 * 60 * 24 * 7)
        return { url, thumbUrl: thumbData?.signedUrl ?? null }
      }
    } catch {
      // thumbnail generation failed; fall through to no-thumb return
    }
  }

  return { url, thumbUrl: null }
}

/** Insert markdown for an uploaded file at the cursor position. */
export function markdownForAttachment(url, thumbUrl, file) {
  if (file.type === 'application/pdf') {
    return `[${file.name}](${url})`
  }
  if (thumbUrl) {
    return `[![${file.name}](${thumbUrl})](${url})`
  }
  return `![${file.name}](${url})`
}

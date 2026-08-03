import { buildFiles, parseFiles } from '../githubSync.js'
import { collectSnapshot, applySnapshot } from './githubBackup.js'
import { downloadBlob } from '../buildZip.js'

// Local backup, independent of GitHub: same data/*.json + notes/*.md layout
// buildFiles() already produces for a repo commit, written to a zip on disk
// instead. One canonical full-fidelity format, two delivery mechanisms.
export async function downloadBackupZip(supabase, onProgress) {
  const snapshot = await collectSnapshot(supabase, onProgress)
  const files = buildFiles(snapshot)

  onProgress?.(`zipping ${files.length} files`)
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const { path, content } of files) zip.file(path, content)
  const blob = await zip.generateAsync({ type: 'blob' })

  const stamp = snapshot.exported_at.slice(0, 10)
  downloadBlob(blob, `medialog-backup-${stamp}.zip`)
  return { counts: files.length }
}

/** Unzip a File/Blob into the [{ path, content }] shape parseFiles() expects. */
async function readZipFiles(fileOrBlob) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(fileOrBlob)
  const files = []
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue
    files.push({ path, content: await entry.async('string') })
  }
  return files
}

/** Read an uploaded zip into a snapshot, without writing anything yet. */
export async function readBackupZip(fileOrBlob) {
  const files = await readZipFiles(fileOrBlob)
  return parseFiles(files)
}

/** Restore a snapshot read from a zip. Shared items land inactive — see applySnapshot. */
export async function applyBackupZip(supabase, snapshot, onProgress) {
  return applySnapshot(supabase, snapshot, onProgress, { source: 'zip' })
}

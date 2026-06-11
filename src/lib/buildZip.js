import JSZip from 'jszip'

// files: { name: contents } -> Blob of a zip
export async function buildZip(files) {
  const zip = new JSZip()
  for (const [name, contents] of Object.entries(files)) zip.file(name, contents)
  return zip.generateAsync({ type: 'blob' })
}

// Trigger a browser download of a Blob.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// JSZip is imported *inside* buildZip rather than at module scope.
//
// downloadBlob is used on the common export path, so this module is reachable
// from the main bundle. A top-level `import JSZip` therefore dragged ~100 KB of
// zip machinery into the bundle every user downloads, to serve a button most
// sessions never press. Deferring the import splits JSZip into its own chunk
// fetched only when a zip is actually built.

// files: { name: contents } -> Blob of a zip
export async function buildZip(files) {
  const { default: JSZip } = await import('jszip')
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

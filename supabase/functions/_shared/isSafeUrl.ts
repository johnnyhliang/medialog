// SSRF guard for the enrich function: only allow public http(s) URLs.
// Rejects non-http(s) schemes, localhost, *.local, and private/loopback/
// link-local IP literals (incl. the 169.254.169.254 cloud metadata address).
export function isSafeUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false

  const host = u.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false

  const h = host.replace(/^\[|\]$/g, '') // strip IPv6 brackets
  if (h === '::1' || h === '::') return false
  if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return false

  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    if (a === 0 || a === 10 || a === 127) return false
    if (a === 169 && b === 254) return false // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 100 && b >= 64 && b <= 127) return false // CGNAT
  }
  return true
}

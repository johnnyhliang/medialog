function parseWaybackTimestamp(ts) {
  // ts format: YYYYMMDDHHmmss
  const y = ts.slice(0, 4), mo = ts.slice(4, 6), d = ts.slice(6, 8)
  const h = ts.slice(8, 10), mi = ts.slice(10, 12), s = ts.slice(12, 14)
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString()
}

export async function checkArchive(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
      { signal: controller.signal }
    )
    if (!res.ok) throw new Error(`Wayback API failed: ${res.status}`)
    const data = await res.json()
    const closest = data?.archived_snapshots?.closest
    if (!closest?.available) {
      return { archived: false, timestamp: null, snapshotUrl: null }
    }
    return {
      archived: true,
      timestamp: parseWaybackTimestamp(closest.timestamp),
      snapshotUrl: closest.url,
    }
  } finally {
    clearTimeout(timer)
  }
}

export function submitArchive(url) {
  // Open archive.org's save page in a new tab — avoids CORS restrictions
  window.open(`https://web.archive.org/save/${url}`, '_blank', 'noopener,noreferrer')
}

function parseWaybackTimestamp(ts) {
  // ts format: YYYYMMDDHHmmss
  const y = ts.slice(0, 4), mo = ts.slice(4, 6), d = ts.slice(6, 8)
  const h = ts.slice(8, 10), mi = ts.slice(10, 12), s = ts.slice(12, 14)
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString()
}

export async function checkArchive(url) {
  const res = await fetch(
    `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`
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
}

export async function submitArchive(url) {
  const res = await fetch(`https://web.archive.org/save/${encodeURIComponent(url)}`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`Save Page Now failed: ${res.status}`)
  const loc = res.headers.get('Content-Location')
  const snapshotUrl = loc
    ? `https://web.archive.org${loc}`
    : `https://web.archive.org/web/*/${encodeURIComponent(url)}`
  return { snapshotUrl }
}

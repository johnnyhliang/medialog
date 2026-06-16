export function getYouTubeId(url) {
  if (!url || typeof url !== 'string') return null
  const patterns = [
    /[?&]v=([^&#]+)/,           // youtube.com/watch?v=ID
    /youtu\.be\/([^?&#/]+)/,    // youtu.be/ID
    /youtube\.com\/shorts\/([^?&#/]+)/, // shorts/ID
    /youtube\.com\/embed\/([^?&#/]+)/,  // embed/ID
  ]
  for (const re of patterns) {
    const m = url.match(re)
    if (m) return m[1]
  }
  return null
}

export function getYouTubeThumbnail(url) {
  const id = getYouTubeId(url)
  if (!id) return null
  // mqdefault = 320×180 (16:9, always exists); hqdefault = 480×360
  return `https://img.youtube.com/vi/${id}/mqdefault.jpg`
}

export function isYouTubeUrl(url) {
  return getYouTubeId(url) !== null
}

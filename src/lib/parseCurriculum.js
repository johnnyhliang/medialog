// Parse a pasted question bank into patterns. Format (tracks + target optional):
//
//   ## Pattern Name [swe, quant-dev] (5)
//   - Two Sum | https://leetcode.com/problems/two-sum/ | easy
//   - Some prompt with no url | | medium
//
// A line's difficulty must be easy|medium|hard (else left null). Problems before
// the first `##` header are ignored.

const DIFFS = new Set(['easy', 'medium', 'hard'])

export function parseCurriculum(text) {
  const patterns = []
  let current = null

  for (const raw of String(text).split('\n')) {
    const line = raw.trim()
    if (!line) continue

    const header = line.match(/^#{1,3}\s+(.+)/)
    if (header) {
      let rest = header[1].trim()
      let tracks = []
      let target = null
      const trackMatch = rest.match(/\[([^\]]+)\]/)
      if (trackMatch) {
        tracks = trackMatch[1].split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
        rest = rest.replace(trackMatch[0], '').trim()
      }
      const targetMatch = rest.match(/\((\d+)\)\s*$/)
      if (targetMatch) {
        target = Number(targetMatch[1])
        rest = rest.replace(targetMatch[0], '').trim()
      }
      current = { name: rest, tracks, target, problems: [] }
      patterns.push(current)
      continue
    }

    const item = line.match(/^[-*]\s+(.+)/)
    if (item && current) {
      const parts = item[1].split('|').map((p) => p.trim())
      const title = parts[0]
      if (!title) continue
      const url = parts[1] && /^https?:\/\//.test(parts[1]) ? parts[1] : null
      const diff = parts[2]?.toLowerCase()
      current.problems.push({ title, url, difficulty: DIFFS.has(diff) ? diff : null })
    }
  }

  // default target to problem count when not given
  return patterns
    .filter((p) => p.name)
    .map((p) => ({ ...p, target: p.target ?? Math.max(1, p.problems.length) }))
}

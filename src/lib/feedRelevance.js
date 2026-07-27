// Lightweight, dependency-free relevance scoring for feed items. Builds an
// "interest profile" from the user's own topics + tags and scores each feed
// item by how many profile terms show up in its title/summary. No embeddings —
// this runs instantly client-side and needs no per-item backfill.

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'you', 'your', 'are',
  'was', 'has', 'have', 'not', 'but', 'all', 'can', 'how', 'why', 'what',
  'when', 'who', 'inbox', 'misc', 'notes', 'stuff', 'general', 'new',
])

export function tokenize(text) {
  return String(text ?? '')
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
}

// A Set of interest terms drawn from topic names, tag names, and recent entry
// titles — the three cheapest signals of what the user actually cares about.
// Title tokens only count once they recur (>=2 titles), so one-off words in a
// single headline don't pollute the profile.
export function buildInterestProfile({ topics = [], tags = [], titles = [] } = {}) {
  const terms = new Set()
  for (const t of topics) {
    if (!t?.name || t.name === 'Inbox') continue
    for (const tok of tokenize(t.name)) terms.add(tok)
  }
  for (const tag of tags) {
    const name = typeof tag === 'string' ? tag : tag?.name
    for (const tok of tokenize(name)) terms.add(tok)
  }
  const titleCounts = new Map()
  for (const title of titles) {
    for (const tok of new Set(tokenize(title))) {
      titleCounts.set(tok, (titleCounts.get(tok) ?? 0) + 1)
    }
  }
  for (const [tok, n] of titleCounts) if (n >= 2) terms.add(tok)
  return terms
}

// Count profile terms present in the item. Title matches weigh double —
// a term in the headline signals topicality more than one buried in the blurb.
export function scoreItem(item, profile) {
  if (!profile || profile.size === 0) return 0
  let score = 0
  for (const tok of new Set(tokenize(item?.title))) if (profile.has(tok)) score += 2
  for (const tok of new Set(tokenize(item?.summary))) if (profile.has(tok)) score += 1
  return score
}

// Stable relevance sort: score desc, then newest first as the tiebreak.
export function sortByRelevance(items, profile) {
  return [...items]
    .map((item) => ({ item, score: scoreItem(item, profile) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const ad = a.item.published_at ? Date.parse(a.item.published_at) : 0
      const bd = b.item.published_at ? Date.parse(b.item.published_at) : 0
      return bd - ad
    })
    .map(({ item, score }) => ({ ...item, _relevance: score }))
}

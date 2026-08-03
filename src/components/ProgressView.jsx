import { useEffect, useState } from 'react'
import { listEntriesByTopic } from '../lib/db/entries.js'
import { readPref, writePref } from '../lib/localPref.js'

const LAST_TOPIC_KEY = 'medialog_progress_topic'
const DAY = 24 * 60 * 60 * 1000

function daysSince(iso) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY)
}

// Selecting a topic here is independent of the sidebar's browse selection —
// switching topics to compare progress must not also jump the entry list you
// were reading. It only *starts* from whatever topic was last open, via
// initialTopicId, and remembers whichever one you last viewed here.
export default function ProgressView({ supabase, topics, initialTopicId }) {
  const [topicId, setTopicId] = useState(() => {
    const saved = readPref(LAST_TOPIC_KEY, null)
    if (saved && topics.some((t) => t.id === saved)) return saved
    return initialTopicId && topics.some((t) => t.id === initialTopicId) ? initialTopicId : (topics[0]?.id ?? null)
  })
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!topicId) { setEntries([]); return }
    setLoading(true)
    listEntriesByTopic(supabase, topicId)
      .then(setEntries)
      .finally(() => setLoading(false))
  }, [supabase, topicId])

  function handleSelect(id) {
    setTopicId(id)
    writePref(LAST_TOPIC_KEY, id)
  }

  const topic = topics.find((t) => t.id === topicId)
  const count = (s) => entries.filter((e) => e.status === s).length
  const total = entries.length
  const done = count('done')
  const completion = total ? Math.round((done / total) * 100) : 0

  const addedThisWeek = entries.filter((e) => {
    const d = daysSince(e.created_at)
    return d !== null && d <= 7
  }).length

  const oldestBacklog = entries
    .filter((e) => e.status === 'backlog')
    .reduce((oldest, e) => {
      const d = daysSince(e.created_at)
      return d !== null && (oldest === null || d > oldest) ? d : oldest
    }, null)

  const tagCounts = new Map()
  for (const e of entries) {
    for (const t of e.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
  }
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div>
      <div className="progress-header">
        <h2>Progress</h2>
        <select
          className="explore-filter-select"
          value={topicId ?? ''}
          onChange={(e) => handleSelect(e.target.value)}
        >
          {topics.length === 0 && <option value="">No topics yet</option>}
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '4px 0 16px' }}>
        Shows whichever topic you pick here — it remembers your last choice, separate from the
        topic you have open in Browse.
      </p>

      {!topic ? (
        <p className="muted">Pick a topic to see its progress.</p>
      ) : loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <p className="progress-stats">
            <span className="pill" style={{ color: 'var(--done)' }}>Done: {done}</span>
            <span className="pill" style={{ color: 'var(--active)' }}>Active: {count('active')}</span>
            <span className="pill" style={{ color: 'var(--backlog)' }}>Backlog: {count('backlog')}</span>
          </p>

          <div className="progress-insights">
            <div className="progress-insight-card">
              <span className="progress-insight-n">{completion}%</span>
              <span className="progress-insight-label">complete</span>
            </div>
            <div className="progress-insight-card">
              <span className="progress-insight-n">{addedThisWeek}</span>
              <span className="progress-insight-label">added this week</span>
            </div>
            <div className="progress-insight-card">
              <span className="progress-insight-n">{oldestBacklog === null ? '—' : `${oldestBacklog}d`}</span>
              <span className="progress-insight-label">oldest backlog item</span>
            </div>
          </div>

          {topTags.length > 0 && (
            <div className="progress-tags">
              <p className="section-label">Top tags</p>
              <p>
                {topTags.map(([name, n]) => (
                  <span key={name} className="pill">#{name} · {n}</span>
                ))}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { listAllArchivedEntries } from '../lib/db/entries.js'

export default function ArchiveView({ topics, onSelectTopic }) {
  const [entries, setEntries] = useState(null)
  const [search, setSearch] = useState('')
  const [expandedTopics, setExpandedTopics] = useState(new Set())

  useEffect(() => {
    listAllArchivedEntries(supabase).then(setEntries)
  }, [])

  const grouped = useMemo(() => {
    if (!entries) return null
    const q = search.toLowerCase()
    const filtered = q
      ? entries.filter((e) =>
          (e.title || '').toLowerCase().includes(q) ||
          (e.note || '').toLowerCase().includes(q) ||
          (e.url || '').toLowerCase().includes(q) ||
          e.topicName.toLowerCase().includes(q)
        )
      : entries
    const map = {}
    for (const e of filtered) {
      if (!map[e.topicName]) map[e.topicName] = []
      map[e.topicName].push(e)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [entries, search])

  function toggleTopic(name) {
    setExpandedTopics((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  if (entries === null) return <p style={{ padding: '1.5rem' }}>Loading…</p>

  const total = entries.length

  return (
    <div style={{ maxWidth: 720, padding: '1.5rem' }}>
      <h2 style={{ marginTop: 0, marginBottom: 4 }}>Archive</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
        {total} completed {total === 1 ? 'entry' : 'entries'} across {grouped?.length ?? 0} topics
      </p>

      <input
        type="search"
        placeholder="Search archive…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: 20, boxSizing: 'border-box' }}
      />

      {grouped?.length === 0 && (
        <p className="muted" style={{ fontSize: 13 }}>No archived entries{search ? ' matching that search' : ''}.</p>
      )}

      {grouped?.map(([topicName, topicEntries]) => {
        const isExpanded = expandedTopics.has(topicName)
        const topic = topics.find((t) => t.name === topicName)
        return (
          <div key={topicName} style={{ marginBottom: 12, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              onClick={() => toggleTopic(topicName)}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--surface-2)', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
              }}
            >
              <span style={{ flex: 1 }}>{topicName}</span>
              <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>{topicEntries.length}</span>
              {topic && (
                <span
                  className="muted"
                  style={{ fontSize: 11, fontWeight: 400, textDecoration: 'underline', cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); onSelectTopic(topic.id) }}
                >
                  open topic
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{isExpanded ? '▲' : '▼'}</span>
            </button>

            {isExpanded && (
              <div>
                {topicEntries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      padding: '8px 14px',
                      borderTop: '1px solid var(--border)',
                      fontSize: 13,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.url ? (
                          <a href={entry.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
                            {entry.title || entry.url}
                          </a>
                        ) : (
                          entry.title || <span className="muted">Untitled</span>
                        )}
                      </span>
                      <span className="muted" style={{ fontSize: 11, flexShrink: 0 }}>
                        {new Date(entry.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {entry.note && (
                      <p className="muted" style={{ fontSize: 12, margin: '3px 0 0', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {entry.note}
                      </p>
                    )}
                    {entry.tags?.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                        {entry.tags.map((t) => (
                          <span key={t} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'var(--surface-3)' }}>#{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

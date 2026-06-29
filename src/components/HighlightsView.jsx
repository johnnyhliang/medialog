import { useEffect, useState, useMemo } from 'react'
import ReaderModal from './ReaderModal.jsx'

export default function HighlightsView({ supabase }) {
  const [highlights, setHighlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [readerEntry, setReaderEntry] = useState(null)

  useEffect(() => {
    supabase
      .from('highlights')
      .select('*, entries(id, title, url, full_text)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setHighlights(data ?? [])
        setLoading(false)
      })
  }, [supabase])

  const filtered = useMemo(() => {
    if (!query.trim()) return highlights
    const q = query.toLowerCase()
    return highlights.filter(
      (h) =>
        h.text.toLowerCase().includes(q) ||
        h.note?.toLowerCase().includes(q) ||
        h.entries?.title?.toLowerCase().includes(q)
    )
  }, [highlights, query])

  return (
    <div className="highlights-view">
      <div className="highlights-view-header">
        <h2 className="highlights-view-title">
          Highlights
          {highlights.length > 0 && <span className="opp-badge">{highlights.length}</span>}
        </h2>
        <input
          className="highlights-search"
          placeholder="Search quotes, notes, articles…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      <div className="highlights-list">
        {loading && <p className="muted" style={{ padding: '16px' }}>Loading…</p>}

        {!loading && filtered.length === 0 && (
          <p className="muted" style={{ padding: '16px' }}>
            {query ? 'No highlights match.' : 'No highlights yet — open an article in reader mode and select text to highlight.'}
          </p>
        )}

        {filtered.map((h) => (
          <button
            key={h.id}
            className={`highlight-row highlight-row--${h.color}`}
            onClick={() => setReaderEntry(h.entries)}
          >
            <div className="highlight-row-quote">"{h.text}"</div>
            {h.note && <div className="highlight-row-note">{h.note}</div>}
            <div className="highlight-row-source">
              {h.entries?.title || h.entries?.url || 'Unknown article'}
            </div>
          </button>
        ))}
      </div>

      {readerEntry && (
        <ReaderModal entry={readerEntry} onClose={() => setReaderEntry(null)} />
      )}
    </div>
  )
}

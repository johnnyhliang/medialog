import { useEffect, useState, useCallback } from 'react'
import { getFocusEntry } from '../../lib/db/review.js'

// Pull the first "Next: …" line out of a topic's master doc.
export function parseNext(doc) {
  if (!doc) return null
  const line = doc.split('\n').find((l) => /^\s*next\s*:/i.test(l))
  return line ? line.replace(/^\s*next\s*:/i, '').trim() : null
}

// Surfaces the single resource you're actively studying + the next concrete
// action, so opening the app hands you a move instead of a backlog. The "one
// in flight" rule is a convention: only ever keep one entry in `active`.
export default function FocusWidget({ supabase, onOpenEntry }) {
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setEntry(await getFocusEntry(supabase))
    } catch {
      // Unchanged on purpose: the widget's empty state already says "nothing
      // active", and a home-screen widget is not the place to interrupt with a
      // toast. What changed is upstream — the query itself no longer reports a
      // failure as an empty result, so this catch now only sees real throws.
      setEntry(null)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { load() }, [load])

  const next = entry ? parseNext(entry.topics?.master_doc) : null

  return (
    <div className="focus-widget">
      <p className="kw-label">focus</p>
      {loading && <p className="kw-empty">loading…</p>}
      {!loading && !entry && (
        <p className="kw-empty">Nothing active. Set one resource to <b>active</b> and it shows up here.</p>
      )}
      {!loading && entry && (
        <button
          className="focus-card"
          onClick={() => onOpenEntry?.({ id: entry.id, topic_id: entry.topic_id })}
        >
          {entry.topics?.name && <span className="focus-topic">{entry.topics.name}</span>}
          <span className="focus-title">{entry.title || entry.url || 'Untitled'}</span>
          {next ? (
            <span className="focus-next"><span className="focus-next-tag">next</span>{next}</span>
          ) : (
            <span className="focus-next focus-next-empty">add a “Next:” line to this topic’s doc</span>
          )}
        </button>
      )}
    </div>
  )
}

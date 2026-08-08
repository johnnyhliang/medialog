import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { listDeadlines } from '../../lib/db/deadlines.js'
import { urgencyOf, HORIZON_DAYS } from '../../lib/deadlines.js'

// Deadlines that are actually deadlines.
//
// manager-scope.md §8 rules out due dates and overdue buckets — but that rule is
// about LEARNING. "Behind on C++ item 12" is a shaming number attached to
// something with no real date. An application window that closes is not that:
// miss it and the next chance is a year away. §9 keeps `career` as its own
// module for exactly this reason, and this is the one surface allowed to be
// urgent.
//
// Renders nothing when nothing is close, following IndexHealthBanner: the
// healthy path costs no attention. It is also why this can sit on Home without
// becoming the nag list the rest of the scope forbids.

const DISMISS_KEY = 'medialog_dismissed_deadlines'

function readDismissed() {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISS_KEY) ?? '[]')
    return Array.isArray(raw) ? raw : []
  } catch { return [] }
}

export default function DeadlineAlertBanner({ supabase, timezone, onOpenCareer }) {
  const [items, setItems] = useState([])
  const [dismissed, setDismissed] = useState(readDismissed)

  const load = useCallback(async () => {
    try {
      setItems(await listDeadlines(supabase, { tz: timezone }))
    } catch {
      // A banner that cannot load is a banner that shows nothing. Never a toast:
      // this is ambient, and nobody asked for it this render.
      setItems([])
    }
  }, [supabase, timezone])

  useEffect(() => { load() }, [load])

  function dismiss(key) {
    const next = [...dismissed, key]
    setDismissed(next)
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)) } catch {}
  }

  const visible = items.filter((i) => !dismissed.includes(i.key))
  if (!visible.length) return null

  return (
    <div className="deadline-banner">
      {visible.map((item) => {
        const urgency = urgencyOf(item.daysLeft)
        return (
          <div key={item.key} className={`deadline-row deadline-row--${urgency}`}>
            <span className="deadline-when">{item.when}</span>
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer" className="deadline-name">{item.name}</a>
            ) : (
              <button className="deadline-name" onClick={() => onOpenCareer?.()}>{item.name}</button>
            )}
            {item.detail && <span className="deadline-detail">{item.detail}</span>}
            <button
              className="deadline-dismiss"
              aria-label={`Dismiss ${item.name}`}
              onClick={() => dismiss(item.key)}
            >
              <X size={13} />
            </button>
          </div>
        )
      })}
      {visible.length > 1 && (
        <p className="deadline-foot muted">
          Within {HORIZON_DAYS} days. Everything else stays out of the way.
        </p>
      )}
    </div>
  )
}

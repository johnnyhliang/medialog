import { groupAgenda, isAgendaEmpty, BUCKETS, BUCKET_LABELS } from '../lib/agenda.js'
import { browserTimezone } from '../lib/timezone.js'

// The Agenda — `docs/intentional-app-spec.md` Part 1.
//
// The design constraint that matters more than any detail below: this must stay
// FINITE and feel closeable. It shows what is scheduled or due, never the whole
// backlog, and it has a real "caught up" end state. A reminders view that grows
// without bound is the 200-item guilt list the spec is written against.
//
// Data comes in as props. This component does not fetch and does not write —
// App.jsx owns the state and hands down `onComplete` / `onSnooze`, the same way
// Revisit.jsx works.

// How a due date reads inside a bucket. The bucket already says roughly when,
// so this only adds what the bucket does not: a weekday for this week, a date
// for later, and nothing at all for today.
function dueLabel(dueAt, bucket, tz) {
  const d = new Date(dueAt)
  if (Number.isNaN(d.getTime())) return null
  if (bucket === 'today') return null
  if (bucket === 'week') {
    return d.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz })
}

function AgendaItem({ entry, bucket, timezone, onComplete, onSnooze, onOpen }) {
  const title = entry.title || entry.url || 'Untitled'
  const when = dueLabel(entry.due_at, bucket, timezone)

  return (
    <div className="agenda-item">
      <button
        className="agenda-check"
        onClick={() => onComplete?.(entry)}
        title="Mark done"
        aria-label={`Mark "${title}" done`}
      >
        ○
      </button>

      <div className="agenda-item-body">
        <button className="agenda-title" onClick={() => onOpen?.(entry)}>
          {title}
        </button>
        <div className="agenda-meta">
          {entry.topicName && <span className="agenda-topic">{entry.topicName}</span>}
          {when && <span className="agenda-when">{when}</span>}
        </div>
      </div>

      {/* Snooze is the spec's "not now" escape hatch — the thing that keeps the
          list from becoming a guilt pile. It writes `surface_after`, which
          hides the entry until then WITHOUT changing its deadline. */}
      <button
        className="agenda-snooze"
        onClick={() => onSnooze?.(entry)}
        title="Not now"
      >
        Later
      </button>
    </div>
  )
}

export default function AgendaView({
  entries = [],
  timezone = browserTimezone(),
  now = new Date(),
  onComplete,
  onSnooze,
  onOpen,
}) {
  const groups = groupAgenda(entries, now, timezone)

  // The closure state. Not an absence of content — an actual statement that
  // there is nothing to do, which is the point of the whole feature.
  if (isAgendaEmpty(groups)) {
    return (
      <div className="agenda-view">
        <div className="agenda-empty">
          <p className="agenda-empty-title">You're caught up.</p>
          <p className="muted" style={{ fontSize: 13 }}>
            Nothing is due. Add a due date to any entry to see it here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="agenda-view">
      {BUCKETS.map((bucket) => {
        const items = groups[bucket]

        // DECISION FOR YOU (1): empty buckets are skipped here, so a quiet day
        // renders as two short sections instead of four headings and two
        // apologies. The alternative — always rendering all four with "nothing
        // overdue" under each — is more reassuring but noisier. Try it both
        // ways; it is one `if` either direction.
        if (items.length === 0) return null

        return (
          <section className="agenda-section" key={bucket}>
            <h3 className="section-label">
              {BUCKET_LABELS[bucket]}
              <span className="agenda-count">{items.length}</span>
            </h3>
            <div className="agenda-list">
              {items.map((entry) => (
                <AgendaItem
                  key={entry.id}
                  entry={entry}
                  bucket={bucket}
                  timezone={timezone}
                  onComplete={onComplete}
                  onSnooze={onSnooze}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// DECISION FOR YOU (2): "next action per topic".
//
// The spec says the agenda shows dated items PLUS the single next action per
// topic, and never defines how that action is picked. It is deliberately not
// implemented here, because a wrong guess makes the agenda noisy in a way that
// is hard to attribute — you would just find it vaguely annoying.
//
// The plausible readings, roughly in order of how much I would trust them:
//   - the oldest `status = 'active'` entry in each topic (doing-now, undated)
//   - the most recently touched entry in each topic
//   - nothing: dated items only, and topics stay out of it
//
// Worth using the dated-only version for a week first. If the agenda feels
// thin, the third option is disproved and you will know which of the other two
// you actually wanted.

// DECISION FOR YOU (3): overdue is currently listed oldest-first, because that
// is what the query returns. Newest-first is also defensible — the thing you
// missed yesterday is more actionable than the thing you missed in March, and
// a long overdue tail is where guilt accumulates. Changing it is one `.reverse()`
// here or one flag on the query.

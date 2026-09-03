import { CalendarClock } from 'lucide-react'
import { bucketFor } from '../lib/agenda.js'
import { resolveTimezone } from '../lib/timezone.js'
import { readPref } from '../lib/localPref.js'

// A dated entry is a task. Nothing in the card said so — an assignment due
// tomorrow and a link saved last year rendered identically, which made the
// whole backlog invisible outside the Agenda view.
//
// Deliberately quiet: renders nothing without a due date, so the 1,300 undated
// entries are untouched. Only 'overdue' and 'today' get colour, on the same
// principle as IndexStatus above it — a badge that shouts on every row stops
// being read, and the point of a date is that it is noticed when it matters.

const LABEL = {
  overdue: 'overdue',
  today: 'today',
  week: null, // the weekday is more useful than the word
  later: null,
}

function shortDate(due, tz) {
  return new Date(due).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz })
}

function weekday(due, tz) {
  return new Date(due).toLocaleDateString('en-US', { weekday: 'short', timeZone: tz })
}

// `useTimezone` is the app's source of truth but it does a database round trip,
// which is wrong to run once per card in a list of hundreds. It keeps its value
// in localStorage precisely so first paint is right, so read that cache here —
// same value, no fetch. A caller that already has the zone can pass it in.
function cachedTimezone() {
  return resolveTimezone(readPref('medialog_timezone', null))
}

export default function DueBadge({ dueAt, timezone, now, onEdit }) {
  if (!dueAt) return null
  const when = new Date(dueAt)
  if (Number.isNaN(when.getTime())) return null

  const tz = timezone || cachedTimezone()
  const bucket = bucketFor(dueAt, now ?? new Date(), tz)
  const text = LABEL[bucket] ?? (bucket === 'week' ? weekday(dueAt, tz) : shortDate(dueAt, tz))

  const label = `Due ${when.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz })}`
  const body = (
    <>
      <CalendarClock size={11} aria-hidden="true" />
      {text}
    </>
  )

  // Stays a plain <span> unless someone can actually act on the click. A badge
  // that looks pressable and does nothing is worse than one that never did —
  // and this same component renders in read-only surfaces (shared pages, the
  // Manager grid) where there is no owner to save the change.
  if (!onEdit) {
    return <span className={`due-badge due-badge-${bucket}`} title={label}>{body}</span>
  }

  return (
    <button
      type="button"
      className={`due-badge due-badge-${bucket} due-badge--editable`}
      title={`${label} — click to change`}
      onClick={(e) => { e.stopPropagation(); onEdit() }}
    >
      {body}
    </button>
  )
}

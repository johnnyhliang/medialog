import { useState } from 'react'
import { endOfLocalDay, localDateString, resolveTimezone } from '../lib/timezone.js'
import { readPref } from '../lib/localPref.js'

// Setting a due date is the one thing the app could not do. `due_at` was
// writable only by the MCP server, which meant the Agenda was a permanently
// empty view for anyone who was not running Claude — and that the task backlog
// did not survive without it.
//
// A native <input type="date"> on purpose: on iOS and Android it opens the OS
// date picker, and the phone is a primary client here. A hand-rolled calendar
// would look more designed and be worse to actually use with a thumb.
//
// The date the input hands back is a bare 'YYYY-MM-DD' with no zone. It is
// resolved through `endOfLocalDay` rather than `new Date(value)`, because the
// latter reads it as UTC midnight and lands the deadline on the previous day
// for every user west of Greenwich. See lib/timezone.js.
//
// Reads the cached timezone rather than `useTimezone` for the same reason
// DueBadge does: this renders inside cards, and the hook does a database round
// trip. A caller that already has the zone should pass it.
export default function DueDatePicker({ dueAt, timezone, onSave, onCancel }) {
  const tz = timezone || resolveTimezone(readPref('medialog_timezone', null))
  const [value, setValue] = useState(() => localDateString(dueAt, tz))

  function save(dateStr) {
    // An emptied field means the same thing as pressing Clear. There is no
    // separate delete for a due date — null IS how an entry stops being a task.
    onSave(dateStr ? endOfLocalDay(dateStr, tz) : null)
  }

  return (
    <div className="due-picker" onClick={(e) => e.stopPropagation()}>
      <input
        type="date"
        className="due-picker-input"
        aria-label="due date"
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') { e.preventDefault(); save(value) }
          if (e.key === 'Escape') onCancel?.()
        }}
      />
      <button type="button" className="btn-small" onClick={() => save(value)}>Save</button>
      {dueAt && (
        <button type="button" className="btn-small btn-ghost" onClick={() => save('')}>Clear</button>
      )}
      <button type="button" className="btn-small btn-ghost" onClick={() => onCancel?.()}>Cancel</button>
    </div>
  )
}

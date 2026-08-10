import { CalendarClock, Circle, Check } from 'lucide-react'
import { buildAgenda, phraseForRow, urgencyForRow, pressingCount } from '../lib/orgAgenda.js'

// The agenda, as org-mode has it: ONE dated view over everything, sitting beside
// the outline it is derived from rather than in a tab of its own.
//
// The split it renders is the whole idea (src/lib/orgAgenda.js, manager-scope
// §8): DEADLINE closes and may be loud; SCHEDULED is intent and never is. They
// are separated visually and in vocabulary — a passed target reads "was
// 2026-08-03", never "overdue" — because the moment a self-set date can shout
// at you, the plan becomes a nag list and you stop writing dates down.
//
// Nothing here is stored. It is a query over the plans, so editing a target
// moves the row and deleting a project removes it.

const GROUPS = [
  { id: 'deadline', label: 'deadline', hint: 'closes — someone else set this' },
  { id: 'scheduled', label: 'scheduled', hint: 'your own pacing' },
]

export default function AgendaPane({ projects = [], deadlines = [], timezone, onOpen, onCloseWindow }) {
  const rows = buildAgenda({ projects, deadlines, tz: timezone })
  const pressing = pressingCount(rows)

  return (
    <aside className="agenda-pane">
      <div className="agenda-pane-head">
        <CalendarClock size={13} />
        <span className="agenda-pane-title">agenda</span>
        {/* The only count allowed to nag, and only for things that truly close. */}
        {pressing > 0 && <span className="agenda-pressing">{pressing} this week</span>}
      </div>

      {rows.length === 0 ? (
        <p className="agenda-empty muted">
          Nothing dated. Add <code>@2026-10-31</code> to a step, or a{' '}
          <code>target:</code> to a plan.
        </p>
      ) : (
        GROUPS.map(({ id, label, hint }) => {
          const group = rows.filter((r) => r.kind === id)
          if (!group.length) return null
          return (
            <section key={id} className="agenda-group">
              <p className={`agenda-group-label agenda-group-label--${id}`}>
                {label}
                <span className="agenda-group-hint muted">{hint}</span>
              </p>
              <ul className="agenda-rows">
                {group.map((row) => (
                  <li key={row.key} className={`agenda-row agenda-row--${urgencyForRow(row)}`}>
                    <span className="agenda-when">{phraseForRow(row)}</span>
                    {row.url ? (
                      <a href={row.url} target="_blank" rel="noreferrer" className="agenda-row-title">
                        {row.title}
                      </a>
                    ) : row.topicId ? (
                      <button className="agenda-row-title" onClick={() => onOpen?.(row.topicId)}>
                        {row.title}
                      </button>
                    ) : (
                      <span className="agenda-row-title">{row.title}</span>
                    )}
                    {row.project && !row.isPlanTarget && (
                      <span className="agenda-row-project muted">
                        <Circle size={4} fill="currentColor" /> {row.project}
                      </span>
                    )}
                    {/* Only undated open windows get this. A dated deadline
                        ends on its own; an open window is a claim that has to
                        be retired by hand, so the hand has to be right here. */}
                    {row.kind === 'deadline' && row.daysLeft == null && onCloseWindow && (
                      <button
                        className="agenda-close"
                        title="Closed / not applying — stop showing this"
                        onClick={() => onCloseWindow(row.key)}
                      >
                        <Check size={11} /> closed
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </aside>
  )
}

import { useMemo } from 'react'
import { buildGrid, currentStreak, totalIn, activeDays, monthLabels } from '../lib/contributions.js'

// The contribution grid. See docs/manager-scope.md §6.
//
// A LOG, NOT A STREAK. gains-system.md is explicit that "there are no dates and
// no 'behind'". So: no goal line, no "you're behind", no red. An empty day is
// drawn exactly like a day before you started — because a day you did not work
// is not a failure, it is just a day.
//
// The streak IS shown, because §6 allows it, but deliberately last, in the same
// muted type as everything else, and only once it is at least 2 — a "1 day
// streak" is noise dressed up as an achievement, and a "0 day streak" is the
// shaming counter the whole design rules out.
//
// No supabase import: rows arrive as a prop, same contract as ManagerView.

const DOW_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

export default function ContributionGrid({ rows = [], weeks = 26, tz, now }) {
  const clock = useMemo(() => now ?? new Date(), [now])

  const { grid, streak, total, days, months } = useMemo(() => {
    const g = buildGrid(rows, { weeks, now: clock, tz })
    return {
      grid: g,
      streak: currentStreak(rows, { now: clock, tz }),
      total: totalIn(g),
      days: activeDays(g),
      months: monthLabels(g),
    }
  }, [rows, weeks, clock, tz])

  const monthByIndex = useMemo(
    () => Object.fromEntries(months.map((m) => [m.index, m.label])),
    [months],
  )

  return (
    <section className="cgrid" aria-label="Contribution grid">
      <div className="cgrid-head">
        <span className="cgrid-title">
          {total === 0
            ? 'no contributions yet'
            : `${total} contribution${total === 1 ? '' : 's'} · ${days} day${days === 1 ? '' : 's'}`}
        </span>
        {streak >= 2 && <span className="cgrid-streak">{streak} day run</span>}
      </div>

      <div className="cgrid-body">
        <div className="cgrid-dow" aria-hidden="true">
          {DOW_LABELS.map((label, i) => (
            <span key={i} className="cgrid-dow-label">{label}</span>
          ))}
        </div>

        <div className="cgrid-scroll">
          <div className="cgrid-months" aria-hidden="true">
            {grid.map((_, i) => (
              <span key={i} className="cgrid-month">{monthByIndex[i] ?? ''}</span>
            ))}
          </div>
          <div className="cgrid-weeks">
            {grid.map((week, wi) => (
              <div key={wi} className="cgrid-week">
                {week.map((day) => (
                  <span
                    key={day.key}
                    className={`cgrid-day cgrid-day--l${day.level}${day.future ? ' cgrid-day--future' : ''}`}
                    // Future squares are not days you missed, so they get no
                    // tooltip and no count — they are simply not there yet.
                    title={day.future
                      ? undefined
                      : `${day.count === 0 ? 'nothing' : `${day.count} contribution${day.count === 1 ? '' : 's'}`} on ${day.key}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="cgrid-foot muted">
        A square is something finished — a step ticked or an entry done. Saving a link is not a contribution.
      </p>
    </section>
  )
}

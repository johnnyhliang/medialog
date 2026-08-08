// The agenda, org-mode style: one dated view over everything, assembled from
// data that already exists. Pure.
//
// THE CENTRAL BORROWING. Org-mode distinguishes SCHEDULED ("I intend to start
// this then") from DEADLINE ("this closes then"), and keeps them visually
// distinct forever. That is exactly the line docs/manager-scope.md §8 already
// draws between a `target:` you set to pace yourself and a window someone else
// closes. So this is not two features glued together — it is one model that was
// already half-written in the doc.
//
//   SCHEDULED  plan `target:` dates, and `@YYYY-MM-DD` on an individual step.
//              Quiet. Slipping one is information, not a failure. Never red,
//              never "overdue" — a target that passes just says "later than
//              planned", which is a fact about the plan, not about you.
//   DEADLINE   application and program windows. These genuinely close, so they
//              are allowed to count down and to be the loudest thing here.
//
// The agenda is a QUERY over the plans, not a table of its own — IDEAS.md
// § Big swings, "views are queries, not tabs". Nothing below is stored: delete
// a project and its rows vanish, edit a target and they move.

import { parseFrontmatter, parseSteps } from './goals.js'
import { daysUntil, phraseFor, urgencyOf } from './deadlines.js'
import { browserTimezone } from './timezone.js'

// Org writes `SCHEDULED: <2026-10-31>`. Angle brackets are noisy to type inside
// a markdown checkbox and `<...>` gets eaten by some renderers, so a step dates
// itself with a trailing `@YYYY-MM-DD`. Anchored to the end so an email address
// or a handle mid-sentence cannot be mistaken for a date.
const STEP_DATE = /@(\d{4}-\d{2}-\d{2})\s*$/

/** Strip the trailing `@date` so the step renders as prose. */
export function stepText(text) {
  return String(text ?? '').replace(STEP_DATE, '').trim()
}

/** The `@YYYY-MM-DD` on a step, or null. */
export function stepDate(text) {
  const m = STEP_DATE.exec(String(text ?? ''))
  return m ? m[1] : null
}

/**
 * SCHEDULED rows from the projects themselves.
 *
 * A project contributes its own `target:` only while it still has unfinished
 * steps — a finished plan is not pending, and leaving it on the agenda forever
 * is how a dated view becomes something you stop reading.
 */
export function scheduledFrom(projects = [], { now = new Date(), tz = browserTimezone() } = {}) {
  const rows = []
  for (const p of projects) {
    if (!p?.id) continue
    const { target, body } = parseFrontmatter(p.master_doc ?? '')
    const { steps } = parseSteps(body)
    const open = steps.filter((s) => !s.checked)

    for (const s of open) {
      const date = stepDate(s.text)
      if (!date) continue
      rows.push({
        key: `step:${p.id}:${s.lineIndex}`,
        kind: 'scheduled',
        title: stepText(s.text),
        project: p.name,
        topicId: p.id,
        date,
        daysLeft: daysUntil(date, now, tz),
      })
    }

    if (target && open.length) {
      const date = target.toISOString().slice(0, 10)
      rows.push({
        key: `plan:${p.id}`,
        kind: 'scheduled',
        title: `${p.name} — ${open.length} step${open.length === 1 ? '' : 's'} left`,
        project: p.name,
        topicId: p.id,
        date,
        daysLeft: daysUntil(date, now, tz),
        isPlanTarget: true,
      })
    }
  }
  return rows
}

/** DEADLINE rows, from the career surfaces. `buildDeadlines` output, relabelled. */
export function deadlineRows(deadlines = []) {
  return deadlines.map((d) => ({
    key: d.key,
    kind: 'deadline',
    title: d.name,
    project: d.detail || null,
    url: d.url || null,
    date: null,
    daysLeft: d.daysLeft,
    when: d.when,
  }))
}

/**
 * The whole agenda, soonest first, deadlines winning ties.
 *
 * `horizonDays` bounds the SCHEDULED half only. Deadlines arrive pre-filtered by
 * their own 28-day window, and a plan target eighteen months out is real but is
 * not agenda material — it belongs on the card, where it already is.
 */
export function buildAgenda({ projects = [], deadlines = [], horizonDays = 60, now = new Date(), tz = browserTimezone() } = {}) {
  const scheduled = scheduledFrom(projects, { now, tz })
    .filter((r) => r.daysLeft != null && r.daysLeft <= horizonDays)
  const rows = [...scheduled, ...deadlineRows(deadlines)]

  return rows.sort((a, b) => {
    const ad = a.daysLeft ?? Infinity
    const bd = b.daysLeft ?? Infinity
    if (ad !== bd) return ad - bd
    // A hard close outranks a soft target on the same day.
    if (a.kind !== b.kind) return a.kind === 'deadline' ? -1 : 1
    return String(a.title).localeCompare(String(b.title))
  })
}

/**
 * How a row reads. SCHEDULED never borrows the deadline vocabulary: a target
 * that has passed says "was <date>", not "overdue" and not "3 days late".
 */
export function phraseForRow(row) {
  if (!row) return ''
  if (row.kind === 'deadline') return row.when ?? phraseFor(row.daysLeft)
  if (row.daysLeft == null) return ''
  if (row.daysLeft < 0) return `was ${row.date}`
  return phraseFor(row.daysLeft)
}

/** Only deadlines get urgency colour; a target is never loud. See §8. */
export function urgencyForRow(row) {
  return row?.kind === 'deadline' ? urgencyOf(row.daysLeft) : 'scheduled'
}

/** Count of hard deadlines inside a week — the only number allowed to nag. */
export function pressingCount(rows = []) {
  return rows.filter((r) => r.kind === 'deadline' && r.daysLeft != null && r.daysLeft <= 7).length
}

// The Manager's derivation layer — see docs/manager-scope.md §3.
//
// PURE. No supabase, no React, no clock of its own (`now` is always passed in).
// All the logic that decides what a resume card says lives here so it can be
// tested without a mock client, which is the mistake goals.js/studyPlan.js made:
// they were tested but the code that would have USED them never existed.
//
// Nothing here throws on bad input. A topic whose master_doc is empty, missing,
// or plain prose is a normal case — it just has no plan.

import { parseFrontmatter, parseSteps, deriveProgress } from './goals.js'

const DAY = 86400000

// Momentum thresholds. These are behaviour measurements, not priorities you set
// (§3: "that cannot be gamed, because it measures behaviour rather than
// intention"), so the numbers only have to match how a week of work actually
// feels:
//   < 7d   warm    — touched within the current week; this is live work.
//   < 30d  cooling — you have missed a week or more. Still recoverable, and this
//                    is exactly the window where a nudge is useful.
//   >= 30d cold    — a month untouched. Either resume it or park it; that
//                    forced choice is the whole point of [park].
// A topic with no activity timestamp at all is cold, not warm: an empty topic
// you created and abandoned is precisely the thing that drowns.
export const WARM_DAYS = 7
export const COOLING_DAYS = 30

export function momentumFor(lastTouchedAt, now = new Date()) {
  if (!lastTouchedAt) return 'cold'
  const t = lastTouchedAt instanceof Date ? lastTouchedAt : new Date(lastTouchedAt)
  const ms = t.getTime()
  if (Number.isNaN(ms)) return 'cold'
  const days = (now.getTime() - ms) / DAY
  if (days < WARM_DAYS) return 'warm'
  if (days < COOLING_DAYS) return 'cooling'
  return 'cold'
}

/**
 * Progress for one topic, read out of its master_doc via goals.js.
 *
 * Returns null unless the doc actually has `- [ ]` checkboxes. That null is
 * load-bearing: the UI renders no progress chrome at all for it, which is how a
 * basketball topic avoids growing a phase tracker it does not use
 * (docs/manager-scope.md §2, "The UI boundary").
 */
export function progressFor(masterDoc, now = new Date()) {
  const doc = typeof masterDoc === 'string' ? masterDoc : ''
  if (!doc.trim()) return null
  const { started, target, body } = parseFrontmatter(doc)
  const { total, done } = parseSteps(body)
  if (total === 0) return null
  const { stepPct, timePct, daysLeft, onTrack } = deriveProgress({ started, target, total, done, now })
  return {
    total,
    done,
    stepPct,
    timePct,
    daysLeft,
    // goals.js returns onTrack: null when there are no dates to compare against.
    // "behind" must mean "the plan says so", never "we could not tell".
    behind: onTrack === false,
  }
}

const MOMENTUM_RANK = { cold: 0, cooling: 1, warm: 2 }

/**
 * Build one resume card per active topic.
 *
 * `entries` may be full entry rows or the trimmed {topic_id, status, updated_at}
 * projection the db layer fetches — only those three fields are read.
 */
export function buildResumeCards({ topics = [], entries = [], states = [], now = new Date() } = {}) {
  const stateByTopic = new Map()
  for (const s of states || []) {
    if (s && s.topic_id) stateByTopic.set(s.topic_id, s)
  }

  const agg = new Map()
  for (const e of entries || []) {
    if (!e || !e.topic_id) continue
    let a = agg.get(e.topic_id)
    if (!a) {
      a = { active: 0, backlog: 0, lastTouched: null }
      agg.set(e.topic_id, a)
    }
    if (e.status === 'active') a.active += 1
    else if (e.status === 'backlog') a.backlog += 1
    const t = e.updated_at ? new Date(e.updated_at).getTime() : NaN
    if (!Number.isNaN(t) && (a.lastTouched === null || t > a.lastTouched)) a.lastTouched = t
  }

  const cards = []
  for (const topic of topics || []) {
    if (!topic || !topic.id) continue
    // Inbox is a staging area, not a project. It already has its own surface
    // (Triage) and giving it a resume card would put "next: …" on the one topic
    // whose entire purpose is to be emptied.
    if (topic.name === 'Inbox') continue
    if (topic.archived_at) continue

    const a = agg.get(topic.id) || { active: 0, backlog: 0, lastTouched: null }
    // Fall back to the topic's own timestamps so a topic with no entries still
    // dates from something real rather than reading as never-touched.
    const fallback = topic.updated_at || topic.created_at || null
    const lastTouchedAt = a.lastTouched !== null
      ? new Date(a.lastTouched).toISOString()
      : fallback

    const state = stateByTopic.get(topic.id) || null
    cards.push({
      topicId: topic.id,
      name: topic.name,
      lastTouchedAt,
      momentum: momentumFor(lastTouchedAt, now),
      activeCount: a.active,
      backlogCount: a.backlog,
      nextAction: state?.next_action || '',
      parked: Boolean(state?.parked_at),
      parkedAt: state?.parked_at || null,
      parkedNote: state?.parked_note || '',
      progress: progressFor(topic.master_doc, now),
    })
  }
  return cards
}

/**
 * Split cards into the live list and the parked shelf.
 *
 * Sort choice: COLDEST FIRST. The question this surface answers is "what's
 * rotting" (§3, "Sort by momentum × staleness"), not "what am I doing today" —
 * the warm topics are the ones you would have opened anyway. Within a momentum
 * band the older last-touch comes first, so the ordering is momentum then
 * staleness and never needs a priority field.
 *
 * Parked topics are excluded from the main list entirely — that is what parking
 * buys — but they are returned, not dropped, so the shelf can render them.
 */
export function splitCards(cards = [], { sort = 'stale' } = {}) {
  const active = []
  const parked = []
  for (const c of cards || []) (c.parked ? parked : active).push(c)

  const staleness = (c) => (c.lastTouchedAt ? new Date(c.lastTouchedAt).getTime() : 0)

  active.sort((a, b) => {
    if (sort === 'recent') return staleness(b) - staleness(a)
    const m = MOMENTUM_RANK[a.momentum] - MOMENTUM_RANK[b.momentum]
    if (m !== 0) return m
    return staleness(a) - staleness(b)
  })
  // Most recently parked first — the shelf reads as a log of decisions.
  parked.sort((a, b) => (b.parkedAt || '').localeCompare(a.parkedAt || ''))

  return { active, parked }
}

/** Cards plus the split, in one call — what the view actually wants. */
export function buildManager(input) {
  const cards = buildResumeCards(input)
  return { cards, ...splitCards(cards, { sort: input?.sort }) }
}

export function relativeDays(dateStr, now = new Date()) {
  if (!dateStr) return 'never touched'
  const t = new Date(dateStr).getTime()
  if (Number.isNaN(t)) return 'never touched'
  const days = Math.floor((now.getTime() - t) / DAY)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

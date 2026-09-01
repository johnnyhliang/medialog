// Interview tracker: pattern-topics + problem-entries + readiness math.

import { unwrap, unwrapList } from './unwrap.js'
import { requireUser } from '../requireUser.js'

// Fetch every pattern-topic and the problems inside them in two round-trips.
export async function listInterview(supabase) {
  const patterns = unwrapList(await supabase
    .from('topics')
    .select('id, name, master_doc, tracks, pattern_target')
    .not('pattern_target', 'is', null)
    .is('archived_at', null)
    .order('name'), 'listInterview.patterns')
  if (!patterns.length) return { patterns: [], problemsByTopic: {} }

  const ids = patterns.map((p) => p.id)
  const problems = unwrapList(await supabase
    .from('entries')
    // srs_interval + surface_after are needed for review scheduling and the
    // staleness/pace math in interviewPlan.js; updated_at feeds the actual-rate
    // calculation. entries had no updated_at column until migration 0069 — see
    // that migration for why this select was crashing every call.
    .select('id, topic_id, title, url, status, difficulty, confidence, srs_ef, srs_reps, srs_interval, surface_after, updated_at')
    .in('topic_id', ids)
    .is('deleted_at', null), 'listInterview.problems')

  const problemsByTopic = {}
  // No `?? []` guard: unwrapList already guarantees an array, and here an empty
  // one can only mean "no problems", never "the query failed".
  for (const row of problems) {
    (problemsByTopic[row.topic_id] ??= []).push(row)
  }
  return { patterns, problemsByTopic }
}

// Confidence signal for one solved problem, 0..1. Self-rating wins; otherwise
// derive from SM2 ease (2.5 default → ~0.6, climbs with recall success).
function masterySignal(problem) {
  if (problem.confidence != null) return problem.confidence / 5
  const ef = problem.srs_ef ?? 2.5
  return Math.max(0, Math.min(1, (ef - 1.3) / (2.8 - 1.3))) * 0.85
}

// Per-pattern readiness = coverage × mastery.
export function patternReadiness(pattern, problems = []) {
  const target = pattern.pattern_target || Math.max(1, problems.length)
  const solved = problems.filter((p) => p.status === 'done')
  const coverage = Math.min(solved.length / target, 1)
  const mastery = solved.length
    ? solved.reduce((s, p) => s + masterySignal(p), 0) / solved.length
    : 0
  return { coverage, mastery, ready: coverage * mastery, solved: solved.length, target }
}

// Per-track readiness = average of its patterns' readiness.
export function trackReadiness(patterns, problemsByTopic) {
  const byTrack = {}
  for (const p of patterns) {
    const r = patternReadiness(p, problemsByTopic[p.id])
    for (const t of p.tracks ?? []) {
      (byTrack[t] ??= []).push(r.ready)
    }
  }
  const out = {}
  for (const [track, vals] of Object.entries(byTrack)) {
    out[track] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }
  return out
}

// Insert patterns as topics + their problems as entries. Idempotent by topic
// name: an existing pattern-topic keeps its problems, new problems are appended
// (deduped by title within the topic).
export async function seedPatterns(supabase, patterns) {
  // requireUser: seeding is an explicit import action, and every topic/entry it
  // writes is stamped with user.id. Under the old destructure a signed-out call
  // read the existing-topics list as empty and then re-seeded the whole
  // curriculum with user_id undefined — the idempotency guarantee in the
  // comment above silently did not hold.
  const user = await requireUser(supabase)
  const existing = unwrapList(await supabase
    .from('topics')
    .select('id, name, pattern_target')
    .eq('user_id', user.id), 'seedPatterns.existingTopics')
  const byName = new Map(existing.map((t) => [t.name.toLowerCase(), t]))

  let topicsAdded = 0
  let problemsAdded = 0

  for (const pat of patterns) {
    let topic = byName.get(pat.name.toLowerCase())
    if (!topic) {
      topic = unwrap(await supabase
        .from('topics')
        .insert({
          user_id: user.id,
          name: pat.name,
          master_doc: pat.primer ?? '',
          tracks: pat.tracks ?? [],
          pattern_target: pat.target ?? Math.max(1, pat.problems?.length ?? 1),
        })
        .select()
        .single(), 'seedPatterns.insertTopic')
      byName.set(pat.name.toLowerCase(), topic)
      topicsAdded++
    } else if (topic.pattern_target == null) {
      // promote an existing plain topic into a pattern
      unwrap(await supabase.from('topics')
        .update({ tracks: pat.tracks ?? [], pattern_target: pat.target ?? 1, master_doc: pat.primer ?? '' })
        .eq('id', topic.id), 'seedPatterns.promoteTopic')
    }

    if (!pat.problems?.length) continue
    // Dropping this error was the worst one in the file: a failed lookup read as
    // "this topic has no problems yet", so the next line re-inserted every
    // problem in the pattern as a duplicate.
    const have = unwrapList(await supabase
      .from('entries').select('title').eq('topic_id', topic.id).is('deleted_at', null),
    'seedPatterns.existingProblems')
    const haveTitles = new Set(have.map((e) => (e.title ?? '').toLowerCase()))

    const rows = pat.problems
      .filter((pr) => !haveTitles.has(pr.title.toLowerCase()))
      .map((pr) => ({
        user_id: user.id,
        topic_id: topic.id,
        title: pr.title,
        url: pr.url ?? null,
        note: '',
        status: 'backlog',
        difficulty: pr.difficulty ?? null,
      }))
    if (rows.length) {
      unwrap(await supabase.from('entries').insert(rows), 'seedPatterns.insertProblems')
      problemsAdded += rows.length
    }
  }
  return { topicsAdded, problemsAdded }
}

export async function setProblem(supabase, id, patch) {
  unwrap(await supabase.from('entries').update(patch).eq('id', id), 'setProblem')
}

// Maps a 1-5 self-rating to an SM-2 grade. Below 3 in SM-2 means "failed recall"
// and resets the interval, so a 1-2 confidence has to land there — rating a
// problem "barely understood" and then not seeing it for a month is the exact
// failure this scheduling is meant to prevent.
export function confidenceToGrade(confidence) {
  if (confidence == null) return 4
  if (confidence <= 2) return 2
  if (confidence === 3) return 3
  if (confidence === 4) return 4
  return 5
}

/**
 * Schedules the next review for a solved problem, driving the SM-2 state that
 * already exists on entries. Without this the interview tracker wrote confidence
 * but never surface_after, so nothing was ever due and masterySignal's srs_ef
 * fallback read a value that never changed.
 *
 * Returns the SRS patch so callers can update local state without a refetch.
 */
export async function scheduleReview(supabase, problem, confidence) {
  const { rateRevisit } = await import('./entries.js')
  return rateRevisit(supabase, problem, confidenceToGrade(confidence))
}

// Manually add a problem (with optional link) to a pattern topic.
export async function addProblem(supabase, topicId, { title, url = null, difficulty = null }) {
  // requireUser: driven by the "add problem" form, so signed-out is not an
  // ordinary outcome to absorb.
  const user = await requireUser(supabase)
  return unwrap(await supabase
    .from('entries')
    // The problem name is the whole point of the row, so it is a deliberate
    // title — writing notes on the problem must not rename it to the note's
    // first line.
    .insert({ user_id: user.id, topic_id: topicId, title, url, note: '', status: 'backlog', difficulty, title_edited: true })
    .select()
    .single(), 'addProblem')
}

// Soft-delete (goes to trash, recoverable) — mirrors the rest of the app.
export async function deleteProblem(supabase, id) {
  unwrap(await supabase
    .from('entries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id), 'deleteProblem')
}

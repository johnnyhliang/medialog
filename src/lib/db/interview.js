// Interview tracker: pattern-topics + problem-entries + readiness math.

// Fetch every pattern-topic and the problems inside them in two round-trips.
export async function listInterview(supabase) {
  const { data: patterns, error } = await supabase
    .from('topics')
    .select('id, name, master_doc, tracks, pattern_target')
    .not('pattern_target', 'is', null)
    .is('archived_at', null)
    .order('name')
  if (error) throw new Error(error.message)
  if (!patterns.length) return { patterns: [], problemsByTopic: {} }

  const ids = patterns.map((p) => p.id)
  const { data: problems, error: pErr } = await supabase
    .from('entries')
    .select('id, topic_id, title, url, status, difficulty, confidence, srs_ef, srs_reps')
    .in('topic_id', ids)
    .is('deleted_at', null)
  if (pErr) throw new Error(pErr.message)

  const problemsByTopic = {}
  for (const row of problems ?? []) {
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
  const { data: { user } } = await supabase.auth.getUser()
  const { data: existing } = await supabase
    .from('topics')
    .select('id, name, pattern_target')
    .eq('user_id', user.id)
  const byName = new Map((existing ?? []).map((t) => [t.name.toLowerCase(), t]))

  let topicsAdded = 0
  let problemsAdded = 0

  for (const pat of patterns) {
    let topic = byName.get(pat.name.toLowerCase())
    if (!topic) {
      const { data, error } = await supabase
        .from('topics')
        .insert({
          user_id: user.id,
          name: pat.name,
          master_doc: pat.primer ?? '',
          tracks: pat.tracks ?? [],
          pattern_target: pat.target ?? Math.max(1, pat.problems?.length ?? 1),
        })
        .select()
        .single()
      if (error) throw new Error(error.message)
      topic = data
      byName.set(pat.name.toLowerCase(), topic)
      topicsAdded++
    } else if (topic.pattern_target == null) {
      // promote an existing plain topic into a pattern
      await supabase.from('topics')
        .update({ tracks: pat.tracks ?? [], pattern_target: pat.target ?? 1, master_doc: pat.primer ?? '' })
        .eq('id', topic.id)
    }

    if (!pat.problems?.length) continue
    const { data: have } = await supabase
      .from('entries').select('title').eq('topic_id', topic.id).is('deleted_at', null)
    const haveTitles = new Set((have ?? []).map((e) => (e.title ?? '').toLowerCase()))

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
      const { error } = await supabase.from('entries').insert(rows)
      if (error) throw new Error(error.message)
      problemsAdded += rows.length
    }
  }
  return { topicsAdded, problemsAdded }
}

export async function setProblem(supabase, id, patch) {
  const { error } = await supabase.from('entries').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

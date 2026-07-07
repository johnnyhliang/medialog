import { useEffect, useMemo, useState } from 'react'
import { GraduationCap, ChevronDown, ChevronRight } from 'lucide-react'
import { listInterview, seedPatterns, setProblem, patternReadiness, trackReadiness } from '../lib/db/interview.js'
import { parseCurriculum } from '../lib/parseCurriculum.js'
import { PATTERNS, TRACKS } from '../lib/interviewSeed.js'

const STATUS_CYCLE = { backlog: 'active', active: 'done', done: 'backlog' }
const STATUS_LABEL = { backlog: 'to do', active: 'attempting', done: 'solved' }
const DIFF_CLASS = { easy: 'diff-easy', medium: 'diff-medium', hard: 'diff-hard' }

function pct(x) { return `${Math.round(x * 100)}%` }

function ProblemRow({ p, onCycle, onConfidence }) {
  return (
    <div className={`iv-problem iv-problem--${p.status || 'backlog'}`}>
      <button className="iv-status" onClick={() => onCycle(p)} title="Cycle status">
        <span className={`iv-status-dot iv-status-${p.status || 'backlog'}`} />
        {STATUS_LABEL[p.status] || 'to do'}
      </button>
      {p.url ? (
        <a className="iv-problem-title" href={p.url} target="_blank" rel="noreferrer">{p.title}</a>
      ) : (
        <span className="iv-problem-title iv-problem-title--prompt">{p.title}</span>
      )}
      {p.difficulty && <span className={`iv-diff ${DIFF_CLASS[p.difficulty]}`}>{p.difficulty}</span>}
      {p.status === 'done' && (
        <select
          className="iv-conf"
          value={p.confidence ?? ''}
          onChange={(e) => onConfidence(p, e.target.value ? Number(e.target.value) : null)}
          title="Confidence"
        >
          <option value="">conf…</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}/5</option>)}
        </select>
      )}
    </div>
  )
}

function PatternCard({ pattern, problems, onCycle, onConfidence }) {
  const [open, setOpen] = useState(false)
  const r = patternReadiness(pattern, problems)
  return (
    <div className="iv-pattern">
      <div className="iv-pattern-head" onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="iv-pattern-name">{pattern.name}</span>
        <div className="iv-pattern-tracks">
          {(pattern.tracks ?? []).map((t) => <span key={t} className="iv-track-chip">{t}</span>)}
        </div>
        <span className="iv-pattern-count">{r.solved}/{r.target}</span>
        <div className="iv-pattern-bar" title={`coverage ${pct(r.coverage)} · mastery ${pct(r.mastery)}`}>
          <div className="iv-pattern-fill" style={{ width: pct(r.ready) }} />
        </div>
      </div>
      {open && (
        <div className="iv-pattern-body">
          {pattern.master_doc && <p className="iv-primer">{pattern.master_doc}</p>}
          {(problems ?? []).length === 0
            ? <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>no problems yet — add a bank below.</p>
            : problems.map((p) => (
              <ProblemRow key={p.id} p={p} onCycle={onCycle} onConfidence={onConfidence} />
            ))}
        </div>
      )}
    </div>
  )
}

export default function InterviewView({ supabase, addToast }) {
  const [data, setData] = useState(null)
  const [track, setTrack] = useState('all')
  const [busy, setBusy] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [paste, setPaste] = useState('')

  async function load() {
    try { setData(await listInterview(supabase)) }
    catch (e) { addToast?.(e.message, 'error'); setData({ patterns: [], problemsByTopic: {} }) }
  }
  useEffect(() => { load() }, [])

  const readiness = useMemo(
    () => data ? trackReadiness(data.patterns, data.problemsByTopic) : {},
    [data],
  )

  const visiblePatterns = useMemo(() => {
    if (!data) return []
    const list = track === 'all'
      ? data.patterns
      : data.patterns.filter((p) => (p.tracks ?? []).includes(track))
    return [...list].sort((a, b) => {
      const ra = patternReadiness(a, data.problemsByTopic[a.id]).ready
      const rb = patternReadiness(b, data.problemsByTopic[b.id]).ready
      return ra - rb // weakest first — that's what needs work
    })
  }, [data, track])

  async function handleSeed() {
    setBusy(true)
    try {
      const res = await seedPatterns(supabase, PATTERNS)
      addToast?.(`Seeded ${res.topicsAdded} patterns, ${res.problemsAdded} problems`)
      await load()
    } catch (e) { addToast?.(e.message, 'error') }
    setBusy(false)
  }

  async function handleImport() {
    const parsed = parseCurriculum(paste)
    if (!parsed.length) { addToast?.('Nothing to import — check the format', 'error'); return }
    setBusy(true)
    try {
      const res = await seedPatterns(supabase, parsed)
      addToast?.(`Added ${res.topicsAdded} patterns, ${res.problemsAdded} problems`)
      setPaste(''); setShowImport(false)
      await load()
    } catch (e) { addToast?.(e.message, 'error') }
    setBusy(false)
  }

  async function cycle(p) {
    const next = STATUS_CYCLE[p.status] || 'active'
    setData((d) => ({
      ...d,
      problemsByTopic: {
        ...d.problemsByTopic,
        [p.topic_id]: d.problemsByTopic[p.topic_id].map((x) => x.id === p.id ? { ...x, status: next } : x),
      },
    }))
    try { await setProblem(supabase, p.id, { status: next }) }
    catch (e) { addToast?.(e.message, 'error'); load() }
  }

  async function confidence(p, val) {
    setData((d) => ({
      ...d,
      problemsByTopic: {
        ...d.problemsByTopic,
        [p.topic_id]: d.problemsByTopic[p.topic_id].map((x) => x.id === p.id ? { ...x, confidence: val } : x),
      },
    }))
    try { await setProblem(supabase, p.id, { confidence: val }) }
    catch (e) { addToast?.(e.message, 'error'); load() }
  }

  if (!data) return <div className="iv-view"><p className="muted">loading…</p></div>

  const empty = data.patterns.length === 0

  return (
    <div className="iv-view">
      <div className="iv-header">
        <h2 className="iv-title"><GraduationCap size={20} /> interview readiness</h2>
        <button className="iv-import-btn" onClick={() => setShowImport((v) => !v)}>
          {showImport ? 'close' : '+ add question bank'}
        </button>
      </div>

      {showImport && (
        <div className="iv-import">
          <p className="muted" style={{ fontSize: 'var(--text-xs)', marginBottom: 8 }}>
            One <code>## Pattern Name [track1, track2] (target)</code> per section, then
            {' '}<code>- Title | url | difficulty</code> lines. Tracks: {TRACKS.map((t) => t.key).join(', ')}.
          </p>
          <textarea
            className="iv-import-ta"
            rows={8}
            placeholder={'## Segment Trees [swe] (4)\n- Range Sum Query - Mutable | https://leetcode.com/problems/range-sum-query-mutable/ | medium'}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <button onClick={handleImport} disabled={busy || !paste.trim()}>{busy ? 'importing…' : 'import'}</button>
        </div>
      )}

      {empty ? (
        <div className="iv-empty">
          <p className="muted">No curriculum yet. Seed a starter set of patterns and concept primers across all tracks — then fill in problems as you go.</p>
          <button className="iv-seed-btn" onClick={handleSeed} disabled={busy}>
            {busy ? 'seeding…' : `seed starter curriculum (${PATTERNS.length} patterns)`}
          </button>
        </div>
      ) : (
        <>
          <div className="iv-readiness">
            {TRACKS.map((t) => (
              <button
                key={t.key}
                className={`iv-track-card ${track === t.key ? 'active' : ''}`}
                onClick={() => setTrack(track === t.key ? 'all' : t.key)}
              >
                <span className="iv-track-label">{t.label}</span>
                <span className="iv-track-pct">{pct(readiness[t.key] ?? 0)}</span>
                <div className="iv-track-bar"><div className="iv-track-fill" style={{ width: pct(readiness[t.key] ?? 0) }} /></div>
              </button>
            ))}
          </div>

          <div className="iv-filter-row">
            <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
              {track === 'all' ? 'all patterns · weakest first' : `${TRACKS.find((t) => t.key === track)?.label} · weakest first`}
            </span>
            {track !== 'all' && <button className="iv-clear" onClick={() => setTrack('all')}>show all</button>}
          </div>

          <div className="iv-patterns">
            {visiblePatterns.map((p) => (
              <PatternCard
                key={p.id}
                pattern={p}
                problems={data.problemsByTopic[p.id]}
                onCycle={cycle}
                onConfidence={confidence}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

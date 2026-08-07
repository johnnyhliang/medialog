import { useMemo, useState } from 'react'
import { Sparkles, ChevronRight, PauseCircle, PlayCircle } from 'lucide-react'
import { buildManager, relativeDays } from '../lib/manager.js'

// The Manager — one surface answering "where am I across everything".
//
// This is also a containment boundary (docs/manager-scope.md §2): everything
// plan-shaped renders HERE and nowhere else, which is what lets TopicView stay
// a topic screen rather than growing progress chrome for topics that have no
// plan. No supabase import — data arrives as props, mutations go out as on*
// callbacks, same contract as Revisit.jsx.

const MOMENTUM_LABEL = { warm: 'warm', cooling: 'cooling', cold: 'cold' }

function NextAction({ card, onSetNextAction }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(card.nextAction)

  async function commit() {
    setEditing(false)
    const value = draft.trim()
    if (value === (card.nextAction || '')) return
    await onSetNextAction(card.topicId, value)
  }

  if (editing) {
    return (
      <input
        className="manager-next-input"
        autoFocus
        value={draft}
        placeholder="one line — what happens next"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') { setDraft(card.nextAction); setEditing(false) }
        }}
      />
    )
  }

  return (
    <button
      className={`manager-next${card.nextAction ? '' : ' manager-next--empty'}`}
      onClick={() => { setDraft(card.nextAction); setEditing(true) }}
      title="Click to edit"
    >
      {card.nextAction ? <><span className="manager-next-label">next:</span> {card.nextAction}</> : 'set a next action'}
    </button>
  )
}

// Progress renders ONLY when the master doc actually has checkboxes;
// progressFor() returns null otherwise. Progressive disclosure, per VISION.md.
function Progress({ progress }) {
  if (!progress) return null
  return (
    <span className="manager-progress">
      <span className="manager-progress-bar">
        <span
          className="manager-progress-fill"
          style={{ width: `${Math.round((progress.stepPct ?? 0) * 100)}%` }}
        />
      </span>
      <span className="manager-progress-count">{progress.done}/{progress.total}</span>
      {progress.behind && <span className="manager-chip manager-chip--behind">behind</span>}
    </span>
  )
}

function ResumeCard({ card, now, onResume, onSetNextAction, onPark }) {
  return (
    <div className={`manager-card manager-card--${card.momentum}`}>
      <div className="manager-card-head">
        <button className="manager-card-name" onClick={() => onResume(card.topicId)}>
          {card.name}
        </button>
        <span className={`manager-chip manager-chip--${card.momentum}`}>{MOMENTUM_LABEL[card.momentum]}</span>
      </div>

      <div className="manager-card-meta">
        <span>last touched {relativeDays(card.lastTouchedAt, now)}</span>
        <span>·</span>
        <span>{card.activeCount} active</span>
        <span>·</span>
        <span>{card.backlogCount} backlog</span>
        <Progress progress={card.progress} />
      </div>

      <div className="manager-card-foot">
        <NextAction card={card} onSetNextAction={onSetNextAction} />
        <div className="manager-card-actions">
          <button className="btn-small" onClick={() => onResume(card.topicId)}>resume</button>
          <button className="btn-small manager-park-btn" onClick={() => onPark(card)}>park</button>
        </div>
      </div>
    </div>
  )
}

export default function ManagerView({
  topics = [],
  entries = [],
  states = [],
  loading = false,
  onResume,
  onSetNextAction,
  onPark,
  onUnpark,
}) {
  const [shelfOpen, setShelfOpen] = useState(false)
  const now = useMemo(() => new Date(), [])
  const { active, parked } = useMemo(
    () => buildManager({ topics, entries, states, now }),
    [topics, entries, states, now],
  )

  function handlePark(card) {
    // One line, prompted. The note is the whole value of parking — "waiting on
    // the course to start" is what makes the decision reversible six weeks later.
    const note = window.prompt(`Park “${card.name}” — why, in one line?`, card.parkedNote || '')
    if (note === null) return
    onPark(card.topicId, note)
  }

  if (loading) {
    return <div className="manager-view"><p className="muted">loading…</p></div>
  }

  return (
    <div className="manager-view">
      <header className="manager-header">
        <h2>Manager</h2>
        <p className="muted">Coldest first — what is going quiet, not what is loudest.</p>
      </header>

      {active.length === 0 ? (
        <div className="manager-empty">
          <Sparkles size={28} />
          <h2>nothing is drifting</h2>
          <p className="muted">
            {parked.length > 0
              ? `Every live topic is current. ${parked.length} parked on purpose.`
              : 'Every topic is current. Nothing needs you here.'}
          </p>
        </div>
      ) : (
        <div className="manager-cards">
          {active.map((card) => (
            <ResumeCard
              key={card.topicId}
              card={card}
              now={now}
              onResume={onResume}
              onSetNextAction={onSetNextAction}
              onPark={handlePark}
            />
          ))}
        </div>
      )}

      {parked.length > 0 && (
        <section className="manager-shelf">
          <button
            className="manager-shelf-toggle"
            aria-expanded={shelfOpen}
            onClick={() => setShelfOpen((o) => !o)}
          >
            <ChevronRight size={12} className={`manager-shelf-chevron${shelfOpen ? ' open' : ''}`} />
            <PauseCircle size={13} />
            <span>parked · {parked.length}</span>
          </button>
          {shelfOpen && (
            <ul className="manager-parked-list">
              {parked.map((card) => (
                <li key={card.topicId} className="manager-parked">
                  <div className="manager-parked-main">
                    <button className="manager-parked-name" onClick={() => onResume(card.topicId)}>
                      {card.name}
                    </button>
                    <p className="manager-parked-note">
                      {card.parkedNote || 'no note'}
                    </p>
                  </div>
                  <button className="btn-small" onClick={() => onUnpark(card.topicId)}>
                    <PlayCircle size={12} /> unpark
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

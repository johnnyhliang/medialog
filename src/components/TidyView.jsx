import { useEffect, useMemo, useState } from 'react'
import { updateEntry, softDeleteEntry, snoozeEntry } from '../lib/db/entries.js'
import { Sparkles } from 'lucide-react'

// Drift-mode maintenance: a finite, one-card-at-a-time queue of entries that
// need a decision — old inbox items and stale backlog. Every action advances
// the queue; the empty state is the reward.

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

function daysAgo(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

async function fetchTidyQueue(supabase, inboxTopicId) {
  const inboxCutoff = new Date(Date.now() - FOURTEEN_DAYS).toISOString()
  const staleCutoff = new Date(Date.now() - THIRTY_DAYS).toISOString()

  const [oldInboxRes, staleRes] = await Promise.all([
    inboxTopicId
      ? supabase
          .from('entries')
          .select('*, topics(name)')
          .eq('topic_id', inboxTopicId)
          .lt('created_at', inboxCutoff)
          .neq('status', 'done')
          .is('deleted_at', null)
          .order('created_at', { ascending: true })
          .limit(30)
      : Promise.resolve({ data: [] }),
    supabase
      .from('entries')
      .select('*, topics(name)')
      .eq('status', 'backlog')
      .lt('updated_at', staleCutoff)
      .is('deleted_at', null)
      .order('updated_at', { ascending: true })
      .limit(30),
  ])

  const seen = new Set()
  const queue = []
  for (const e of oldInboxRes.data ?? []) {
    seen.add(e.id)
    queue.push({ ...e, tidyReason: `in inbox ${daysAgo(e.created_at)}d` })
  }
  for (const e of staleRes.data ?? []) {
    if (seen.has(e.id) || e.topic_id === inboxTopicId) continue
    queue.push({ ...e, tidyReason: `untouched ${daysAgo(e.updated_at)}d` })
  }
  return queue
}

export default function TidyView({ supabase, topics, inboxTopicId, onOpenEntry, addToast }) {
  const [queue, setQueue] = useState(null)
  const [index, setIndex] = useState(0)
  const [doneCount, setDoneCount] = useState(0)
  const [moveTopicId, setMoveTopicId] = useState('')

  const nonInbox = useMemo(
    () => topics.filter((t) => t.name !== 'Inbox' && !t.archived_at),
    [topics],
  )

  useEffect(() => {
    fetchTidyQueue(supabase, inboxTopicId).then(setQueue).catch(() => setQueue([]))
  }, [supabase, inboxTopicId])

  const current = queue?.[index] ?? null
  const total = queue?.length ?? 0

  function advance() {
    setMoveTopicId('')
    setDoneCount((c) => c + 1)
    setIndex((i) => i + 1)
  }

  async function act(fn, failMsg) {
    const entry = current
    try {
      await fn(entry)
      advance()
    } catch {
      addToast?.(failMsg, 'error')
    }
  }

  const handleMove = () => moveTopicId &&
    act((e) => updateEntry(supabase, e.id, { topic_id: moveTopicId }), 'Failed to move entry')
  const handleDone = () =>
    act((e) => updateEntry(supabase, e.id, { status: 'done' }), 'Failed to mark done')
  const handleSnooze = () =>
    act((e) => snoozeEntry(supabase, e.id, new Date(Date.now() + THIRTY_DAYS).toISOString()), 'Failed to snooze')
  const handleTrash = () =>
    act((e) => softDeleteEntry(supabase, e.id), 'Failed to trash entry')
  const handleKeep = () => { setMoveTopicId(''); setIndex((i) => i + 1) }

  if (queue === null) {
    return <div className="tidy-view"><p className="muted">loading…</p></div>
  }

  if (!current) {
    return (
      <div className="tidy-view">
        <div className="tidy-done">
          <Sparkles size={28} />
          <h2>all tidy</h2>
          <p className="muted">
            {doneCount > 0
              ? `${doneCount} decision${doneCount === 1 ? '' : 's'} made. Nothing else needs you.`
              : 'Nothing needs a decision right now.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="tidy-view">
      <div className="tidy-progress">
        <span>{index + 1} of {total}</span>
        <div className="tidy-progress-bar">
          <div className="tidy-progress-fill" style={{ width: `${(index / total) * 100}%` }} />
        </div>
      </div>

      <div className="tidy-card">
        <span className="tidy-reason">{current.tidyReason}</span>
        <button
          className="tidy-card-title"
          onClick={() => onOpenEntry?.(current)}
          title="Open entry"
        >
          {current.title || current.url || 'Untitled note'}
        </button>
        {current.url && (
          <a className="tidy-card-url" href={current.url} target="_blank" rel="noopener noreferrer">
            {(() => { try { return new URL(current.url).hostname.replace(/^www\./, '') } catch { return current.url } })()} ↗
          </a>
        )}
        {current.note && <p className="tidy-card-note">{current.note}</p>}
        {current.topics?.name && current.topics.name !== 'Inbox' && (
          <span className="tidy-card-topic">{current.topics.name}</span>
        )}

        <div className="tidy-actions">
          <div className="tidy-move">
            <select value={moveTopicId} onChange={(e) => setMoveTopicId(e.target.value)}>
              <option value="">move to topic…</option>
              {nonInbox.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={handleMove} disabled={!moveTopicId}>move</button>
          </div>
          <button onClick={handleDone}>done reading</button>
          <button onClick={handleSnooze}>snooze 30d</button>
          <button className="tidy-trash" onClick={handleTrash}>trash</button>
          <button className="tidy-skip" onClick={handleKeep}>skip</button>
        </div>
      </div>
    </div>
  )
}

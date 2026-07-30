// One-card "what's next" for the Gains Feed (Quant/Dev/Interview), plus a
// short "other takes" list pulled from the existing feed relevance ranking.
// See docs/gains-feed-design.md. Deliberately no forced entries for small
// Quant reps — pulling/completing a menu item just updates its own row;
// Dev/Interview picks link out to the existing flows that already write
// takeaways/problems as entries.

import { useEffect, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { listMenuItems, markMenuItemPulled, setMenuItemStatus } from '../lib/db/gains.js'
import { listDeepTopics, getDeepTopic } from '../lib/db/deepTopics.js'
import { listInterview } from '../lib/db/interview.js'
import { suggestNext as suggestInterview } from '../lib/interviewPlan.js'
import { suggestNext, FLOOR_ITEMS } from '../lib/gainsPicker.js'

const TRACK_LABEL = { quant: 'Quant', dev: 'Dev', interview: 'Interview' }

export default function GainsCard({ supabase, onOpenDeepTopic, onOpenPatternTopic, recommended = [] }) {
  const [loading, setLoading] = useState(true)
  const [pick, setPick] = useState(null) // suggestNext() result, or 'floor' string track
  const [floorTrack, setFloorTrack] = useState(null)
  const [context, setContext] = useState(null) // raw data kept around for "pull another"
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [menuItems, deepTopics, { patterns, problemsByTopic }] = await Promise.all([
        listMenuItems(supabase),
        listDeepTopics(supabase),
        listInterview(supabase),
      ])

      // Dev: the next todo section of whichever deep topic has a cursor set
      // (treated as "active" — same convention as the self-study one-active rule).
      let devNextSection = null
      let devTopic = null
      for (const t of deepTopics) {
        if (!t.cursor_section_id) continue
        const full = await getDeepTopic(supabase, t.id)
        const cursorIdx = full.sections.findIndex((s) => s.id === t.cursor_section_id)
        const next = full.sections[cursorIdx]?.status !== 'done'
          ? full.sections[cursorIdx]
          : full.sections[cursorIdx + 1]
        if (next) { devNextSection = next; devTopic = t; break }
      }

      const interviewSet = suggestInterview({ patterns, problemsByTopic, size: 1 })
      const interviewNext = interviewSet[0] ?? null

      const next = suggestNext({
        menuItems,
        devNextSection,
        interviewNext,
        now: Date.now(),
      })

      setContext({ menuItems, devTopic, patterns, problemsByTopic })
      setPick(next)
      setFloorTrack(null)
    } catch {
      setPick(null)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [supabase])

  async function handleDone() {
    if (!pick) return
    setBusy(true)
    try {
      if (pick.track === 'quant') {
        await setMenuItemStatus(supabase, pick.item.id, 'done')
      }
      // Dev/Interview completion happens in their own views (writing a
      // takeaway / solving a problem) — this card only points there.
      await load()
    } finally { setBusy(false) }
  }

  async function handlePullAnother() {
    if (pick?.track === 'quant') {
      try { await markMenuItemPulled(supabase, pick.item.id) } catch {}
    }
    await load()
  }

  function handleOpen() {
    if (pick?.track === 'dev' && context?.devTopic) onOpenDeepTopic?.(context.devTopic.id)
    if (pick?.track === 'interview' && pick.item?.patternId) onOpenPatternTopic?.(pick.item.patternId)
  }

  if (loading) return null

  const showFloor = !pick || floorTrack
  const floorLabel = floorTrack || 'quant'

  return (
    <div className="gains-card">
      <div className="gains-card-head">
        <span className="gains-card-eyebrow">today's pull</span>
        {!showFloor && (
          <button className="gains-floor-toggle" onClick={() => setFloorTrack(pick.track)}>
            rough day? floor instead
          </button>
        )}
      </div>

      {showFloor ? (
        <div className="gains-floor">
          <p className="gains-floor-text">{FLOOR_ITEMS[floorLabel]}</p>
          {pick && <button className="gains-back" onClick={() => setFloorTrack(null)}>back to today's pull</button>}
        </div>
      ) : (
        <div className="gains-pick">
          <span className="gains-track-tag">{TRACK_LABEL[pick.track]}{pick.tier === 'review' ? ' · review' : ''}</span>
          <p className="gains-pick-title">
            {pick.track === 'quant' && pick.item.title}
            {pick.track === 'dev' && (context?.devTopic?.name ? `${context.devTopic.name} — ${pick.item.title}` : pick.item.title)}
            {pick.track === 'interview' && pick.item.problem?.title}
          </p>
          <div className="gains-pick-actions">
            {pick.track === 'quant' ? (
              <button onClick={handleDone} disabled={busy}>done</button>
            ) : (
              <button onClick={handleOpen}>open <ExternalLink size={12} /></button>
            )}
            <button className="gains-pull-another" onClick={handlePullAnother}>
              <RefreshCw size={12} /> pull another
            </button>
          </div>
        </div>
      )}

      {recommended.length > 0 && (
        <div className="gains-recommended">
          <span className="gains-card-eyebrow">other takes</span>
          {recommended.slice(0, 3).map((it) => (
            <a key={it.id} className="gains-rec-item" href={it.url} target="_blank" rel="noreferrer">
              {it.title}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

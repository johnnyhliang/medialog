// One-card "what's next" for the Gains Feed (Quant/Dev/Interview), plus a
// short "other takes" list pulled from the existing feed relevance ranking.
// See docs/gains-feed-design.md. Deliberately no forced entries for small
// Quant reps — pulling/completing a menu item just updates its own row;
// Dev/Interview picks link out to the existing flows — the topic's master doc
// and the interview pattern topics.

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { listMenuItems, markMenuItemPulled, setMenuItemStatus, seedStarterMenu } from '../lib/db/gains.js'
import { listTopics } from '../lib/db/topics.js'
import { parseGoal } from '../lib/goals.js'
import { listInterview, patternReadiness } from '../lib/db/interview.js'
import { suggestNext as suggestInterview } from '../lib/interviewPlan.js'
import { suggestNext } from '../lib/gainsPicker.js'
import { GAINS_STARTER_MENU } from '../lib/gainsStarterMenu.js'
import { tokenize, sortByRelevance } from '../lib/feedRelevance.js'

const TRACK_LABEL = { quant: 'Quant', dev: 'Dev', interview: 'Interview' }

// The dead-day floor, verbatim from gains-system.md's guardrails, but with
// real context/links attached instead of bare text — "Harris" and "Zetamac"
// mean nothing on their own. Harris has no URL on file anywhere in the app
// (never fabricate one), so it stays plain text with an explanation instead.
const ZETAMAC_URL = 'https://zetamac.com'

function pickTitle(pick, context) {
  if (!pick) return null
  if (pick.track === 'quant') return pick.item.title
  if (pick.track === 'dev') return `${context?.devTopic?.name ?? ''} ${pick.item.title}`
  if (pick.track === 'interview') return pick.item.problem?.title
  return null
}

export default function GainsCard({ supabase, onOpenTopic, onOpenPatternTopic, feedItems = [], interestProfile = new Set() }) {
  const [loading, setLoading] = useState(true)
  const [pick, setPick] = useState(null) // suggestNext() result, or 'floor' string track
  const [floorTrack, setFloorTrack] = useState(null)
  const [context, setContext] = useState(null) // raw data kept around for "pull another"
  const [busy, setBusy] = useState(false)
  const [seedBusy, setSeedBusy] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [menuItems, topics, { patterns, problemsByTopic }] = await Promise.all([
        listMenuItems(supabase),
        listTopics(supabase),
        listInterview(supabase),
      ])

      // Dev: the first unchecked step of whichever topic's master doc is most
      // recently active. Checkboxes in `topics.master_doc` are the plan
      // primitive (docs/manager-scope.md §2) that replaced deep-topic sections.
      // Step counts are kept alongside so the pick can show "step N of M" — a
      // literal position, not a percentage/pace, so it doesn't reintroduce the
      // behind-indicator the design spec explicitly rules out. No extra DB
      // round-trip: listTopics selects '*', so master_doc is already loaded.
      let devNextSection = null
      let devTopic = null
      let devSectionIndex = null
      let devSectionCount = null
      const withSteps = topics
        .map((t) => ({ topic: t, goal: parseGoal(t.master_doc) }))
        .filter(({ goal }) => goal.steps.some((step) => !step.checked))
        .sort((a, b) => new Date(b.topic.updated_at ?? 0) - new Date(a.topic.updated_at ?? 0))
      const active = withSteps[0]
      if (active) {
        const idx = active.goal.steps.findIndex((step) => !step.checked)
        devNextSection = {
          title: active.goal.steps[idx].text,
          topicId: active.topic.id,
          index: idx,
          total: active.goal.total,
        }
        devTopic = active.topic
        devSectionIndex = idx
        devSectionCount = active.goal.total
      }

      const interviewSet = suggestInterview({ patterns, problemsByTopic, size: 1 })
      const interviewNext = interviewSet[0] ?? null

      // For the floor bypass: a real, already-known problem link (not the
      // scored pick) so "read one NeetCode solution" points somewhere real.
      const floorInterviewProblem = patterns
        .flatMap((p) => problemsByTopic[p.id] ?? [])
        .find((p) => p.url) ?? null

      const next = suggestNext({
        menuItems,
        devNextSection,
        interviewNext,
        now: Date.now(),
      })

      setContext({
        menuItems, devTopic, devSectionIndex, devSectionCount, devNextSection,
        patterns, problemsByTopic, floorInterviewProblem,
      })
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
      // Dev/Interview completion happens in their own views (ticking a step in
      // the topic's master doc / solving a problem) — this card only points there.
      await load()
    } finally { setBusy(false) }
  }

  async function handlePullAnother() {
    if (pick?.track === 'quant') {
      try { await markMenuItemPulled(supabase, pick.item.id) } catch {}
    }
    await load()
  }

  async function handleSeedStarterMenu() {
    setSeedBusy(true)
    try { await seedStarterMenu(supabase, GAINS_STARTER_MENU) } finally { setSeedBusy(false) }
    await load()
  }

  function handleOpen() {
    if (pick?.track === 'dev' && context?.devTopic) onOpenTopic?.(context.devTopic.id)
    if (pick?.track === 'interview' && pick.item?.patternId) onOpenPatternTopic?.(pick.item.patternId)
  }

  // "Other takes" shifts with the current pick — a Quant order-book pick
  // nudges toward market-microstructure feed items, a Dev step toward that
  // topic's subject — instead of always showing the same general-interest
  // 3 items regardless of what's on the card. Falls back to the plain interest
  // profile once genuinely nothing is picked (floor state, no data).
  const recommended = useMemo(() => {
    const title = pickTitle(pick, context)
    if (!title) return sortByRelevance(feedItems, interestProfile).slice(0, 3)
    const pickTerms = tokenize(title)
    const augmented = new Set([...interestProfile, ...pickTerms])
    return sortByRelevance(feedItems, augmented).slice(0, 3)
  }, [pick, context, feedItems, interestProfile])

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
          {floorLabel === 'quant' && (
            <p className="gains-floor-text">
              2 min of <a href={ZETAMAC_URL} target="_blank" rel="noreferrer">Zetamac</a> (mental math), or read
              one paragraph of Harris — <em>Trading and Exchanges</em>, your Strand B backbone (no link on file,
              it's the physical/ebook you have).
            </p>
          )}
          {floorLabel === 'dev' && (
            <p className="gains-floor-text">
              {context?.devTopic ? <>
                Read one step of <button className="gains-inline-link" onClick={() => onOpenTopic?.(context.devTopic.id)}>{context.devTopic.name}</button>
                {context.devNextSection?.title ? <> — {context.devNextSection.title}</> : null}.
              </> : <>Read one step of whatever plan is active in the Concept Bank.</>}
            </p>
          )}
          {floorLabel === 'interview' && (
            <p className="gains-floor-text">
              Read (don't solve) one solution{context?.floorInterviewProblem?.url
                ? <> — <a href={context.floorInterviewProblem.url} target="_blank" rel="noreferrer">{context.floorInterviewProblem.title}</a></>
                : ' from NeetCode'}.
            </p>
          )}
          {pick && <button className="gains-back" onClick={() => setFloorTrack(null)}>back to today's pull</button>}
          {!pick && context && context.menuItems.length === 0 && (
            <button className="gains-seed-btn" onClick={handleSeedStarterMenu} disabled={seedBusy}>
              {seedBusy ? 'adding…' : `add starter menu (${GAINS_STARTER_MENU.length} items)`}
            </button>
          )}
        </div>
      ) : (
        <div className="gains-pick">
          <span className="gains-track-tag">{TRACK_LABEL[pick.track]}{pick.tier === 'review' ? ' · review' : ''}</span>
          <p className="gains-pick-title">
            {pick.track === 'quant' && pick.item.title}
            {pick.track === 'dev' && (context?.devTopic?.name ? `${context.devTopic.name} — ${pick.item.title}` : pick.item.title)}
            {pick.track === 'interview' && pick.item.problem?.title}
          </p>
          {/* Progress markers: literal position, never a percentage/pace — see
              docs/gains-feed-design.md's non-goals on why Quant/Dev never get
              a completion stat. Interview already computes real readiness math
              (patternReadiness), which was built but never surfaced here. */}
          {pick.track === 'dev' && context?.devSectionCount != null && (
            <p className="gains-progress">
              step {context.devSectionIndex + 1} of {context.devSectionCount}
            </p>
          )}
          {pick.track === 'quant' && context?.menuItems && (() => {
            const doneCount = context.menuItems.filter((m) => m.track === pick.item.track && m.status === 'done').length
            return <p className="gains-progress">{doneCount} done in this strand</p>
          })()}
          {pick.track === 'interview' && pick.item.patternId && (() => {
            const pattern = context?.patterns?.find((p) => p.id === pick.item.patternId)
            if (!pattern) return null
            const { solved, target } = patternReadiness(pattern, context.problemsByTopic[pattern.id])
            return <p className="gains-progress">{pattern.name} — {solved}/{target} solved</p>
          })()}
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

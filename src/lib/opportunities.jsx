import { shortAge } from './timeFormat.js'

// OpportunityView and OpportunitiesWidget had grown a near-fork: two copies of
// the colour map, the priority map, `interleaved`, the filter predicate, `OppRow`,
// `markRead` and `toggleSaved`. The copies were NOT identical, and the important
// difference was not cosmetic — see `opportunityMutations` below.

// Union of the two copies. The widget knew about the ATS sources (greenhouse /
// lever / ashby) and the view did not, so the view was rendering those rows with
// the grey `slate` fallback chip.
export const SOURCE_COLORS = {
  twitter: 'sky',
  greenhouse: 'green',
  lever: 'green',
  ashby: 'green',
  hn: 'orange',
  github: 'purple',
  manual: 'slate',
  'program-alert': 'amber',
}

// Same union, same reason: unlisted sources sorted to the 9 bucket in the view.
const SOURCE_PRIORITY = {
  'program-alert': 0,
  twitter: 1,
  hn: 2,
  manual: 3,
  lever: 4,
  ashby: 4,
  greenhouse: 4,
  github: 5,
}

/**
 * Round-robin the items across their sources so one noisy scraper can't own the
 * top of the list, with the priority map deciding who goes first in each pass.
 */
export function interleaved(items) {
  const buckets = {}
  for (const item of items) {
    const src = item.source
    if (!buckets[src]) buckets[src] = []
    buckets[src].push(item)
  }
  const sources = Object.keys(buckets).sort((a, b) => (SOURCE_PRIORITY[a] ?? 9) - (SOURCE_PRIORITY[b] ?? 9))
  const result = []
  let added = true
  while (added) {
    added = false
    for (const src of sources) {
      if (buckets[src].length) { result.push(buckets[src].shift()); added = true }
    }
  }
  return result
}

/**
 * One predicate for both pill sets. The widget offers a subset of the view's
 * pills, so some branches are unreachable from it — that is cheaper than keeping
 * two predicates that drifted apart once already (the widget's SWE clause had
 * never picked up `internship`).
 */
export function matchesFilter(item, filter) {
  if (filter === 'Saved') return item.is_saved
  if (filter === 'Unread') return !item.is_read
  if (filter === 'Twitter') return item.source === 'twitter'
  if (filter === 'HN') return item.source === 'hn'
  if (filter === 'SWE') return item.tags?.some((t) => ['swe', 'startup', 'big-tech', 'internship'].includes(t))
  if (filter === 'Quant') return item.tags?.includes('quant')
  if (filter === 'PM') return item.tags?.includes('pm')
  if (filter === 'Fellowship') return item.tags?.some((t) => ['fellowship', 'program', 'program-alert'].includes(t))
  return true
}

/**
 * The shared board plus this user's read/saved flags.
 *
 * `opportunities` rows are global reference data written by the fetch cron;
 * per-user state lives in `opportunity_state` (migration 0044). Anything that
 * reads the board has to merge the two or every row looks unread.
 */
export async function fetchOpportunities(supabase, limit) {
  const { data } = await supabase
    .from('opportunities')
    .select('*')
    .order('posted_at', { ascending: false })
    .limit(limit)
  if (!data) return null

  const { data: state } = await supabase
    .from('opportunity_state')
    .select('opportunity_id, is_read, is_saved')
  const byId = new Map((state ?? []).map((s) => [s.opportunity_id, s]))
  return data.map((i) => ({
    ...i,
    is_read: byId.get(i.id)?.is_read ?? false,
    is_saved: byId.get(i.id)?.is_saved ?? false,
  }))
}

/**
 * Read/saved mutations against the per-user side table.
 *
 * This is where the two copies had genuinely diverged, and the widget's copy was
 * wrong: it wrote `is_read` / `is_saved` back onto the shared `opportunities`
 * row. Migration 0044 moved that state off the shared row precisely because one
 * user marking an item read marked it read for everyone, and made
 * `opportunities` read-only to end users in the same pass — so the widget's
 * writes had since become silent no-ops (it never checked the returned error),
 * and its optimistic local update was thrown away on the next load.
 */
export function opportunityMutations(supabase, items, setItems) {
  // opportunity_state.user_id defaults to auth.uid(); the primary key makes these upserts.
  async function saveState(rows) {
    if (!rows.length) return
    await supabase.from('opportunity_state').upsert(rows, { onConflict: 'user_id,opportunity_id' })
  }

  function stateRow(id, patch) {
    const cur = items.find((i) => i.id === id)
    return {
      opportunity_id: id,
      is_read: cur?.is_read ?? false,
      is_saved: cur?.is_saved ?? false,
      ...patch,
      updated_at: new Date().toISOString(),
    }
  }

  async function markRead(id) {
    const row = stateRow(id, { is_read: true })
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, is_read: true } : i))
    await saveState([row])
  }

  async function markAllRead(scope) {
    const ids = scope.filter((i) => !i.is_read).map((i) => i.id)
    if (!ids.length) return
    const rows = ids.map((id) => stateRow(id, { is_read: true }))
    setItems((prev) => prev.map((i) => ids.includes(i.id) ? { ...i, is_read: true } : i))
    await saveState(rows)
  }

  async function toggleSaved(id, current) {
    const row = stateRow(id, { is_saved: !current })
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, is_saved: !current } : i))
    await saveState([row])
  }

  return { markRead, markAllRead, toggleSaved }
}

/**
 * One row of the board.
 *
 * The age chip is refreshed by the parent's `useCurrentTime` tick rather than by
 * anything here. `shortAge` still reads the clock itself, so this row is not yet
 * literally pure — closing that would mean giving `timeFormat` an injectable
 * `now`, which is a change to a module this cluster does not own.
 */
export function OppRow({ item, onRead, onSave, onTrack }) {
  const chipColor = SOURCE_COLORS[item.source] ?? 'slate'
  const age = item.posted_at ? shortAge(item.posted_at) : ''
  const label = item.company ? `${item.company} — ${item.title}` : item.title

  return (
    <div className={`opp-row ${item.is_read ? 'read' : ''}`}>
      {!item.is_read && <span className="opp-dot" />}
      <span className={`opp-chip opp-chip-${chipColor}`}>{item.source}</span>
      <a
        className="opp-title"
        href={item.url}
        target="_blank"
        rel="noreferrer"
        onClick={() => onRead(item.id)}
      >
        {label}
      </a>
      {item.body && <span className="opp-location">{item.body}</span>}
      <span className="opp-age">{age}</span>
      <button
        className={`opp-save-btn ${item.is_saved ? 'saved' : ''}`}
        onClick={() => onSave(item.id, item.is_saved)}
        title="Save"
      >★</button>
      {onTrack && (
        <button className="opp-track-btn" onClick={() => onTrack(item)} title="Track in Applications">→</button>
      )}
    </div>
  )
}

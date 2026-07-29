// Product event capture. Fire-and-forget, same contract as chunkEntryAsync:
// analytics must never break — or slow — a user action.
//
// ACTIVATION METRIC (decided, drives which events exist at all):
//   primary   — sorted the inbox at least once in week one
//   secondary — captured on two separate days
// SQL for both lives in supabase/queries/activation.sql.
//
// PRIVACY RULE: props carry counts and enums only. Never note text, entry
// titles, URLs, or search queries. MediaLog is a personal knowledge base;
// leaking content into an analytics table betrays the product's premise, and
// mode/count/source answer every question that matters. The rule is enforced
// here (sanitizeProps drops anything off-schema) rather than trusted to call
// sites, and asserted in track.privacy.test.js.

// The complete event surface. Adding a key here is a deliberate act — an event
// not in this table is silently dropped.
export const EVENT_SCHEMA = {
  entry_created: { source: { enum: ['paste', 'capture', 'import', 'bulk'] } },
  inbox_sorted: { count: { count: true } },
  search_run: { mode: { enum: ['semantic', 'keyword'] } },
  digest_opened: {},
  topic_created: {},
}

const FLUSH_MS = 3000
// A bulk import can queue hundreds of events; flush early so a single insert
// never grows unbounded, while still collapsing 200 calls into a couple of
// round trips.
const MAX_BATCH = 100

let buffer = []
let client = null
let timer = null
let listening = false

// Whitelist rather than blacklist: only keys declared in EVENT_SCHEMA survive,
// and each must match its declared shape. Returns null for unknown events.
export function sanitizeProps(name, props) {
  const spec = EVENT_SCHEMA[name]
  if (!spec) return null
  const out = {}
  for (const [key, rule] of Object.entries(spec)) {
    const value = props?.[key]
    if (rule.enum) {
      if (rule.enum.includes(value)) out[key] = value
    } else if (rule.count) {
      const n = Number(value)
      if (Number.isFinite(n) && n >= 0) out[key] = Math.trunc(n)
    }
  }
  return out
}

function schedule() {
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    void flushEvents()
  }, FLUSH_MS)
  // A tab that is closed or backgrounded would otherwise lose its buffer.
  if (!listening && typeof document !== 'undefined' && document.addEventListener) {
    listening = true
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flushEvents()
    })
  }
}

export async function flushEvents() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  const rows = buffer
  const sb = client
  buffer = []
  if (!rows.length || !sb) return
  try {
    // user_id defaults to auth.uid() in the DB, so no getUser round trip.
    await sb.from('events').insert(rows)
  } catch {
    // Dropped events are strictly better than a surfaced error. No retry:
    // retrying a burst is how analytics turns into an outage.
  }
}

export function track(supabase, name, props = {}) {
  try {
    // No-op without a client so tests and the landing page need no mocks.
    if (!supabase) return
    const safe = sanitizeProps(name, props)
    if (!safe) return
    client = supabase
    buffer.push({ name, props: safe })
    if (buffer.length >= MAX_BATCH) {
      void flushEvents()
      return
    }
    schedule()
  } catch {
    // Instrumentation is never allowed to throw into a call site.
  }
}

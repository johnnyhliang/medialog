// The module registry — one row per toggleable surface.
//
// Visibility is the AND of three independent layers (see
// docs/intentional-app-spec.md Part 2, "Resolved 2026-07-29"):
//
//   entitled(tier, module) && enabled(prefs, module) && available(flags, module)
//
// Each layer has a different owner and a different trust level, which is why
// they are three separate concepts here rather than one flag list.
//
// Fields:
//   id        — stable key; persisted in user_configs.modules, so never rename
//   core      — cannot be disabled; the app is unusable without it
//   defaultOn — on for NEW accounts. Existing accounts are grandfathered
//               to everything-on by migration 0057, so this only affects signups.
//   minTier   — minimum entitlement. 'free' for everything a normal user gets.
//
// Tier notes:
// - 'career' (opportunity radar + application tracker) is FREE. It scrapes public
//   GitHub job boards on a shared cron, so it costs nothing per user. Never a
//   paid upsell.
// - 'interview' stays founder-only: personal curriculum, not product surface.
// - 'reels'/'twitter' are parked experiments kept reachable to a founder rather
//   than deleted.

export const GRANDFATHERED_KEY = '__grandfathered'

export const MODULES = [
  // ── core: the capture → sort → resurface spine ──
  { id: 'home',      label: 'Home',        description: 'Your dashboard and topic grid.',            core: true,  defaultOn: true,  minTier: 'free' },
  { id: 'capture',   label: 'Inbox',       description: 'Quick capture and the inbox.',              core: true,  defaultOn: true,  minTier: 'free' },
  { id: 'topics',    label: 'Topics',      description: 'Browse and organize your topics.',          core: true,  defaultOn: true,  minTier: 'free' },
  { id: 'search',    label: 'Search',      description: 'Keyword and semantic search.',              core: true,  defaultOn: true,  minTier: 'free' },
  { id: 'settings',  label: 'Settings',    description: 'Preferences and account.',                  core: true,  defaultOn: true,  minTier: 'free' },

  // ── on by default, but optional ──
  { id: 'digest',    label: 'Digest',      description: 'Periodic recap of what you have been circling.', core: false, defaultOn: true,  minTier: 'free' },

  // ── opt-in power features ──
  { id: 'feed',      label: 'Feed',        description: 'RSS and creator feeds with relevance ranking.',  core: false, defaultOn: false, minTier: 'free' },
  { id: 'reading',   label: 'Reading',     description: 'Books, courses and papers with section cursors.', core: false, defaultOn: false, minTier: 'free' },
  { id: 'highlights',label: 'Highlights',  description: 'Saved highlights across your library.',     core: false, defaultOn: false, minTier: 'free' },
  // Free for everyone: the radar scrapes public GitHub job boards, so it costs
  // nothing per user beyond a shared cron. Interview prep stays founder-only —
  // that one is personal curriculum, not product.
  { id: 'career',    label: 'Opportunities',description: 'Job/fellowship radar from public boards, plus the application tracker.', core: false, defaultOn: false, minTier: 'free' },
  { id: 'revisit',   label: 'Revisit',     description: 'Spaced resurfacing of older entries.',      core: false, defaultOn: false, minTier: 'free' },
  { id: 'archive',   label: 'Archive',     description: 'Archived entries.',                         core: false, defaultOn: false, minTier: 'free' },
  { id: 'files',     label: 'Files',       description: 'Preserved files and snapshots.',            core: false, defaultOn: false, minTier: 'free' },
  { id: 'progress',  label: 'Progress',    description: 'Stats and streaks.',                        core: false, defaultOn: false, minTier: 'free' },
  { id: 'tidy',      label: 'Tidy',        description: 'Batch cleanup of untagged entries.',        core: false, defaultOn: false, minTier: 'free' },
  { id: 'import',    label: 'Import',      description: 'Bulk import and migration tools.',          core: false, defaultOn: false, minTier: 'free' },
  { id: 'widgets',   label: 'Side widgets',description: 'Weather, markets and clock in the side rail.', core: false, defaultOn: false, minTier: 'free' },

  // ── internal / founder-only ──
  // 'assistant' is the natural first paid feature — move it to minTier 'paid'
  // when billing ships. Until then it stays internal rather than free, so the
  // shared AI key isn't exposed to signups before metering lands (task #4).
  { id: 'assistant', label: 'Ask your library', description: 'Conversational search over your notes.', core: false, defaultOn: false, minTier: 'founder' },
  { id: 'interview', label: 'Interview',   description: 'Interview readiness tracker.',              core: false, defaultOn: false, minTier: 'founder' },
  { id: 'metrics',   label: 'Metrics',     description: 'Operator analytics dashboard.',             core: false, defaultOn: false, minTier: 'founder' },
  { id: 'uploads',   label: 'File uploads',description: 'Direct file uploads to storage.',           core: false, defaultOn: false, minTier: 'founder' },
  // Kept rather than deleted: the pipeline is parked (cron unscheduled, session
  // cookie never set) but the code and its setup notes stay reachable to a
  // founder. Retiring an experiment shouldn't erase it.
  { id: 'reels',     label: 'Instagram Reels', description: 'Parked experiment — DM reel ingest via session cookie.', core: false, defaultOn: false, minTier: 'founder' },
  { id: 'twitter',   label: 'Twitter token',   description: 'Auth token used by the opportunity radar.', core: false, defaultOn: false, minTier: 'founder' },
]

export const MODULES_BY_ID = new Map(MODULES.map((m) => [m.id, m]))

// Ordered weakest → strongest so a numeric comparison answers "does this tier
// reach that tier".
export const TIER_RANK = { free: 0, paid: 1, founder: 2 }

export function tierReaches(tier, minTier) {
  return (TIER_RANK[tier] ?? 0) >= (TIER_RANK[minTier] ?? 0)
}

// Layer 1 — entitlement. Is the account ALLOWED this module?
export function isEntitled(moduleId, tier) {
  const mod = MODULES_BY_ID.get(moduleId)
  if (!mod) return false
  return tierReaches(tier, mod.minTier)
}

// Layer 2 — preference. Has the user CHOSEN to show it?
// `prefs` is the raw user_configs.modules map. Absent keys fall back to the
// registry default, except on grandfathered accounts (see migration 0057),
// where an absent key means "was visible before modules existed, keep it".
export function isEnabled(moduleId, prefs) {
  const mod = MODULES_BY_ID.get(moduleId)
  if (!mod) return false
  if (mod.core) return true

  const map = prefs && typeof prefs === 'object' ? prefs : {}
  if (Object.prototype.hasOwnProperty.call(map, moduleId)) return Boolean(map[moduleId])
  if (map[GRANDFATHERED_KEY]) return true
  return mod.defaultOn
}

// Layer 3 — availability. An ops-level override, flipped in the DB without a
// frontend rebuild. `founderFeaturesPublic` opens the founder-only modules to
// everyone; it exists so internal surfaces can be demoed live. Migration 0057
// turns it off, which is the intended resting state.
export function isAvailable(moduleId, flags) {
  const mod = MODULES_BY_ID.get(moduleId)
  if (!mod) return false
  return mod.minTier === 'founder' && Boolean(flags?.founderFeaturesPublic)
}

// Composed check. `isDev` is a local-development override and is deliberately
// separate from tier — it must never be reachable in a production build.
export function isModuleVisible(moduleId, { tier = 'free', prefs = null, isDev = false, flags = null } = {}) {
  if (!MODULES_BY_ID.has(moduleId)) return false
  if (isDev) return isEnabled(moduleId, prefs)
  const allowed = isEntitled(moduleId, tier) || isAvailable(moduleId, flags)
  return allowed && isEnabled(moduleId, prefs)
}

// Modules to render in Settings. Entitlement-blocked ones are returned with
// `locked: true` rather than filtered out — a free user seeing a locked paid
// module converts better than one who never learns it exists, and it keeps the
// registry a single list instead of diverging per tier.
export function listModulesForSettings({ tier = 'free', prefs = null } = {}) {
  return MODULES.filter((m) => m.minTier !== 'founder' || tierReaches(tier, 'founder'))
    .map((m) => ({
      ...m,
      enabled: isEnabled(m.id, prefs),
      locked: !isEntitled(m.id, tier),
    }))
}

// Dev override and the legacy founder-identity check.
//
// Feature gating no longer lives here — it moved to the three-layer model in
// src/lib/modules.js (entitlement × preference × availability). What remains:
//
// - isDev: local dev shows gated tools for testing. Deliberately separate from
//   tier so it can never be reachable in a production build.
// - isFounder / VITE_FOUNDER_IDS: the pre-tier identity check. Still the SOURCE
//   for tier — migration 0057 derives user_entitlements.tier from
//   user_configs.is_founder — but it is no longer consulted for visibility.
//
// showFounderFeatures() was removed: App.jsx now derives founder status from
// tier, and the app_flags.founder_features_public switch it wrapped is read as
// the availability layer in modules.js instead.

const FOUNDER_IDS = (import.meta.env.VITE_FOUNDER_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

export const isDev = import.meta.env.DEV

export function isFounder(user) {
  return Boolean(user && (user.is_founder || FOUNDER_IDS.includes(user.id)))
}

// TODO: fold into the 'uploads' module (minTier 'founder'). NoteEditor resolves
// this on its own with a getUser() call rather than receiving tier from App, so
// migrating it means threading entitlement down or reading it locally. Uploads
// stay backend-enforced by Storage RLS either way, so this is tidiness, not a
// hole. Tracked in docs/tech-debt.md.
export function showFounderUploads(user) {
  return isDev || isFounder(user)
}

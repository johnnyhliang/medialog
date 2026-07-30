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
// Both former gate helpers are gone. showFounderFeatures() -> App.jsx derives
// founder status from tier, and app_flags.founder_features_public is read as the
// availability layer in modules.js. showFounderUploads() -> the 'uploads' module
// (minTier 'founder'), resolved via hooks/useModuleAccess.js.
//
// isFounder is currently used only as the tier source in migration 0057. If that
// ever moves fully server-side, this file reduces to the isDev export.

const FOUNDER_IDS = (import.meta.env.VITE_FOUNDER_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

export const isDev = import.meta.env.DEV

export function isFounder(user) {
  return Boolean(user && (user.is_founder || FOUNDER_IDS.includes(user.id)))
}

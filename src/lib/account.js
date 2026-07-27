import { DEFAULT_FEATURE_FLAGS } from './featureFlags.js'

// Founder / dev gating.
//
// Switches:
// - app_flags.founder_features_public: runtime public rollout flag. Defaults on,
//   and can be turned off from Supabase without a frontend rebuild.
// - VITE_FOUNDER_FEATURES_PUBLIC=false: build-time fallback/off switch.
// - VITE_FOUNDER_IDS: comma-separated auth user ids that retain founder access.
// - import.meta.env.DEV: local dev always shows gated tools for testing.

const FOUNDER_IDS = (import.meta.env.VITE_FOUNDER_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

export const isDev = import.meta.env.DEV

export function isFounder(user) {
  return Boolean(user && (user.is_founder || FOUNDER_IDS.includes(user.id)))
}

// Public-facing experimental surfaces: Career and Ask-your-library. They can be
// turned off globally if signups or backend usage spike.
export function showFounderFeatures(user, flags = DEFAULT_FEATURE_FLAGS) {
  return isDev || Boolean(flags.founderFeaturesPublic) || isFounder(user)
}

// File uploads are still backend-enforced by Storage RLS, so only founder/dev
// should see them until that policy is intentionally changed.
export function showFounderUploads(user) {
  return isDev || isFounder(user)
}

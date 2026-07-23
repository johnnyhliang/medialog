// Founder / dev gating for features that aren't multi-tenant yet.
//
// Some surfaces are wired to a single account server-side — the `capture` and
// `fetch-reels` edge functions write to CAPTURE_USER_ID, so the job/career
// pipeline only does something useful for the founder. Rather than show a
// button that silently does nothing for everyone else, gate those views.
//
// Two independent switches:
//   - VITE_FOUNDER_IDS: comma-separated auth user ids that get founder features
//     in production. Set it in .env.local AND in the Vercel dashboard.
//   - import.meta.env.DEV: true under `npm run dev`, false in a prod build — so
//     running locally always shows founder features without needing your id.

const FOUNDER_IDS = (import.meta.env.VITE_FOUNDER_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// True when running the local dev server (`npm run dev`); false in the built
// site. Lets you see and test gated features locally regardless of account.
export const isDev = import.meta.env.DEV

export function isFounder(user) {
  return Boolean(user && FOUNDER_IDS.includes(user.id))
}

// The gate the UI actually checks: a founder account, OR local dev.
export function showFounderFeatures(user) {
  return isDev || isFounder(user)
}

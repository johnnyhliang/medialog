#!/usr/bin/env node
// Test harness for entitlements: set an account's tier by hand so paid surfaces
// can be exercised without a payment provider.
//
// This is what makes "build billing but leave it off" workable — the paid UI is
// testable today, and turning real billing on later doesn't change how tier is
// consumed anywhere in the app.
//
//   node scripts/set-tier.js <email> free|paid|founder
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (service role, because
// user_entitlements is deliberately not client-writable).

import { createClient } from '@supabase/supabase-js'

const VALID = new Set(['free', 'paid', 'founder'])

function requireEnv(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing ${name}. Export it or prefix the command.`)
    process.exit(1)
  }
  return v
}

const [email, tier] = process.argv.slice(2)

if (!email || !VALID.has(tier)) {
  console.error('Usage: node scripts/set-tier.js <email> free|paid|founder')
  process.exit(1)
}

const supabase = createClient(
  requireEnv('SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false } }
)

// listUsers rather than a filtered query: auth.users isn't reachable through the
// normal table API, and this harness only ever runs against small accounts.
const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
if (error) {
  console.error('Could not list users:', error.message)
  process.exit(1)
}

const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
if (!user) {
  console.error(`No user with email ${email}`)
  process.exit(1)
}

const { error: rpcErr } = await supabase.rpc('set_tier_manual', {
  p_user_id: user.id,
  p_tier: tier,
})
if (rpcErr) {
  console.error('Failed to set tier:', rpcErr.message)
  process.exit(1)
}

console.log(`${email} → ${tier}`)
console.log('Reload the app; tier is resolved per session on sign-in.')

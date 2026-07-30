// One-off backfill of Quant's Strand A/B/C menu items for a specific account,
// via service role. The normal onboarding path for a new account is the
// "add starter menu" button in GainsCard (authenticated client, no script
// needed) — this script exists for backfilling accounts that predate that
// button. Idempotent: skips a track if it already has rows.
//
// Usage: SUPABASE_SERVICE_ROLE_KEY=<service role key> CAPTURE_USER_ID=<uuid> node scripts/seed-gains-menu.js

import { createClient } from '@supabase/supabase-js'
import { STRAND_A, STRAND_B, STRAND_C } from '../src/lib/gainsStarterMenu.js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://bhxqgpgyxqnqvnqjvrrj.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const USER_ID = process.env.CAPTURE_USER_ID

if (!SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var (Supabase Dashboard -> Settings -> API -> service_role).')
  process.exit(1)
}
if (!USER_ID) {
  console.error('Set CAPTURE_USER_ID to the target user id')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function seedTrack(track, items) {
  const { count, error: countError } = await supabase
    .from('menu_items')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', USER_ID)
    .eq('track', track)
  if (countError) throw new Error(countError.message)
  if (count > 0) {
    console.log(`${track}: already has ${count} rows, skipping`)
    return
  }
  const rows = items.map((item) => ({ ...item, user_id: USER_ID }))
  const { error } = await supabase.from('menu_items').insert(rows)
  if (error) throw new Error(error.message)
  console.log(`${track}: seeded ${rows.length} items`)
}

await seedTrack('quant-build', STRAND_A)
await seedTrack('quant-read', STRAND_B)
await seedTrack('quant-mental', STRAND_C)

// One-time seed of Quant's Strand A/B/C menu items from gains-system.md into
// menu_items. Idempotent: skips a track if it already has rows.
//
// Usage: SUPABASE_SERVICE_ROLE_KEY=<service role key> node scripts/seed-gains-menu.js

import { createClient } from '@supabase/supabase-js'

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

// Strand A is sequential (build rungs); position encodes order.
const strandA = [
  'Print the book (bids/asks) after each order',
  'Give orders a size; handle partial fills',
  'Let one aggressive order sweep multiple price levels',
  'Add order cancellation',
  'Enforce real price-time priority (FIFO within each price)',
  'Add a market order type (vs limit)',
  'Track & print the spread and mid price',
  'Log every trade; compute VWAP of the tape',
  'Naive market maker: quote bid = mid-1, ask = mid+1',
  'Drive with a random-walk true price; track P&L + inventory',
  'Add an informed trader; watch the MM get adversely selected',
  'Add inventory skew: widen/shift quotes as inventory grows',
  'Profile it; find the bottleneck',
  'Swap the sorted-list book for heaps / better structures',
].map((title, i) => ({ track: 'quant-build', title, position: i }))

// Strand B/C are menus, not sequences — no position ordering.
const strandB = [
  'Limit order book & price-time priority',
  'Market vs limit orders — who supplies vs demands liquidity',
  'The bid-ask spread — what sets its width',
  'Adverse selection (tie it to the MM bot bleeding money)',
  'Inventory risk',
  "Who's on the other side: market makers vs hedgers vs speculators vs retail",
  'One order type per rep: IOC, FOK, stop...',
  '"Providing liquidity" — what it actually earns and why',
  'Futures basics; contango vs backwardation',
  'Options: calls/puts, then one Greek per rep',
  'Implied vs realized volatility',
  'Read one Jane Street / Optiver blog post -> 2-sentence takeaway',
  "Read the intro of Budish's batch-auction paper -> one-line take",
].map((title) => ({ track: 'quant-read', title, position: null }))

const strandC = [
  '2 min Zetamac (mental math)',
  'One EV/probability puzzle from the green book',
  '"Make a market" solo game: estimate, quote, check how wrong you were',
].map((title) => ({ track: 'quant-mental', title, position: null }))

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

await seedTrack('quant-build', strandA)
await seedTrack('quant-read', strandB)
await seedTrack('quant-mental', strandC)

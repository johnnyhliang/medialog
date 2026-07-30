// Shared source list for Quant's Strand A/B/C menu items — the same content
// used by scripts/seed-gains-menu.js (service-role, one-time backfill) and the
// in-app "add starter menu" button in GainsCard (authenticated client, the
// actual onboarding path for a new account). See docs/gains-feed-design.md.

// Strand A is sequential (build rungs); position encodes order.
export const STRAND_A = [
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
export const STRAND_B = [
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

export const STRAND_C = [
  '2 min Zetamac (mental math)',
  'One EV/probability puzzle from the green book',
  '"Make a market" solo game: estimate, quote, check how wrong you were',
].map((title) => ({ track: 'quant-mental', title, position: null }))

export const GAINS_STARTER_MENU = [...STRAND_A, ...STRAND_B, ...STRAND_C]

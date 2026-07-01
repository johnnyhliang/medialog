import { vi } from 'vitest'

// Shared fake Supabase client for db-layer unit tests. Every query-builder
// method returns a thenable that is ALSO the chain, so tests can `await` at any
// point in the chain (`.order()`, `.eq()`, `.single()`, …) and get `result`.
// Superset of the per-file mockClient helpers it replaces.
export function mockSupabase(result) {
  const chain = {}
  const thenable = () => Object.assign(Promise.resolve(result), chain)
  for (const m of [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'or', 'is', 'not', 'in', 'gt', 'lt', 'gte', 'lte',
    'order', 'limit', 'range', 'match', 'filter', 'contains',
  ]) {
    chain[m] = vi.fn(thenable)
  }
  chain.single = vi.fn(() => Promise.resolve(result))
  chain.maybeSingle = vi.fn(() => Promise.resolve(result))
  return { from: vi.fn(() => chain), _chain: chain }
}

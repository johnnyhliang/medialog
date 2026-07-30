import { describe, test, expect, vi } from 'vitest'
import {
  estimateCost, approxTokens, rateFor, recordUsage,
} from '../../../../supabase/functions/_shared/meter.ts'

describe('estimateCost', () => {
  test('prices a known model from the rate table', () => {
    // 1M in + 1M out at 0.59 / 0.79
    expect(estimateCost('llama-3.3-70b-versatile', 1_000_000, 1_000_000)).toBeCloseTo(1.38, 6)
  })

  test('embedding models have no output cost', () => {
    expect(estimateCost('gemini-embedding-001', 1_000_000, 0)).toBeCloseTo(0.15, 6)
    expect(estimateCost('gemini-embedding-001', 0, 1_000_000)).toBe(0)
  })

  test('matches on substring, so provider prefixes still price correctly', () => {
    // OpenRouter-style ids carry a vendor prefix and a :free suffix.
    expect(rateFor('meta-llama/llama-3.3-70b-instruct:free')).toEqual(rateFor('llama-3.3-70b-instruct'))
  })

  // An unknown model must not look free — that would hide real spend at exactly
  // the moment someone swaps in a paid model without updating the table.
  test('an unrecognised model falls back to a non-zero rate', () => {
    const cost = estimateCost('some-new-model-v9', 1_000_000, 0)
    expect(cost).toBeGreaterThan(0)
  })

  test('negative or missing token counts cannot produce negative cost', () => {
    expect(estimateCost('llama-3.3-70b-versatile', -500, -500)).toBe(0)
    expect(estimateCost('', 0, 0)).toBe(0)
  })

  test('rounds to the 6dp the ai_usage column stores', () => {
    const c = estimateCost('llama-3.3-70b-versatile', 1, 1)
    expect(String(c).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(6)
  })
})

describe('approxTokens', () => {
  test('approximates ~4 chars per token', () => {
    expect(approxTokens('a'.repeat(400))).toBe(100)
  })

  test('handles empty and nullish input', () => {
    expect(approxTokens('')).toBe(0)
    expect(approxTokens(undefined)).toBe(0)
  })
})

describe('recordUsage', () => {
  test('calls the RPC with computed cost', async () => {
    const admin = { rpc: vi.fn().mockResolvedValue({ error: null }) }
    await recordUsage(admin, {
      userId: 'u1', fn: 'ai', model: 'llama-3.3-70b-versatile',
      inputTokens: 1000, outputTokens: 500,
    })
    expect(admin.rpc).toHaveBeenCalledWith('record_ai_usage', expect.objectContaining({
      p_user_id: 'u1', p_function: 'ai', p_input_tokens: 1000, p_output_tokens: 500,
    }))
    expect(admin.rpc.mock.calls[0][1].p_cost).toBeGreaterThan(0)
  })

  // THE contract: metering is observability, not correctness. If this test ever
  // fails, a metering outage has become a user-facing outage.
  test('never throws when the RPC rejects', async () => {
    const admin = { rpc: vi.fn().mockRejectedValue(new Error('db down')) }
    await expect(recordUsage(admin, { userId: 'u1', fn: 'ai' })).resolves.toBeUndefined()
  })

  test('never throws when the client is malformed', async () => {
    await expect(recordUsage({}, { userId: 'u1', fn: 'ai' })).resolves.toBeUndefined()
    await expect(recordUsage(null, { userId: 'u1', fn: 'ai' })).resolves.toBeUndefined()
  })

  test('skips silently when there is no user to attribute to', async () => {
    const admin = { rpc: vi.fn() }
    await recordUsage(admin, { userId: '', fn: 'ai' })
    expect(admin.rpc).not.toHaveBeenCalled()
  })

  test('normalises a null model to empty string, matching the unique key', async () => {
    const admin = { rpc: vi.fn().mockResolvedValue({ error: null }) }
    await recordUsage(admin, { userId: 'u1', fn: 'embed-entry', model: null })
    expect(admin.rpc.mock.calls[0][1].p_model).toBe('')
  })
})

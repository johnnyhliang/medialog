// Per-user AI metering, shared by the `ai` and `embed-entry` functions.
//
// Contract that matters most: recordUsage NEVER THROWS. Metering failing must not
// fail a user's request — the same rule chunkEntryAsync follows for indexing. A
// dropped usage row costs an accounting inaccuracy; a thrown error costs the user
// their answer.
//
// Cost estimation lives here rather than in the DB so repricing is one edit and is
// unit-testable with no database. See docs/metering-scope.md.

// USD per 1M tokens. Deliberately a plain table: providers change prices, and a
// table you can read is easier to keep honest than logic you have to trace.
//
// The current provider is a free-tier Llama via OpenRouter/Groq (docs/ai-setup.md),
// so real spend is ~$0 today. These rates exist so the numbers stay meaningful the
// moment a paid model is swapped in — which is exactly when nobody remembers to
// add cost tracking.
type Rate = { in: number; out: number }

const RATES: Record<string, Rate> = {
  'gemini-embedding-001': { in: 0.15, out: 0 },
  'llama-3.3-70b-versatile': { in: 0.59, out: 0.79 },
  'llama-3.3-70b-instruct': { in: 0.59, out: 0.79 },
}

// Unknown models are charged at a deliberately non-zero placeholder. Defaulting to
// zero would make an unrecognised model look free and hide real spend; a visible
// over-estimate prompts someone to add the real rate.
const FALLBACK: Rate = { in: 0.5, out: 1.0 }

export function rateFor(model: string): Rate {
  if (!model) return FALLBACK
  const key = Object.keys(RATES).find((k) => model.includes(k))
  return key ? RATES[key] : FALLBACK
}

/** USD estimate for one call. Pure — no clock, no network, no DB. */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rate = rateFor(model)
  const cost = (Math.max(0, inputTokens) / 1_000_000) * rate.in
    + (Math.max(0, outputTokens) / 1_000_000) * rate.out
  // 6dp matches numeric(12,6) in the ai_usage column; anything finer is noise.
  return Math.round(cost * 1e6) / 1e6
}

/**
 * Gemini's embedContent returns no token counts, so embeddings must be estimated.
 * ~4 chars per token is the usual English approximation. Marked clearly as an
 * estimate wherever it surfaces, so nobody mistakes it for measured.
 */
export function approxTokens(text: string): number {
  return Math.ceil((text?.length ?? 0) / 4)
}

type UsageArgs = {
  userId: string
  fn: string
  model?: string | null
  inputTokens?: number
  outputTokens?: number
}

/**
 * Record one call. Swallows every failure by design — see the file header.
 *
 * @param admin a service-role Supabase client. ai_usage has no write policy, so a
 *              user-scoped client cannot write here, which is the point: a
 *              client-writable usage table is a client-defeatable cap.
 */
export async function recordUsage(
  // deno-lint-ignore no-explicit-any
  admin: any,
  { userId, fn, model = '', inputTokens = 0, outputTokens = 0 }: UsageArgs,
): Promise<void> {
  try {
    if (!userId || !fn) return
    const m = model ?? ''
    await admin.rpc('record_ai_usage', {
      p_user_id: userId,
      p_function: fn,
      p_model: m,
      p_input_tokens: Math.max(0, Math.round(inputTokens)),
      p_output_tokens: Math.max(0, Math.round(outputTokens)),
      p_cost: estimateCost(m, inputTokens, outputTokens),
    })
  } catch {
    // Intentionally silent. Metering is observability, not correctness.
  }
}

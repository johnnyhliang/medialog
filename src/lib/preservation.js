// Article-text preservation markers.
//
// `full_text` being null is ambiguous on its own — it means both "we never tried"
// and "we tried and the page had nothing extractable". The status column
// disambiguates, which is what makes coverage a single query instead of a guess.

export const PRESERVED = 'ok'
export const UNEXTRACTABLE = 'empty'
export const FAILED = 'failed'

/**
 * Build the entry patch recording what preservation produced.
 *
 * @param meta the `enrich` response, or null/undefined when the call itself failed.
 */
export function preservationPatch(meta) {
  const at = new Date().toISOString()
  if (!meta) return { full_text_status: FAILED, full_text_extractor: null, full_text_at: at }

  const text = typeof meta.full_text === 'string' ? meta.full_text.trim() : ''
  if (!text) return { full_text_status: UNEXTRACTABLE, full_text_extractor: null, full_text_at: at }

  return {
    full_text: meta.full_text,
    full_text_status: PRESERVED,
    full_text_extractor: meta.full_text_extractor ?? null,
    full_text_at: at,
  }
}

/**
 * Client-side coverage summary. The authoritative version is the SQL in
 * migration 0060; this mirrors it for already-loaded entries so the UI can show
 * "N of M preserved" without another round trip.
 */
export function preservationCoverage(entries) {
  const urlEntries = (entries ?? []).filter((e) => e?.url && !e?.deleted_at)
  const count = (status) => urlEntries.filter((e) => e.full_text_status === status).length
  const preserved = count(PRESERVED)
  return {
    total: urlEntries.length,
    preserved,
    unextractable: count(UNEXTRACTABLE),
    failed: count(FAILED),
    notAttempted: urlEntries.filter((e) => !e.full_text_status).length,
    pct: urlEntries.length ? Math.round((preserved / urlEntries.length) * 1000) / 10 : 0,
  }
}

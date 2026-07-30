// Per-entry indexing indicator.
//
// Previously the only signal that a note was searchable lived in ExploreView —
// visible after the fact, in one place, only for entries that already came back
// from a search. If indexing failed the note was silently unfindable forever, and
// the natural conclusion is "I guess I never saved that", which is the worst
// possible failure mode for a knowledge base.
//
// Deliberately quiet: renders NOTHING for the healthy case. A badge on every
// indexed note would be noise on the 95% path; only the states you can act on
// earn pixels.

const STATES = {
  ok: null, // healthy — say nothing
  pending: { mark: '◌', label: 'Indexing…', cls: 'pending' },
  failed: { mark: '◇', label: 'Not searchable — indexing failed', cls: 'failed' },
  empty: null, // nothing chunkable; not a problem, so not a warning
  not_attempted: { mark: '◇', label: 'Not yet indexed for semantic search', cls: 'muted' },
}

export default function IndexStatus({ status, showOk = false }) {
  const key = status ?? 'not_attempted'
  const state = STATES[key]

  if (!state) {
    // `showOk` exists for surfaces like Explore where the ◆ is genuinely useful
    // context — "this result came from semantic search".
    if (showOk && key === 'ok') {
      return <span className="index-status is-ok" title="Indexed for semantic search">◆</span>
    }
    return null
  }

  return (
    <span className={`index-status is-${state.cls}`} title={state.label} aria-label={state.label}>
      {state.mark}
    </span>
  )
}

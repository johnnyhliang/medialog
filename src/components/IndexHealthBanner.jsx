import { useEffect, useState } from 'react'
import { listUnindexed, reindexBatch } from '../lib/chunkEntry.js'

// "N notes aren't searchable" + a retry.
//
// This is the loud half of the fire-and-forget contract. Indexing must never
// break a save — so it fails silently — but silence at the point of failure has
// to be paid back with visibility somewhere. Without this, the only way to learn
// a note is missing from search is to search for it and doubt yourself.
//
// Renders nothing when there is nothing wrong, so the healthy path costs no
// attention.

export default function IndexHealthBanner({ supabase, addToast }) {
  const [pending, setPending] = useState([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(null)

  useEffect(() => { check() }, [])

  async function check() {
    try {
      setPending(await listUnindexed(supabase))
    } catch { setPending([]) }
  }

  async function retry() {
    if (running || !pending.length) return
    setRunning(true)
    setProgress({ done: 0, total: pending.length })
    try {
      // Paced deliberately: a retry that fires everything at once would recreate
      // the burst that probably caused the failures.
      await reindexBatch(supabase, pending, {
        ratePerSecond: 3,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      await check()
      addToast?.('Re-indexing finished', 'success')
    } catch (e) {
      addToast?.(e.message, 'error')
    }
    setRunning(false)
    setProgress(null)
  }

  if (!pending.length) return null

  const failed = pending.filter((e) => e.index_status === 'failed').length

  return (
    <div className="index-banner">
      <div>
        <strong>
          {pending.length} note{pending.length === 1 ? '' : 's'} not searchable
        </strong>
        <span className="index-banner-sub">
          {failed > 0
            ? `${failed} failed to index. Semantic search can't find ${failed === 1 ? 'it' : 'them'} until retried.`
            : 'Waiting to be indexed for semantic search.'}
        </span>
      </div>
      <button onClick={retry} disabled={running}>
        {running && progress
          ? `${progress.done} / ${progress.total}…`
          : running ? 'retrying…' : 'retry now'}
      </button>
    </div>
  )
}

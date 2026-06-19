import { useState, useEffect } from 'react'

export function usePendingArchive(selectedId) {
  const [pendingArchiveIds, setPendingArchiveIds] = useState(new Set())

  useEffect(() => {
    setPendingArchiveIds(new Set())
  }, [selectedId])

  function addPending(id) {
    setPendingArchiveIds(prev => new Set([...prev, id]))
  }

  function removePending(id) {
    setPendingArchiveIds(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  return { pendingArchiveIds, addPending, removePending }
}

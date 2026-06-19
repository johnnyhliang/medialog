import { useState } from 'react'

export function useInbox() {
  const [inboxEntries, setInboxEntries] = useState([])

  function applyAssign(id) {
    setInboxEntries(prev => prev.filter(e => e.id !== id))
  }

  function applySortDelete(id) {
    setInboxEntries(prev => prev.filter(e => e.id !== id))
  }

  return { inboxEntries, setInboxEntries, applyAssign, applySortDelete }
}

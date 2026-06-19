import { useState } from 'react'

export function useRevisit() {
  const [revisitEntries, setRevisitEntries] = useState([])
  const [recentActivity, setRecentActivity] = useState([])

  function applySeen(id) {
    setRevisitEntries(prev => prev.filter(e => e.id !== id))
  }

  return { revisitEntries, setRevisitEntries, recentActivity, setRecentActivity, applySeen }
}

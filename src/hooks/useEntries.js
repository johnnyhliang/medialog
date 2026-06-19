import { useState } from 'react'

export function useEntries() {
  const [entries, setEntries] = useState([])
  const [globalSearchResults, setGlobalSearchResults] = useState(null)

  function applyUpdateEntry(id, updated) {
    setEntries(prev => prev.map(e => e.id === id ? { ...updated, tags: e.tags } : e))
  }

  function applyDeleteEntry(id) {
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  function applyMoveEntry(id) {
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  return { entries, setEntries, globalSearchResults, setGlobalSearchResults, applyUpdateEntry, applyDeleteEntry, applyMoveEntry }
}

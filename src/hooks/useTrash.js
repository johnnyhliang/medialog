import { useState } from 'react'

export function useTrash() {
  const [trashEntries, setTrashEntries] = useState([])

  function applyRestore(id) {
    setTrashEntries(prev => prev.filter(e => e.id !== id))
  }

  function applyClear() {
    setTrashEntries([])
  }

  return { trashEntries, setTrashEntries, applyRestore, applyClear }
}

import { useState } from 'react'

export function useVersions() {
  const [historyFor, setHistoryFor] = useState(null)
  const [versions, setVersions] = useState([])

  function openHistory(entryId, versionList) {
    setHistoryFor(entryId)
    setVersions(versionList)
  }

  function closeHistory() {
    setHistoryFor(null)
    setVersions([])
  }

  return { historyFor, versions, openHistory, closeHistory }
}

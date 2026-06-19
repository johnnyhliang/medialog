import { useState } from 'react'

export function useExport() {
  const [exportModal, setExportModal] = useState(null)

  function openExportLoading() {
    setExportModal({ estimatedKB: null, entryCount: null, loading: true })
  }

  function setExportResult(estimatedKB, entryCount) {
    setExportModal({ estimatedKB, entryCount, loading: false })
  }

  function closeExportModal() {
    setExportModal(null)
  }

  return { exportModal, openExportLoading, setExportResult, closeExportModal }
}

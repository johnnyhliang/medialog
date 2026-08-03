import { useState } from 'react'
import { readBoolPref, writePref } from '../lib/localPref.js'

const KEY = 'medialog_archive_toast'

// This was `useState(true)` with no persistence, so turning the archive toast off
// lasted until the next reload and then silently came back. Every sibling toggle
// (trash toast, assistant) was already persisted, which is exactly why the
// inconsistency read as "settings don't save" rather than as one missing write.
export function useArchiveToast() {
  const [archiveToast, setArchiveToastState] = useState(() => readBoolPref(KEY, true))

  function setArchiveToast(val) {
    setArchiveToastState(val)
    writePref(KEY, val)
  }

  return { archiveToast, setArchiveToast }
}

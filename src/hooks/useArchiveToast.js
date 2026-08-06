import { useState } from 'react'
import { readBoolPref, writePref } from '../lib/localPref.js'

const KEY = 'medialog_archive_toast'

// localStorage here is a CACHE, not the record. The database column
// `user_configs.archive_toast` is the source of truth: App.jsx loads it on mount
// and writes it on toggle, and it is carried in backups.
//
// Correction to an earlier note in this file, which claimed the setting "never
// persisted at all" — it did, to the database. What it lacked was a *synchronous*
// initial value, so the first paint always showed the default and then corrected
// itself once the round trip landed. Reading the cached value makes the first
// paint right; the database load immediately after is still authoritative and
// overwrites both the state and this cache if they disagree.
//
// Same two-layer arrangement as `useTheme`, and for the same reason. It is only
// safe because every writer goes through `setArchiveToast`, so the cache cannot
// drift from the state it mirrors.
export function useArchiveToast() {
  const [archiveToast, setArchiveToastState] = useState(() => readBoolPref(KEY, true))

  function setArchiveToast(val) {
    setArchiveToastState(val)
    writePref(KEY, val)
  }

  return { archiveToast, setArchiveToast }
}

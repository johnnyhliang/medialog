import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { readPref, writePref } from '../lib/localPref.js'
import { BROWSER_DEFAULT, isValidTimezone, resolveTimezone } from '../lib/timezone.js'

const STORAGE_KEY = 'medialog_timezone'

// Same two-layer arrangement as `useTheme` and `useArchiveToast`:
// `user_configs.timezone` is the record, localStorage is a CACHE that exists so
// the first paint is right. Without it the clock renders in the browser zone,
// then jumps once the round trip lands — visible, and worse on the agenda,
// where a wrong zone can put a reminder in the wrong bucket for a moment.
//
// It is only safe because every writer goes through `setTimezone`, so the cache
// cannot drift from the state it mirrors.

function readLocal() {
  const raw = readPref(STORAGE_KEY, null)
  if (raw === null) return BROWSER_DEFAULT
  if (raw === BROWSER_DEFAULT || isValidTimezone(raw)) return raw
  return BROWSER_DEFAULT
}

async function syncToDb(pref) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('user_configs')
      // The sentinel is a client-side concept. The column stores NULL for
      // "follow the browser" so the database says what it means, and so a row
      // that has never been touched is indistinguishable from one explicitly
      // set back to the default.
      .update({ timezone: pref === BROWSER_DEFAULT ? null : pref })
      .eq('user_id', user.id)
  } catch { /* a preference write must never break the page */ }
}

export function useTimezone() {
  // `preference` is what the user chose — possibly the BROWSER_DEFAULT
  // sentinel. `timezone` is the resolved IANA name every consumer wants. Two
  // values, because the settings UI needs to show "Browser default" as a
  // distinct choice from explicitly picking the zone you happen to be in.
  const [preference, setPreferenceState] = useState(readLocal)

  useEffect(() => {
    async function syncFromDb() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('user_configs')
          .select('timezone')
          .eq('user_id', user.id)
          .maybeSingle()
        const db = data?.timezone ?? BROWSER_DEFAULT
        const next = db === BROWSER_DEFAULT || isValidTimezone(db) ? db : BROWSER_DEFAULT
        if (next !== readLocal()) {
          writePref(STORAGE_KEY, next)
          setPreferenceState(next)
        }
      } catch { /* fall through to the cached value */ }
    }
    syncFromDb()
  }, [])

  function setTimezone(pref) {
    const next = pref === BROWSER_DEFAULT || isValidTimezone(pref) ? pref : BROWSER_DEFAULT
    setPreferenceState(next)
    writePref(STORAGE_KEY, next)
    syncToDb(next)
  }

  return {
    preference,
    timezone: resolveTimezone(preference),
    isBrowserDefault: preference === BROWSER_DEFAULT,
    setTimezone,
  }
}

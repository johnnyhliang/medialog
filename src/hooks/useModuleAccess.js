import { useEffect, useState } from 'react'
import { isModuleVisible } from '../lib/modules.js'
import { DEFAULT_TIER, loadEntitlement, loadModulePrefs } from '../lib/entitlements.js'
import { isDev } from '../lib/account.js'

// Resolves one module's visibility for components too deep to receive tier from
// App.jsx as a prop. App itself computes this inline (it already holds tier and
// prefs in state); this exists for leaf components like NoteEditor, whose two
// callers would otherwise both need to thread entitlement through.
//
// Starts closed and opens once entitlement resolves, so a slow round-trip never
// briefly exposes a gated control. Same trade the previous getUser()-based check
// made, kept deliberately.
export function useModuleAccess(moduleId, supabase) {
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    Promise.all([loadEntitlement(supabase), loadModulePrefs(supabase)])
      .then(([ent, prefs]) => {
        if (cancelled) return
        setAllowed(isModuleVisible(moduleId, {
          tier: ent?.tier ?? DEFAULT_TIER,
          prefs,
          isDev,
        }))
      })
      .catch(() => { if (!cancelled) setAllowed(false) })
    return () => { cancelled = true }
  }, [moduleId, supabase])

  return allowed
}

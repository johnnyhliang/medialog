import { useEffect, useState } from 'react'
import { listModulesForSettings } from '../lib/modules.js'
import { loadEntitlement, loadModulePrefs, setModulePref } from '../lib/entitlements.js'

// Settings → Modules. Turning a module off hides its nav entry and route; the
// underlying data is untouched and reappears intact when it's turned back on.
export default function ModulesTab({ supabase, addToast }) {
  const [tier, setTier] = useState('free')
  const [prefs, setPrefs] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([loadEntitlement(supabase), loadModulePrefs(supabase)])
      .then(([ent, p]) => {
        if (cancelled) return
        setTier(ent.tier)
        setPrefs(p)
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [supabase])

  async function toggle(mod) {
    if (mod.core || mod.locked) return
    const next = !mod.enabled
    // Optimistic: the toggle is cosmetic, so a failed write costs nothing worse
    // than a stale checkbox until the next load.
    setPrefs((cur) => ({ ...(cur ?? {}), [mod.id]: next }))
    try {
      await setModulePref(supabase, mod.id, next, prefs)
    } catch {
      setPrefs((cur) => ({ ...(cur ?? {}), [mod.id]: !next }))
      addToast?.('Could not save that change')
    }
  }

  if (loading) return <p className="settings-hint">Loading modules…</p>

  const rows = listModulesForSettings({ tier, prefs })

  return (
    <section>
      <p className="settings-hint">
        Turn off what you don’t use — it disappears from the sidebar. Your data stays put and
        comes back untouched if you turn it on again.
      </p>
      <ul className="modules-list">
        {rows.map((mod) => (
          <li key={mod.id} className="modules-row">
            <label className="modules-label">
              <input
                type="checkbox"
                checked={mod.enabled}
                disabled={mod.core || mod.locked}
                onChange={() => toggle(mod)}
                aria-label={mod.label}
              />
              <span>
                <span className="modules-name">
                  {mod.label}
                  {mod.core && <span className="modules-badge">always on</span>}
                  {mod.locked && <span className="modules-badge modules-badge--locked">upgrade</span>}
                </span>
                <span className="modules-desc">{mod.description}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}

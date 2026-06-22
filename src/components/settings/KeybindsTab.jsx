import { useState } from 'react'
import { getCommands } from '../../lib/commands.js'
import { loadOverrides, saveBinding, resetBinding, resetAllBindings, eventToKey } from '../../lib/keybindings.js'

export default function KeybindsTab() {
  const [overrides, setOverrides] = useState(loadOverrides)
  const [capturing, setCapturing] = useState(null)
  const [conflict, setConflict] = useState(null)

  const commands = getCommands({})
  const CATEGORY_ORDER = ['App', 'Navigation', 'Entry']
  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = commands.filter((c) => c.category === cat)
    return acc
  }, {})

  function currentKey(cmd) {
    return overrides[cmd.id] ?? cmd.defaultKey ?? ''
  }

  function startCapture(cmd) {
    setCapturing(cmd.id)
    setConflict(null)
  }

  function handleCaptureKey(e, cmd) {
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape') { setCapturing(null); setConflict(null); return }

    const key = eventToKey(e)
    if (['control', 'meta', 'alt', 'shift'].includes(e.key.toLowerCase())) return

    const conflictCmd = commands.find((c) => c.id !== cmd.id && currentKey(c) === key)
    if (conflictCmd) {
      setConflict({ key, conflictingCmd: conflictCmd, pendingCmd: cmd })
      return
    }

    applyBinding(cmd.id, key)
  }

  function applyBinding(cmdId, key) {
    saveBinding(cmdId, key)
    if (conflict) {
      resetBinding(conflict.conflictingCmd.id)
      setOverrides({ ...loadOverrides() })
      setConflict(null)
    } else {
      setOverrides({ ...loadOverrides() })
    }
    setCapturing(null)
  }

  function handleReset(cmdId) {
    resetBinding(cmdId)
    setOverrides({ ...loadOverrides() })
  }

  function handleResetAll() {
    resetAllBindings()
    setOverrides({})
  }

  return (
    <section>
      <h2>Keybinds</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        Click a keybind to rebind it. Chords are space-separated (e.g. <kbd>g i</kbd>).
      </p>

      {Object.entries(grouped).map(([cat, cmds]) => (
        <div key={cat} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
            {cat}
          </div>
          <div className="keybinds-list">
            {cmds.map((cmd) => {
              const isCapturing = capturing === cmd.id
              const hasOverride = !!overrides[cmd.id]
              const key = currentKey(cmd)
              return (
                <div key={cmd.id} className="keybind-row">
                  <span className="keybind-label">{cmd.label}</span>
                  <div className="keybind-controls">
                    {isCapturing ? (
                      <kbd
                        className="keybind-kbd keybind-kbd--capturing"
                        tabIndex={0}
                        autoFocus
                        onKeyDown={(e) => handleCaptureKey(e, cmd)}
                        onBlur={() => { setCapturing(null); setConflict(null) }}
                      >
                        press key…
                      </kbd>
                    ) : (
                      <kbd
                        className={`keybind-kbd${hasOverride ? ' keybind-kbd--overridden' : ''}`}
                        onClick={() => startCapture(cmd)}
                        title="Click to rebind"
                      >
                        {key || '—'}
                      </kbd>
                    )}
                    {hasOverride && !isCapturing && (
                      <button className="keybind-reset" onClick={() => handleReset(cmd.id)}>
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {conflict && (
        <div className="keybind-conflict">
          <strong>{conflict.key}</strong> is already used by <em>{conflict.conflictingCmd.label}</em>.
          <button onClick={() => applyBinding(conflict.pendingCmd.id, conflict.key)}>Reassign</button>
          <button onClick={() => { setConflict(null); setCapturing(null) }}>Cancel</button>
        </div>
      )}

      <div style={{ marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <button onClick={handleResetAll} style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Reset all keybinds to defaults
        </button>
      </div>
    </section>
  )
}

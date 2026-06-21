const LS_KEY = 'medialog_keybinds'

export function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') } catch { return {} }
}

export function saveBinding(commandId, key) {
  const overrides = loadOverrides()
  overrides[commandId] = key
  localStorage.setItem(LS_KEY, JSON.stringify(overrides))
}

export function resetBinding(commandId) {
  const overrides = loadOverrides()
  delete overrides[commandId]
  localStorage.setItem(LS_KEY, JSON.stringify(overrides))
}

export function resetAllBindings() {
  localStorage.removeItem(LS_KEY)
}

// Returns Map<resolvedKey, command>
export function resolveBindings(commands) {
  const overrides = loadOverrides()
  const map = new Map()
  for (const cmd of commands) {
    const key = overrides[cmd.id] ?? cmd.defaultKey
    if (key) map.set(key, cmd)
  }
  return map
}

// Normalize a KeyboardEvent to a key string like "ctrl+k" or "g"
export function eventToKey(e) {
  const parts = []
  if (e.ctrlKey || e.metaKey) parts.push('ctrl')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  const k = e.key.toLowerCase()
  if (k !== 'control' && k !== 'meta' && k !== 'alt' && k !== 'shift') parts.push(k)
  return parts.join('+')
}

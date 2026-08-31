// Small UI preferences that belong to the device, not the account: which settings
// tab you had open, whether a given toast is muted. These were being written with
// a hand-rolled try/catch at each call site, and the one place that forgot the
// write entirely — the archive toast — reset itself on every reload with nothing
// to distinguish it from the toggles that worked.
//
// localStorage throws rather than returning null in private-mode Safari and when
// storage is full, and a preference read must never be the thing that stops the
// app rendering. Every accessor here swallows and falls back to the default.

export function readPref(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : raw
  } catch {
    return fallback
  }
}

export function writePref(key, value) {
  try {
    localStorage.setItem(key, String(value))
  } catch { /* preferences are best-effort; never break a save on storage */ }
}

// Booleans store as 'true'/'false'. Absent means "never set", which takes the
// caller's default rather than coercing to false — the difference between a
// toggle the user turned off and one they have never touched.
export function readBoolPref(key, fallback = true) {
  const raw = readPref(key, null)
  if (raw === null) return fallback
  return raw !== 'false'
}

// Removing a preference throws in exactly the same places setting one does, so
// a reset must be as unfailable as a write — a key that can't be cleared is not
// a reason to abort the reset the user asked for.
export function clearPref(key) {
  try {
    localStorage.removeItem(key)
  } catch { /* best-effort, same as writePref */ }
}

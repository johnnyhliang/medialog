export function normalizeName(value) {
  return String(value ?? '').trim()
}

export function normalizeLimit(value, fallback, max) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(Math.floor(n), max)
}

export function trimString(value, max) {
  return String(value ?? '').slice(0, max)
}

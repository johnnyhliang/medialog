// Goals are entries whose markdown note carries dates (frontmatter) + steps
// (task list). Everything here is pure and never throws on bad input.

const DAY = 86400000
const BEHIND_GAP = 0.15
const EPSILON = 1e-10

function parseDate(value) {
  if (!value) return null
  const d = new Date(value.trim())
  return Number.isNaN(d.getTime()) ? null : d
}

export function parseFrontmatter(note) {
  const src = String(note ?? '')
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(src)
  if (!match) return { started: null, target: null, body: src }
  const fields = {}
  for (const line of match[1].split('\n')) {
    const m = /^(\w+):\s*(.*)$/.exec(line)
    if (m) fields[m[1]] = m[2]
  }
  return {
    started: parseDate(fields.started),
    target: parseDate(fields.target),
    body: src.slice(match[0].length),
  }
}

export function parseSteps(body) {
  const lines = String(body ?? '').split('\n')
  const steps = []
  lines.forEach((line, lineIndex) => {
    const m = /^\s*[-*]\s+\[( |x|X)\]\s?(.*)$/.exec(line)
    if (m) steps.push({ text: m[2].trim(), checked: m[1].toLowerCase() === 'x', lineIndex })
  })
  const done = steps.filter((s) => s.checked).length
  return { total: steps.length, done, steps }
}

export function deriveProgress({ started, target, total, done, now = new Date() }) {
  const stepPct = total > 0 ? done / total : null
  let timePct = null
  let daysLeft = null
  if (started && target && target > started) {
    const raw = (now - started) / (target - started)
    timePct = Math.min(1, Math.max(0, raw))
    daysLeft = Math.ceil((target - now) / DAY)
  } else if (target) {
    daysLeft = Math.ceil((target - now) / DAY)
  }
  let onTrack = null
  if (stepPct !== null && timePct !== null) {
    onTrack = timePct - stepPct <= BEHIND_GAP + EPSILON
  }
  return { stepPct, timePct, daysLeft, onTrack }
}

export function toggleStep(note, lineIndex) {
  const lines = String(note ?? '').split('\n')
  if (lineIndex < 0 || lineIndex >= lines.length) return note
  const flipped = lines[lineIndex].replace(/\[( |x|X)\]/, (m, c) =>
    c === ' ' ? '[x]' : '[ ]',
  )
  if (flipped === lines[lineIndex]) return note
  lines[lineIndex] = flipped
  return lines.join('\n')
}

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

export function newGoalTemplate(now = new Date()) {
  const target = new Date(now.getTime() + 30 * DAY)
  return `---\nstarted: ${isoDate(now)}\ntarget: ${isoDate(target)}\n---\n\n- [ ] First step\n`
}

export function parseGoal(note, now = new Date()) {
  const { started, target, body } = parseFrontmatter(note)
  const { total, done, steps } = parseSteps(body)
  const progress = deriveProgress({ started, target, total, done, now })
  return { started, target, body, total, done, steps, ...progress }
}

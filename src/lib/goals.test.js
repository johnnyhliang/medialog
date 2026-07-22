import { describe, test, expect } from 'vitest'
import {
  parseFrontmatter, parseSteps, deriveProgress,
  toggleStep, newGoalTemplate, parseGoal,
} from './goals.js'

const NOTE = `---
started: 2026-07-01
target: 2026-07-31
---
Ship it.

- [x] one
- [ ] two
- [X] three
`

describe('parseFrontmatter', () => {
  test('reads started/target and returns body without the block', () => {
    const { started, target, body } = parseFrontmatter(NOTE)
    expect(started).toEqual(new Date('2026-07-01'))
    expect(target).toEqual(new Date('2026-07-31'))
    expect(body).toContain('- [x] one')
    expect(body).not.toContain('---')
  })

  test('no frontmatter returns nulls and original body', () => {
    const { started, target, body } = parseFrontmatter('just text\n- [ ] a')
    expect(started).toBeNull()
    expect(target).toBeNull()
    expect(body).toBe('just text\n- [ ] a')
  })

  test('malformed dates become null, never throws', () => {
    const { started, target } = parseFrontmatter('---\nstarted: notadate\n---\nx')
    expect(started).toBeNull()
    expect(target).toBeNull()
  })
})

describe('parseSteps', () => {
  test('counts checked and unchecked, case-insensitive', () => {
    const { total, done, steps } = parseSteps(NOTE)
    expect(total).toBe(3)
    expect(done).toBe(2)
    expect(steps[0]).toMatchObject({ text: 'one', checked: true })
    expect(steps[1]).toMatchObject({ text: 'two', checked: false })
  })

  test('records the source line index of each step', () => {
    const { steps } = parseSteps('a\n- [ ] first\nb\n- [x] second')
    expect(steps[0].lineIndex).toBe(1)
    expect(steps[1].lineIndex).toBe(3)
  })

  test('no steps returns total 0', () => {
    expect(parseSteps('no tasks here').total).toBe(0)
  })
})

describe('deriveProgress', () => {
  const started = new Date('2026-07-01')
  const target = new Date('2026-07-31')

  test('stepPct is done/total', () => {
    const { stepPct } = deriveProgress({ started, target, total: 4, done: 1, now: started })
    expect(stepPct).toBeCloseTo(0.25)
  })

  test('timePct clamps to [0,1] and daysLeft counts down', () => {
    const now = new Date('2026-07-16') // halfway
    const { timePct, daysLeft } = deriveProgress({ started, target, total: 2, done: 1, now })
    expect(timePct).toBeCloseTo(0.5, 1)
    expect(daysLeft).toBe(15)
  })

  test('past target clamps timePct to 1 and daysLeft can go negative', () => {
    const now = new Date('2026-08-10')
    const { timePct, daysLeft } = deriveProgress({ started, target, total: 2, done: 0, now })
    expect(timePct).toBe(1)
    expect(daysLeft).toBeLessThan(0)
  })

  test('missing dates yield null time fields but keep stepPct', () => {
    const { stepPct, timePct, daysLeft, onTrack } = deriveProgress({ started: null, target: null, total: 2, done: 1, now: started })
    expect(stepPct).toBe(0.5)
    expect(timePct).toBeNull()
    expect(daysLeft).toBeNull()
    expect(onTrack).toBeNull()
  })

  test('no steps yields null stepPct', () => {
    expect(deriveProgress({ started, target, total: 0, done: 0, now: started }).stepPct).toBeNull()
  })

  test('behind when time leads steps by more than 0.15', () => {
    const now = new Date('2026-07-25') // ~0.8 time
    const { onTrack } = deriveProgress({ started, target, total: 10, done: 1, now })
    expect(onTrack).toBe(false)
  })

  test('on track at exactly 0.15 gap', () => {
    // time 0.5, steps 0.35 -> gap exactly 0.15 -> onTrack true (strict >)
    const now = new Date('2026-07-16')
    const { onTrack } = deriveProgress({ started, target, total: 100, done: 35, now })
    expect(onTrack).toBe(true)
  })
})

describe('toggleStep', () => {
  test('flips the checkbox on the given line only', () => {
    const out = toggleStep(NOTE, 6) // line index of "- [x] one" in NOTE
    const line = out.split('\n')[6]
    expect(line).toBe('- [ ] one')
  })

  test('unknown line index returns note unchanged', () => {
    expect(toggleStep(NOTE, 999)).toBe(NOTE)
  })
})

describe('newGoalTemplate', () => {
  test('has today as started and +30 days as target', () => {
    const now = new Date('2026-07-17')
    const tpl = newGoalTemplate(now)
    expect(tpl).toContain('started: 2026-07-17')
    expect(tpl).toContain('target: 2026-08-16')
    expect(tpl).toMatch(/- \[ \]/)
  })
})

describe('parseGoal', () => {
  test('combines frontmatter, steps, and derived progress', () => {
    const g = parseGoal(NOTE, new Date('2026-07-16'))
    expect(g.total).toBe(3)
    expect(g.done).toBe(2)
    expect(g.stepPct).toBeCloseTo(2 / 3)
    expect(g.timePct).toBeCloseTo(0.5, 1)
  })
})

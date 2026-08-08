import { describe, test, expect } from 'vitest'
import {
  stepText, stepDate, scheduledFrom, deadlineRows, buildAgenda,
  phraseForRow, urgencyForRow, pressingCount,
} from '../../../src/lib/orgAgenda.js'

const NOW = new Date('2026-08-08T15:00:00Z')
const NY = 'America/New_York'
const opts = { now: NOW, tz: NY }

const project = (over = {}) => ({ id: 'p1', name: 'Order Book', master_doc: '', ...over })

describe('step dates', () => {
  test('reads a trailing @date and strips it from the text', () => {
    expect(stepDate('Phase 0 — Scope @2026-10-31')).toBe('2026-10-31')
    expect(stepText('Phase 0 — Scope @2026-10-31')).toBe('Phase 0 — Scope')
  })

  test('a step with no date is unchanged', () => {
    expect(stepDate('Phase 0 — Scope')).toBe(null)
    expect(stepText('Phase 0 — Scope')).toBe('Phase 0 — Scope')
  })

  test('only a TRAILING date counts — an address mid-sentence is not a date', () => {
    expect(stepDate('email me@2026-10-31 about it')).toBe(null)
    expect(stepText('email me@2026-10-31 about it')).toBe('email me@2026-10-31 about it')
  })

  test('tolerates junk', () => {
    expect(stepDate(null)).toBe(null)
    expect(stepText(undefined)).toBe('')
  })
})

describe('scheduledFrom', () => {
  test('emits a row per dated open step', () => {
    const p = project({ master_doc: '- [ ] Phase 0 @2026-08-20\n- [ ] Phase 1 @2026-09-01\n' })
    const rows = scheduledFrom([p], opts)
    expect(rows.map((r) => r.title)).toEqual(['Phase 0', 'Phase 1'])
    expect(rows[0]).toMatchObject({ kind: 'scheduled', project: 'Order Book', daysLeft: 12 })
  })

  test('a CHECKED step is not scheduled — it is done', () => {
    const p = project({ master_doc: '- [x] Phase 0 @2026-08-20\n- [ ] Phase 1 @2026-09-01\n' })
    expect(scheduledFrom([p], opts).map((r) => r.title)).toEqual(['Phase 1'])
  })

  test('undated steps contribute nothing', () => {
    const p = project({ master_doc: '- [ ] Phase 0\n- [ ] Phase 1\n' })
    expect(scheduledFrom([p], opts)).toEqual([])
  })

  test('a plan target becomes one row summarising what is left', () => {
    const p = project({ master_doc: '---\ntarget: 2026-09-30\n---\n- [ ] a\n- [x] b\n- [ ] c\n' })
    const target = scheduledFrom([p], opts).find((r) => r.isPlanTarget)
    expect(target.title).toBe('Order Book — 2 steps left')
    expect(target.date).toBe('2026-09-30')
  })

  test('a FINISHED plan drops off entirely — it is not pending', () => {
    const p = project({ master_doc: '---\ntarget: 2026-09-30\n---\n- [x] a\n- [x] b\n' })
    expect(scheduledFrom([p], opts)).toEqual([])
  })

  test('singularises one remaining step', () => {
    const p = project({ master_doc: '---\ntarget: 2026-09-30\n---\n- [ ] a\n' })
    expect(scheduledFrom([p], opts).find((r) => r.isPlanTarget).title).toBe('Order Book — 1 step left')
  })

  test('junk projects are skipped, not thrown on', () => {
    expect(scheduledFrom([null, {}, { id: null }], opts)).toEqual([])
    expect(scheduledFrom(undefined)).toEqual([])
  })
})

describe('buildAgenda', () => {
  const deadlines = [
    { key: 'application:a1', name: 'Optiver', detail: 'Quant Dev', daysLeft: 3, when: 'in 3 days' },
  ]

  test('merges both halves, soonest first', () => {
    const p = project({ master_doc: '- [ ] Phase 0 @2026-08-20\n' })
    const rows = buildAgenda({ projects: [p], deadlines, ...opts })
    expect(rows.map((r) => r.kind)).toEqual(['deadline', 'scheduled'])
  })

  test('a hard deadline outranks a soft target on the same day', () => {
    const p = project({ master_doc: '- [ ] Phase 0 @2026-08-11\n' })
    const rows = buildAgenda({ projects: [p], deadlines, ...opts })
    expect(rows[0].kind).toBe('deadline')
  })

  test('scheduled items past the horizon are dropped; deadlines are not', () => {
    const p = project({ master_doc: '- [ ] Far away @2027-08-01\n' })
    const rows = buildAgenda({ projects: [p], deadlines, horizonDays: 60, ...opts })
    expect(rows.map((r) => r.title)).toEqual(['Optiver'])
  })

  test('empty in, empty out', () => {
    expect(buildAgenda()).toEqual([])
    expect(buildAgenda({ projects: [], deadlines: [], ...opts })).toEqual([])
  })
})

describe('vocabulary — the whole point of the split', () => {
  test('a passed TARGET says "was <date>", never overdue', () => {
    const row = { kind: 'scheduled', daysLeft: -5, date: '2026-08-03' }
    expect(phraseForRow(row)).toBe('was 2026-08-03')
    expect(phraseForRow(row)).not.toMatch(/overdue|late|behind/i)
  })

  test('a deadline keeps its countdown', () => {
    expect(phraseForRow({ kind: 'deadline', daysLeft: 3, when: 'in 3 days' })).toBe('in 3 days')
  })

  test('a target is never given urgency colour, however close', () => {
    for (const d of [-10, 0, 1, 90]) {
      expect(urgencyForRow({ kind: 'scheduled', daysLeft: d })).toBe('scheduled')
    }
  })

  test('a deadline is graded', () => {
    expect(urgencyForRow({ kind: 'deadline', daysLeft: 0 })).toBe('today')
    expect(urgencyForRow({ kind: 'deadline', daysLeft: 30 })).toBe('later')
  })

  test('no phrase for anything is ever the shaming vocabulary', () => {
    const rows = [
      { kind: 'scheduled', daysLeft: -1, date: '2026-08-07' },
      { kind: 'scheduled', daysLeft: 0 },
      { kind: 'deadline', daysLeft: -1, when: 'closed' },
      { kind: 'deadline', daysLeft: 0, when: 'today' },
    ]
    for (const r of rows) expect(phraseForRow(r)).not.toMatch(/overdue|behind|failed|missed/i)
  })
})

describe('pressingCount', () => {
  test('counts only hard deadlines inside a week', () => {
    const rows = [
      { kind: 'deadline', daysLeft: 2 },
      { kind: 'deadline', daysLeft: 20 },
      { kind: 'scheduled', daysLeft: 1 },
      { kind: 'deadline', daysLeft: null },
    ]
    expect(pressingCount(rows)).toBe(1)
  })

  test('zero on an empty agenda', () => {
    expect(pressingCount()).toBe(0)
  })
})

describe('deadlineRows', () => {
  test('relabels without inventing fields', () => {
    const [r] = deadlineRows([{ key: 'k', name: 'Neo', detail: 'program', url: 'u', daysLeft: 4, when: 'in 4 days' }])
    expect(r).toEqual({
      key: 'k', kind: 'deadline', title: 'Neo', project: 'program',
      url: 'u', date: null, daysLeft: 4, when: 'in 4 days',
    })
  })
})

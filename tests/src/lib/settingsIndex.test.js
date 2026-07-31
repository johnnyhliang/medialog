import { describe, it, expect } from 'vitest'
import { SETTINGS_INDEX, SETTINGS_TABS, searchSettings } from '../../../src/lib/settingsIndex.js'

// The index is hand-maintained on purpose (deriving it from the DOM would drift
// silently), so these tests are what make "I added a setting and forgot to index
// it" a failing build rather than a search that quietly returns nothing.
describe('settings index / tab agreement', () => {
  const tabIds = new Set(SETTINGS_TABS.map((t) => t.id))

  it('every tab has at least one searchable entry', () => {
    const covered = new Set(SETTINGS_INDEX.map((s) => s.tab))
    const missing = SETTINGS_TABS.map((t) => t.id).filter((id) => !covered.has(id))
    expect(missing, `tabs with no entry in SETTINGS_INDEX: ${missing.join(', ')}`).toEqual([])
  })

  it('every entry points at a tab that exists', () => {
    const orphans = [...new Set(SETTINGS_INDEX.map((s) => s.tab))].filter((t) => !tabIds.has(t))
    expect(orphans, `entries referencing unknown tabs: ${orphans.join(', ')}`).toEqual([])
  })

  // A gated tab whose entries are ungated would surface a setting in search that
  // the user cannot open — the exact mismatch that made Settings tabs and the
  // sidebar disagree before both were driven from the module registry.
  it('entries inherit the module gate of their tab', () => {
    const gate = Object.fromEntries(SETTINGS_TABS.map((t) => [t.id, t.module ?? null]))
    const wrong = SETTINGS_INDEX
      .filter((s) => gate[s.tab] && (s.module ?? null) !== gate[s.tab])
      .map((s) => `${s.tab}/${s.label}`)
    expect(wrong, `entries missing their tab's module gate: ${wrong.join(', ')}`).toEqual([])
  })

  it('has no duplicate label within a tab', () => {
    const seen = new Set()
    const dupes = []
    for (const s of SETTINGS_INDEX) {
      const k = `${s.tab}::${s.label}`
      if (seen.has(k)) dupes.push(k)
      seen.add(k)
    }
    expect(dupes).toEqual([])
  })
})

describe('searchSettings', () => {
  const all = () => true

  it('matches on keywords rather than only the label', () => {
    const hits = searchSettings('dark mode', all)
    expect(hits.map((h) => h.label)).toContain('Color palette')
  })

  it('finds a setting by what it does', () => {
    expect(searchSettings('repo', all).some((h) => h.tab === 'github')).toBe(true)
  })

  it('hides entries whose module is off', () => {
    const hidden = searchSettings('fellowship', (m) => m !== 'career')
    expect(hidden).toEqual([])
  })

  it('returns nothing for an empty query', () => {
    expect(searchSettings('', all)).toEqual([])
  })
})

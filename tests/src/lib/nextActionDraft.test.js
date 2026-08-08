import { describe, test, expect } from 'vitest'
import {
  buildDraftPrompt, cleanDraft, hasDraftContext, DRAFT_SYSTEM,
} from '../../../src/lib/nextActionDraft.js'

const step = (text, checked = false) => ({ text, checked })
const entry = (title, over = {}) => ({ title, status: 'active', ...over })

describe('DRAFT_SYSTEM', () => {
  test('forbids inventing specifics, which is the failure mode that kills trust', () => {
    expect(DRAFT_SYSTEM).toMatch(/Do not invent/)
    expect(DRAFT_SYSTEM).toMatch(/ONE line/)
    expect(DRAFT_SYSTEM).toMatch(/UNCLEAR/)
  })
})

describe('buildDraftPrompt', () => {
  test('includes the project name', () => {
    const { prompt } = buildDraftPrompt({ topic: { name: 'C++ Curriculum' } })
    expect(prompt).toContain('Project: C++ Curriculum')
  })

  test('lists unchecked steps and counts the done ones', () => {
    const { prompt } = buildDraftPrompt({
      topic: { name: 'Plan' },
      steps: [step('RAII', true), step('Smart pointers'), step('Move semantics')],
    })
    expect(prompt).toContain('Plan: 1 of 3 steps done.')
    expect(prompt).toContain('- Smart pointers')
    // A finished step is not a candidate for what to do next.
    expect(prompt).not.toContain('- RAII')
  })

  test('caps how many steps and entries are sent', () => {
    const steps = Array.from({ length: 30 }, (_, i) => step(`step ${i}`))
    const entries = Array.from({ length: 30 }, (_, i) => entry(`entry ${i}`))
    const { prompt } = buildDraftPrompt({ topic: { name: 'Big' }, steps, entries })
    expect(prompt).toContain('- step 5')
    expect(prompt).not.toContain('- step 6')
    expect(prompt).toContain('entry 7')
    expect(prompt).not.toContain('entry 8')
  })

  test('never sends the master doc itself', () => {
    const { prompt } = buildDraftPrompt({
      topic: { name: 'Plan', master_doc: '---\ntarget: 2027-10-31\n---\nSECRET PROSE' },
      steps: [step('a')],
    })
    expect(prompt).not.toContain('SECRET PROSE')
    expect(prompt).not.toContain('target:')
  })

  test('skips deleted and untitled entries', () => {
    const { prompt } = buildDraftPrompt({
      topic: { name: 'T' },
      entries: [entry('kept'), entry('gone', { deleted_at: '2026-01-01' }), { status: 'active' }],
    })
    expect(prompt).toContain('kept')
    expect(prompt).not.toContain('gone')
  })

  test('degrades to just the name rather than throwing', () => {
    const { prompt, system } = buildDraftPrompt()
    expect(prompt).toContain('Project: Untitled')
    expect(system).toBe(DRAFT_SYSTEM)
  })
})

describe('hasDraftContext', () => {
  test('true with an unchecked step or a titled entry', () => {
    expect(hasDraftContext({ steps: [step('a')] })).toBe(true)
    expect(hasDraftContext({ entries: [entry('a')] })).toBe(true)
  })

  test('false when there is nothing to draft from', () => {
    expect(hasDraftContext()).toBe(false)
    expect(hasDraftContext({ steps: [], entries: [] })).toBe(false)
    // All steps done and no entries: the plan is finished, not stuck.
    expect(hasDraftContext({ steps: [step('a', true)] })).toBe(false)
    expect(hasDraftContext({ entries: [{ status: 'active' }] })).toBe(false)
  })
})

describe('cleanDraft', () => {
  test('passes a good line through', () => {
    expect(cleanDraft('Write the Phase 0 design doc')).toBe('Write the Phase 0 design doc')
  })

  test('strips bullets, numbering, quotes and a trailing period', () => {
    expect(cleanDraft('- Write the design doc')).toBe('Write the design doc')
    expect(cleanDraft('1. Write the design doc')).toBe('Write the design doc')
    expect(cleanDraft('"Write the design doc"')).toBe('Write the design doc')
    expect(cleanDraft('“Write the design doc”')).toBe('Write the design doc')
    expect(cleanDraft('Write the design doc.')).toBe('Write the design doc')
  })

  test('strips a restatement of the question', () => {
    expect(cleanDraft('Next action: Write the design doc')).toBe('Write the design doc')
    expect(cleanDraft('The single next action: Write the design doc')).toBe('Write the design doc')
  })

  test('takes the first non-empty line when the model rambles on', () => {
    expect(cleanDraft('\n\nWrite the design doc\n\nThis will help because…')).toBe('Write the design doc')
  })

  test('UNCLEAR becomes null rather than reaching the input', () => {
    expect(cleanDraft('UNCLEAR')).toBe(null)
    expect(cleanDraft('unclear')).toBe(null)
  })

  test('rejects a paragraph rather than truncating it into a half-sentence', () => {
    expect(cleanDraft('x'.repeat(200))).toBe(null)
  })

  test('null for nothing, and for non-strings', () => {
    expect(cleanDraft(null)).toBe(null)
    expect(cleanDraft('')).toBe(null)
    expect(cleanDraft('   ')).toBe(null)
    expect(cleanDraft(42)).toBe(null)
    expect(cleanDraft({ content: 'hi' })).toBe(null)
  })

  test('a bullet that reduces to nothing is null, not an empty string', () => {
    expect(cleanDraft('- ')).toBe(null)
    expect(cleanDraft('"."')).toBe(null)
  })
})

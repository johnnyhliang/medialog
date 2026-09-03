import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../../src/lib/ai.js', () => ({ classify: vi.fn() }))

import { classify } from '../../../src/lib/ai.js'
import { routeMessage, validateDueDate, validateEstimate, buildSystemPrompt } from '../../../src/lib/parseTask.js'

const TZ = 'America/Detroit' // west of Greenwich on purpose
const NOW = new Date('2026-09-09T15:00:00Z')
const supabase = {}

beforeEach(() => { classify.mockReset() })

describe('the system prompt', () => {
  it('states today and the zone, because "by Friday" has no referent without them', () => {
    const sys = buildSystemPrompt('2026-09-09', TZ)
    expect(sys).toContain('2026-09-09')
    expect(sys).toContain('America/Detroit')
    expect(sys).toMatch(/YYYY-MM-DD/)
    // The tie-break the whole fork depends on.
    expect(sys).toMatch(/when in doubt, answer "ask"/i)
  })
})

describe('validateDueDate', () => {
  const today = '2026-09-09'
  it('accepts a real future day', () => {
    expect(validateDueDate('2026-09-11', today)).toBe('2026-09-11')
  })
  it('accepts today', () => {
    expect(validateDueDate('2026-09-09', today)).toBe('2026-09-09')
  })
  it('rejects a date in the past', () => {
    expect(validateDueDate('2026-03-01', today)).toBeNull()
  })
  it('rejects a month that does not exist', () => {
    expect(validateDueDate('2026-19-04', today)).toBeNull()
  })
  it('rejects a day that does not exist in that month', () => {
    expect(validateDueDate('2027-02-31', today)).toBeNull()
  })
  it('rejects a timestamp — the model may only return a calendar day', () => {
    expect(validateDueDate('2026-09-11T00:00:00Z', today)).toBeNull()
  })
  it('rejects a hallucinated century', () => {
    expect(validateDueDate('2126-09-11', today)).toBeNull()
  })
  it('rejects a non-string', () => {
    expect(validateDueDate(20260911, today)).toBeNull()
  })
})

describe('validateEstimate', () => {
  it('keeps a plausible number of minutes', () => {
    expect(validateEstimate(30)).toBe(30)
  })
  it('drops nonsense', () => {
    expect(validateEstimate(0)).toBeNull()
    expect(validateEstimate(-5)).toBeNull()
    expect(validateEstimate(999999)).toBeNull()
    expect(validateEstimate('30')).toBeNull()
    expect(validateEstimate(NaN)).toBeNull()
  })
})

describe('routeMessage', () => {
  const capture = (extra = {}) => ({ intent: 'capture', title: 'Email the 370 staff about office hours', due_at: '2026-09-11', estimate_minutes: 30, ...extra })

  it('extracts the task when the message is an instruction', async () => {
    classify.mockResolvedValue(capture())
    const out = await routeMessage(supabase, 'email the 370 staff about office hours by friday', { tz: TZ, now: NOW })
    expect(out).toEqual({
      intent: 'capture',
      title: 'Email the 370 staff about office hours',
      dueDate: '2026-09-11',
      estimateMinutes: 30,
    })
  })

  it('routes a question to the existing answering path', async () => {
    classify.mockResolvedValue({ intent: 'ask', title: null, due_at: null })
    expect(await routeMessage(supabase, 'what did I conclude about market making?', { tz: TZ, now: NOW }))
      .toEqual({ intent: 'ask' })
  })

  it('routes and extracts in a single call', async () => {
    classify.mockResolvedValue(capture())
    await routeMessage(supabase, 'do the thing friday', { tz: TZ, now: NOW })
    expect(classify).toHaveBeenCalledTimes(1)
  })

  it('passes today, read in the user zone, into the system prompt', async () => {
    classify.mockResolvedValue({ intent: 'ask' })
    // 00:30 UTC on the 10th is still the 9th in Detroit. Sending the UTC day
    // would resolve "tomorrow" to the wrong date for a late-night capture.
    await routeMessage(supabase, 'x', { tz: TZ, now: new Date('2026-09-10T00:30:00Z') })
    expect(classify.mock.calls[0][1].system).toContain('Today is 2026-09-09')
  })

  it('falls back to asking when the AI is unavailable', async () => {
    // Provider error, timeout, malformed JSON, or an `ai` function with no
    // provider configured at all — all arrive here as null.
    classify.mockResolvedValue(null)
    expect(await routeMessage(supabase, 'do a thing tomorrow', { tz: TZ, now: NOW })).toEqual({ intent: 'ask' })
  })

  it('falls back to asking on an intent it does not recognise', async () => {
    classify.mockResolvedValue({ intent: 'maybe', title: 'Something', due_at: '2026-09-11' })
    expect(await routeMessage(supabase, 'something', { tz: TZ, now: NOW })).toEqual({ intent: 'ask' })
  })

  it('falls back to asking when a capture has no usable title', async () => {
    classify.mockResolvedValue(capture({ title: '' }))
    expect(await routeMessage(supabase, 'something', { tz: TZ, now: NOW })).toEqual({ intent: 'ask' })
  })

  it('falls back to asking rather than writing a 5,000-character title', async () => {
    classify.mockResolvedValue(capture({ title: 'x'.repeat(5000) }))
    expect(await routeMessage(supabase, 'something', { tz: TZ, now: NOW })).toEqual({ intent: 'ask' })
  })

  it('drops a past date but keeps the capture', async () => {
    classify.mockResolvedValue(capture({ title: 'Call the dentist', due_at: '2001-01-01', estimate_minutes: null }))
    const out = await routeMessage(supabase, 'call the dentist friday', { tz: TZ, now: NOW })
    expect(out).toEqual({ intent: 'capture', title: 'Call the dentist', dueDate: null, estimateMinutes: null })
  })

  it('drops a malformed date but keeps the capture', async () => {
    classify.mockResolvedValue(capture({ title: 'Call the dentist', due_at: 'next friday' }))
    const out = await routeMessage(supabase, 'call the dentist', { tz: TZ, now: NOW })
    expect(out.dueDate).toBeNull()
    expect(out.title).toBe('Call the dentist')
  })

  it('never calls the model on empty input', async () => {
    expect(await routeMessage(supabase, '   ', { tz: TZ, now: NOW })).toEqual({ intent: 'ask' })
    expect(classify).not.toHaveBeenCalled()
  })
})

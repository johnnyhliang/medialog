import { describe, test, expect } from 'vitest'
import { mockSupabase } from '../../../helpers/mockSupabase.js'
import {
  listContributions, recordContribution, unrecordContribution,
} from '../../../../src/lib/db/contributions.js'

const NOW = new Date('2026-08-07T15:00:00Z')
const NY = 'America/New_York'
const TOKYO = 'Asia/Tokyo'

describe('listContributions', () => {
  test('reads the grid window newest first', async () => {
    const rows = [{ id: 'c1', day: '2026-08-07', kind: 'step' }]
    const c = mockSupabase({ data: rows, error: null })
    expect(await listContributions(c, { now: NOW, tz: NY })).toEqual(rows)
    expect(c.from).toHaveBeenCalledWith('contributions')
    expect(c._chain.select).toHaveBeenCalledWith('id, day, topic_id, kind, note')
    expect(c._chain.order).toHaveBeenCalledWith('day', { ascending: false })
  })

  test('the window floor is `days` back, as a local day key', async () => {
    const c = mockSupabase({ data: [], error: null })
    await listContributions(c, { days: 7, now: NOW, tz: NY })
    expect(c._chain.gte).toHaveBeenCalledWith('day', '2026-07-31')
  })

  test('null data degrades to an empty array', async () => {
    const c = mockSupabase({ data: null, error: null })
    expect(await listContributions(c, { now: NOW, tz: NY })).toEqual([])
  })

  test('errors throw with the message', async () => {
    const c = mockSupabase({ data: null, error: { message: 'nope' } })
    await expect(listContributions(c, { now: NOW, tz: NY })).rejects.toThrow('nope')
  })
})

describe('recordContribution', () => {
  test('writes the local day, not the UTC one', async () => {
    // 23:30 in New York is already tomorrow in UTC. The square must be tonight's.
    const lateNight = new Date('2026-08-08T03:30:00Z')
    const c = mockSupabase({ data: null, error: null })
    await recordContribution(c, { kind: 'step', note: 'RAII', now: lateNight, tz: NY })
    expect(c._chain.insert).toHaveBeenCalledWith({
      day: '2026-08-07', topic_id: null, kind: 'step', note: 'RAII',
    })
  })

  test('carries the topic when there is one', async () => {
    const c = mockSupabase({ data: null, error: null })
    await recordContribution(c, { topicId: 't1', kind: 'done', note: 'EMC++', now: NOW, tz: TOKYO })
    expect(c._chain.insert).toHaveBeenCalledWith({
      day: '2026-08-08', topic_id: 't1', kind: 'done', note: 'EMC++',
    })
  })

  test('does not set user_id — the column defaults to auth.uid()', async () => {
    const c = mockSupabase({ data: null, error: null })
    await recordContribution(c, { kind: 'step', now: NOW, tz: NY })
    expect(c._chain.insert.mock.calls[0][0]).not.toHaveProperty('user_id')
  })

  test('errors throw with the message', async () => {
    const c = mockSupabase({ data: null, error: { message: 'denied' } })
    await expect(recordContribution(c, { kind: 'step', now: NOW, tz: NY })).rejects.toThrow('denied')
  })
})

describe('unrecordContribution', () => {
  test('deletes only today\'s matching row', async () => {
    const c = mockSupabase({ data: null, error: null })
    await unrecordContribution(c, { kind: 'step', note: 'RAII', now: NOW, tz: NY })
    expect(c._chain.delete).toHaveBeenCalled()
    expect(c._chain.eq).toHaveBeenCalledWith('day', '2026-08-07')
    expect(c._chain.eq).toHaveBeenCalledWith('kind', 'step')
    expect(c._chain.eq).toHaveBeenCalledWith('note', 'RAII')
  })

  test('a null note matches IS NULL rather than equality', async () => {
    // `.eq('note', null)` silently matches nothing in PostgREST, which would
    // leave an orphan square behind on every undo.
    const c = mockSupabase({ data: null, error: null })
    await unrecordContribution(c, { kind: 'done', note: null, now: NOW, tz: NY })
    expect(c._chain.is).toHaveBeenCalledWith('note', null)
    expect(c._chain.eq).not.toHaveBeenCalledWith('note', null)
  })

  test('errors throw with the message', async () => {
    const c = mockSupabase({ data: null, error: { message: 'nope' } })
    await expect(unrecordContribution(c, { kind: 'step', note: 'x', now: NOW, tz: NY })).rejects.toThrow('nope')
  })
})

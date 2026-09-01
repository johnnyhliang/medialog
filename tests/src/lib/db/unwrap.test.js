import { describe, test, expect } from 'vitest'
import { unwrap, unwrapList, DbError } from '../../../../src/lib/db/unwrap.js'

describe('unwrap', () => {
  test('returns data when there is no error', () => {
    expect(unwrap({ data: [1, 2], error: null }, 'ctx')).toEqual([1, 2])
  })

  test('throws a DbError carrying the operation name', () => {
    const call = () => unwrap({ data: null, error: { message: 'boom' } }, 'listEntries')
    expect(call).toThrow(DbError)
    try { call() } catch (e) {
      expect(e.context).toBe('listEntries')
      expect(e.name).toBe('DbError')
    }
  })

  // The whole point of the sweep: a failed query must not look like an empty
  // table. This is the assertion that the old `data ?? []` could never satisfy.
  test('a failure NEVER returns an empty list', () => {
    expect(() => unwrapList({ data: null, error: { message: 'denied' } }, 'ctx')).toThrow()
  })

  test('an empty result is still an empty list, not an error', () => {
    expect(unwrapList({ data: [], error: null }, 'ctx')).toEqual([])
    expect(unwrapList({ data: null, error: null }, 'ctx')).toEqual([])
  })

  // message must stay the raw cause so existing addToast(e.message) call sites
  // do not start showing internal function names to users.
  test('message is the cause message alone — context is not prefixed into it', () => {
    try {
      unwrap({ data: null, error: { message: 'JWT expired' } }, 'loadConfig')
    } catch (e) {
      expect(e.message).toBe('JWT expired')
      expect(e.message).not.toContain('loadConfig')
      expect(e.stack).toContain('loadConfig')
    }
  })

  test('preserves the postgres code so callers can branch on it', () => {
    try {
      unwrap({ data: null, error: { message: 'dup', code: '23505', details: 'd', hint: 'h' } }, 'ctx')
    } catch (e) {
      expect(e.code).toBe('23505')
      expect(e.details).toBe('d')
      expect(e.hint).toBe('h')
    }
  })

  test('is catchable as a plain Error, so existing catch blocks still work', () => {
    try {
      unwrap({ data: null, error: { message: 'x' } }, 'ctx')
    } catch (e) {
      expect(e).toBeInstanceOf(Error)
    }
  })

  test('refuses to run without a context — an unattributable error is the bug', () => {
    expect(() => unwrap({ data: 1, error: null })).toThrow(/requires a context/)
  })
})

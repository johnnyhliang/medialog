import { describe, it, expect } from 'vitest'
import { passwordStrength } from '../../../src/lib/passwordStrength.js'

// This module is imported by two different bundles (landing + app), so the
// contract it has to keep is the exact shape both call sites destructure:
// { score, label, color }.
describe('passwordStrength', () => {
  it('returns a neutral, unlabelled bar for an empty password', () => {
    expect(passwordStrength('')).toEqual({ score: 0, label: '', color: 'transparent' })
    expect(passwordStrength(undefined)).toEqual({ score: 0, label: '', color: 'transparent' })
  })

  it('scores a short single-class password as weak', () => {
    expect(passwordStrength('abc')).toEqual({ score: 0, label: 'weak', color: 'var(--pw-weak)' })
    // 8 chars is one point — still weak, even though it passes the 8-char
    // minimum the callers enforce at submit time.
    expect(passwordStrength('abcdefgh')).toMatchObject({ score: 1, label: 'weak' })
  })

  it('climbs one band per point earned', () => {
    expect(passwordStrength('abcdefghijkl')).toMatchObject({ score: 2, label: 'fair' })
    expect(passwordStrength('Abcdefghijkl')).toMatchObject({ score: 3, label: 'good' })
    expect(passwordStrength('Abcdefghijk1')).toMatchObject({ score: 4, label: 'strong' })
    expect(passwordStrength('Abcdefghij1!')).toMatchObject({ score: 5, label: 'strong' })
  })

  it('counts each character class only once', () => {
    // Many digits, still one digit point — the bar rewards variety, not volume.
    expect(passwordStrength('11111111').score).toBe(passwordStrength('abcdefg1').score)
  })

  it('pairs every label with its own colour token', () => {
    for (const pw of ['abc', 'abcdefghijkl', 'Abcdefghijkl', 'Abcdefghij1!']) {
      const { label, color } = passwordStrength(pw)
      expect(color).toBe(`var(--pw-${label})`)
    }
  })

  it('never exceeds the 5 points the meter can award', () => {
    expect(passwordStrength('Abcdefghijklmnop1234!@#$').score).toBe(5)
  })
})

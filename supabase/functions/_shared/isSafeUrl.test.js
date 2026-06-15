import { describe, test, expect } from 'vitest'
import { isSafeUrl } from './isSafeUrl.ts'

describe('isSafeUrl', () => {
  test('allows normal public https/http urls', () => {
    expect(isSafeUrl('https://news.ycombinator.com/item?id=1')).toBe(true)
    expect(isSafeUrl('http://example.com')).toBe(true)
  })

  test('rejects non-http(s) schemes', () => {
    expect(isSafeUrl('file:///etc/passwd')).toBe(false)
    expect(isSafeUrl('ftp://example.com')).toBe(false)
    expect(isSafeUrl('not a url')).toBe(false)
  })

  test('rejects localhost and .local', () => {
    expect(isSafeUrl('http://localhost:8000')).toBe(false)
    expect(isSafeUrl('http://printer.local')).toBe(false)
  })

  test('rejects private and loopback IPv4', () => {
    expect(isSafeUrl('http://127.0.0.1')).toBe(false)
    expect(isSafeUrl('http://10.0.0.5')).toBe(false)
    expect(isSafeUrl('http://192.168.1.1')).toBe(false)
    expect(isSafeUrl('http://172.16.0.1')).toBe(false)
  })

  test('rejects the cloud metadata address', () => {
    expect(isSafeUrl('http://169.254.169.254/latest/meta-data/')).toBe(false)
  })

  test('rejects IPv6 loopback/link-local', () => {
    expect(isSafeUrl('http://[::1]')).toBe(false)
    expect(isSafeUrl('http://[fe80::1]')).toBe(false)
  })
})

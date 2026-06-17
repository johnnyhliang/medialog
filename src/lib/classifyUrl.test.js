import { describe, test, expect } from 'vitest'
import { classifyUrl } from './classifyUrl.js'

describe('classifyUrl', () => {
  test('detects Google Drive file', () => {
    expect(classifyUrl('https://drive.google.com/file/d/abc123/view')).toBe('drive')
  })
  test('detects Google Docs', () => {
    expect(classifyUrl('https://docs.google.com/document/d/abc/edit')).toBe('drive')
  })
  test('detects PDF by extension', () => {
    expect(classifyUrl('https://example.com/paper.pdf')).toBe('pdf')
    expect(classifyUrl('https://example.com/PAPER.PDF')).toBe('pdf')
  })
  test('detects image extensions', () => {
    expect(classifyUrl('https://example.com/photo.jpg')).toBe('image')
    expect(classifyUrl('https://example.com/photo.PNG')).toBe('image')
    expect(classifyUrl('https://example.com/img.webp')).toBe('image')
    expect(classifyUrl('https://example.com/img.svg')).toBe('image')
  })
  test('detects text extensions', () => {
    expect(classifyUrl('https://example.com/notes.md')).toBe('text')
    expect(classifyUrl('https://example.com/data.csv')).toBe('text')
    expect(classifyUrl('https://example.com/readme.txt')).toBe('text')
  })
  test('returns null for plain web URLs', () => {
    expect(classifyUrl('https://example.com')).toBeNull()
    expect(classifyUrl('https://github.com/user/repo')).toBeNull()
  })
  test('returns null for empty/null input', () => {
    expect(classifyUrl('')).toBeNull()
    expect(classifyUrl(null)).toBeNull()
    expect(classifyUrl(undefined)).toBeNull()
  })
  test('Supabase storage URL classifies by extension', () => {
    expect(classifyUrl('https://bhxqgpgyxqnqvnqjvrrj.supabase.co/storage/v1/object/public/attachments/user/file.pdf')).toBe('pdf')
    expect(classifyUrl('https://bhxqgpgyxqnqvnqjvrrj.supabase.co/storage/v1/object/public/attachments/user/photo.jpg')).toBe('image')
  })
  test('URL with query string still classifies', () => {
    expect(classifyUrl('https://example.com/file.pdf?token=abc')).toBe('pdf')
  })
})

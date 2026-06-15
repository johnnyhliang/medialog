import { describe, test, expect, vi } from 'vitest'
import { callAI, classify, parseJSON } from './ai.js'

function mockClient(response) {
  return { functions: { invoke: vi.fn(() => Promise.resolve(response)) } }
}

describe('parseJSON', () => {
  test('parses clean json', () => {
    expect(parseJSON('{"a":1}')).toEqual({ a: 1 })
  })
  test('extracts json embedded in surrounding text', () => {
    expect(parseJSON('Sure! {"a":1} done')).toEqual({ a: 1 })
  })
  test('returns null on garbage', () => {
    expect(parseJSON('not json')).toBeNull()
    expect(parseJSON('')).toBeNull()
    expect(parseJSON(null)).toBeNull()
  })
})

describe('callAI', () => {
  test('returns content and sends prompt body', async () => {
    const client = mockClient({ data: { content: 'hello' }, error: null })
    const result = await callAI(client, { prompt: 'hi', system: 'sys' })
    expect(client.functions.invoke).toHaveBeenCalledWith('ai', {
      body: { system: 'sys', prompt: 'hi', json: false, model: undefined },
    })
    expect(result).toBe('hello')
  })
  test('returns null on error (never throws)', async () => {
    const client = mockClient({ data: null, error: { message: 'boom' } })
    expect(await callAI(client, { prompt: 'hi' })).toBeNull()
  })
})

describe('classify', () => {
  test('returns parsed JSON from a json call', async () => {
    const client = mockClient({ data: { content: '{"topic":"AI"}' }, error: null })
    const result = await classify(client, { system: 'rules', prompt: 'entry' })
    expect(client.functions.invoke).toHaveBeenCalledWith('ai', {
      body: { system: 'rules', prompt: 'entry', json: true, model: undefined },
    })
    expect(result).toEqual({ topic: 'AI' })
  })
  test('returns null when the model output is not valid json', async () => {
    const client = mockClient({ data: { content: 'no idea' }, error: null })
    expect(await classify(client, { system: 's', prompt: 'p' })).toBeNull()
  })
})

import { describe, test, expect, vi } from 'vitest'
import { fetchTitle } from './enrich.js'

function mockClient(response) {
  return { functions: { invoke: vi.fn(() => Promise.resolve(response)) } }
}

describe('fetchTitle', () => {
  test('returns title from the enrich function', async () => {
    const client = mockClient({ data: { title: 'A Site', site: 'a.com' }, error: null })
    const result = await fetchTitle(client, 'https://a.com')
    expect(client.functions.invoke).toHaveBeenCalledWith('enrich', { body: { url: 'https://a.com' } })
    expect(result).toBe('A Site')
  })

  test('returns null when the function errors (never throws)', async () => {
    const client = mockClient({ data: null, error: { message: 'boom' } })
    const result = await fetchTitle(client, 'https://a.com')
    expect(result).toBeNull()
  })

  test('returns null when data has no title', async () => {
    const client = mockClient({ data: { title: null, site: 'a.com' }, error: null })
    expect(await fetchTitle(client, 'https://a.com')).toBeNull()
  })
})

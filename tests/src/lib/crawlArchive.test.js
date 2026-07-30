import { test, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/lib/supabaseClient.js', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

const { supabase } = await import('../../../src/lib/supabaseClient.js')
const { crawlArchive } = await import('../../../src/lib/crawlArchive.js')

beforeEach(() => vi.clearAllMocks())

test('returns items and the discovery method', async () => {
  supabase.functions.invoke.mockResolvedValue({
    data: { items: [{ url: 'https://x.com/a', title: 'a' }], via: 'sitemap' },
    error: null,
  })
  const out = await crawlArchive('x.com')
  expect(out).toEqual({ items: [{ url: 'https://x.com/a', title: 'a' }], via: 'sitemap' })
  expect(supabase.functions.invoke).toHaveBeenCalledWith('crawl-archive', { body: { url: 'x.com' } })
})

test('rejects a blank url without calling the function', async () => {
  await expect(crawlArchive('   ')).rejects.toThrow('Invalid URL')
  expect(supabase.functions.invoke).not.toHaveBeenCalled()
})

// Supabase surfaces non-2xx as a generic "non-2xx status code" error; the useful
// message is in the response body. Losing it is what made the old UI ambiguous.
test('surfaces the function message rather than the generic transport error', async () => {
  supabase.functions.invoke.mockResolvedValue({
    data: null,
    error: {
      message: 'Edge Function returned a non-2xx status code',
      context: { json: async () => ({ error: 'No sitemap or feed found at this domain.' }) },
    },
  })
  await expect(crawlArchive('x.com')).rejects.toThrow('No sitemap or feed found at this domain.')
})

test('falls back to the transport message when the body has none', async () => {
  supabase.functions.invoke.mockResolvedValue({ data: null, error: { message: 'network down' } })
  await expect(crawlArchive('x.com')).rejects.toThrow('network down')
})

test('treats an empty item list as a failure, not an empty success', async () => {
  supabase.functions.invoke.mockResolvedValue({ data: { items: [], via: 'feed' }, error: null })
  await expect(crawlArchive('x.com')).rejects.toThrow(/No sitemap or feed/)
})

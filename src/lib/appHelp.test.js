import { test, expect, describe, vi } from 'vitest'

vi.mock('./ai.js', () => ({ callAI: vi.fn() }))

const { callAI } = await import('./ai.js')
const { buildAppKnowledge, looksLikeAppQuestion, askAppHelp } = await import('./appHelp.js')

describe('looksLikeAppQuestion', () => {
  test('routes operating questions to app help', () => {
    for (const q of [
      'how do I turn off the feed?',
      'where is the export button',
      'how can i revoke a token',
      'enable dark mode',
      'what does the Tidy tab do',
    ]) expect(looksLikeAppQuestion(q)).toBe(true)
  })

  // Conservative by design: library retrieval is the more common intent, so an
  // ambiguous question should fall through rather than get an app answer.
  test('leaves library questions alone', () => {
    for (const q of [
      'what did I save about rust',
      'summarize my AI notes',
      'what have I been reading lately',
      'compare my notes on transformers',
    ]) expect(looksLikeAppQuestion(q)).toBe(false)
  })
})

describe('buildAppKnowledge', () => {
  test('is derived from the registry, so it cannot drift from the UI', () => {
    const k = buildAppKnowledge({})
    expect(k).toContain('Opportunities')
    expect(k).toContain('Capture tokens')
    expect(k).toContain('Settings › modules')
  })

  test('labels maturity and tier so the model can say WHY something is hidden', () => {
    const k = buildAppKnowledge({})
    expect(k).toMatch(/Ask your library.*experimental/)
    expect(k).toMatch(/Interview.*founder only/)
  })

  test('marks what this particular user cannot currently see', () => {
    const k = buildAppKnowledge({ isVisible: (id) => id !== 'feed' })
    expect(k).toMatch(/Feed.*NOT currently visible/)
  })

  test('hides settings entries whose module is not visible', () => {
    const hidden = buildAppKnowledge({ isVisible: (id) => id !== 'career' })
    expect(hidden).not.toContain('Programs & fellowships')
    expect(buildAppKnowledge({})).toContain('Programs & fellowships')
  })
})

describe('askAppHelp', () => {
  test('grounds the model in the reference and extracts a jump target', async () => {
    callAI.mockResolvedValue('Open Settings › tokens to revoke a capture token.')
    const res = await askAppHelp({}, 'how do I revoke a token')
    expect(res.answer).toMatch(/revoke/)
    expect(res.tabs).toContain('tokens')

    const [, opts] = callAI.mock.calls[0]
    expect(opts.messages[0].content).toContain('# App reference')
    expect(opts.messages.at(-1)).toEqual({ role: 'user', content: 'how do I revoke a token' })
  })

  test('returns no jump targets when the answer names no tab', async () => {
    callAI.mockResolvedValue('That is not something the app does.')
    const res = await askAppHelp({}, 'how do I fly')
    expect(res.tabs).toEqual([])
  })
})

import { render, screen, act, waitFor } from '@testing-library/react'
import { vi, test, expect, beforeEach } from 'vitest'

vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange }) => (
    <textarea aria-label="codemirror" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

vi.mock('../../../src/components/MarkdownView.jsx', () => ({
  default: ({ children }) => <div data-testid="preview">{children}</div>,
}))

// NoteEditor resolves the uploads entitlement itself; a null client is enough
// here and keeps the attach control out of the way.
vi.mock('../../../src/lib/supabaseClient.js', () => ({ supabase: null }))

const updateTopicDoc = vi.fn().mockResolvedValue({})
vi.mock('../../../src/lib/db/topics.js', () => ({
  updateTopicDoc: (...args) => updateTopicDoc(...args),
}))

const { default: TopicDocEditor } = await import('../../../src/components/TopicDocEditor.jsx')

beforeEach(() => {
  updateTopicDoc.mockClear()
})

function type(text) {
  const ta = screen.getByLabelText('codemirror')
  // The mocked CodeMirror is a controlled textarea; fire the change React sees.
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(ta, text)
    ta.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

const props = {
  topicId: 't1',
  initialDoc: 'old',
  candidates: [],
  scopeCtxRef: { current: {} },
  onChange: () => {},
}

// 3.3 — TopicView is keyed on the topic id, so switching topics inside the
// 800 ms debounce unmounts this editor. The write must still reach the DB.
test('flushes the pending autosave when it unmounts mid-debounce', () => {
  // Fake timers with no auto-advance: the 800 ms debounce can only fire if
  // something explicitly advances it, so a save here proves the flush ran.
  vi.useFakeTimers()
  try {
    const { unmount } = render(<TopicDocEditor {...props} />)

    type('old plus what the user just typed')
    expect(updateTopicDoc).not.toHaveBeenCalled() // still inside the debounce

    unmount()

    expect(updateTopicDoc).toHaveBeenCalledTimes(1)
    expect(updateTopicDoc.mock.calls[0][2]).toBe('old plus what the user just typed')
  } finally {
    vi.useRealTimers()
  }
})

test('flushes the pending autosave on beforeunload', () => {
  vi.useFakeTimers()
  try {
    render(<TopicDocEditor {...props} />)

    type('typed then closed the tab')
    act(() => { window.dispatchEvent(new Event('beforeunload')) })

    expect(updateTopicDoc).toHaveBeenCalledTimes(1)
    expect(updateTopicDoc.mock.calls[0][2]).toBe('typed then closed the tab')
  } finally {
    vi.useRealTimers()
  }
})

test('saves once, not twice, when the debounce fires and then it unmounts', async () => {
  const { unmount } = render(<TopicDocEditor {...props} />)
  type('settled text')

  await waitFor(() => expect(updateTopicDoc).toHaveBeenCalledTimes(1), { timeout: 2000 })
  unmount()
  await new Promise((r) => setTimeout(r, 20))
  expect(updateTopicDoc).toHaveBeenCalledTimes(1)
})

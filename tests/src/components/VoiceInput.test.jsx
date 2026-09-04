import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('../../../src/lib/cleanDictation.js', () => ({ cleanDictation: vi.fn() }))

import { cleanDictation } from '../../../src/lib/cleanDictation.js'
import VoiceInput from '../../../src/components/VoiceInput.jsx'

// A hand-rolled stand-in for the platform recogniser. There is no polyfill and
// jsdom implements none of this, so the contract is asserted against a fake
// that exposes the same four hooks the real one does.
class FakeRecognition {
  constructor() {
    FakeRecognition.instances.push(this)
    this.started = 0
    this.stopped = 0
    this.aborted = 0
  }
  start() { this.started += 1 }
  stop() { this.stopped += 1 }
  abort() { this.aborted += 1 }
}
FakeRecognition.instances = []

function install(ctor = FakeRecognition, key = 'SpeechRecognition') {
  FakeRecognition.instances = []
  window[key] = ctor
}

// Shapes one `onresult` payload the way a continuous engine does: `results`
// holds every phrase of the session so far and `resultIndex` points at the
// first one that is new.
function resultEvent(resultIndex, phrases) {
  const results = phrases.map(([transcript, isFinal]) => {
    const r = [{ transcript }]
    r.isFinal = isFinal
    return r
  })
  return { resultIndex, results }
}

function latest() { return FakeRecognition.instances[FakeRecognition.instances.length - 1] }

// The engine's own end-of-session event, which the fake does not emit on its own.
async function fireEnd(rec = latest()) {
  await act(async () => { rec.onend() })
}

beforeEach(() => {
  cleanDictation.mockReset()
  cleanDictation.mockImplementation(async (_s, raw) => ({ text: raw, cleaned: true }))
})

afterEach(() => {
  delete window.SpeechRecognition
  delete window.webkitSpeechRecognition
})

describe('VoiceInput', () => {
  it('renders nothing at all when the browser has no Speech API', () => {
    // Firefox, and unevenly on mobile. A mic button that does nothing when
    // tapped is worse than none: the user assumes it heard them.
    const { container } = render(<VoiceInput onTranscript={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('uses the webkit-prefixed constructor when that is the only one', async () => {
    install(FakeRecognition, 'webkitSpeechRecognition')
    render(<VoiceInput onTranscript={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /dictate/i }))
    expect(FakeRecognition.instances).toHaveLength(1)
  })

  it('asks for a continuous session with interim results', async () => {
    // continuous:false was the reason dictation died at the first pause.
    install()
    render(<VoiceInput onTranscript={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /dictate/i }))
    expect(latest().continuous).toBe(true)
    expect(latest().interimResults).toBe(true)
  })

  it('joins two sequential final results as "a b", never "a a b"', async () => {
    // The duplication regression: the old loop walked the whole results list on
    // every event, so a continuous engine re-emitting its earlier phrases had
    // them counted again each time.
    install()
    const onTranscript = vi.fn()
    render(<VoiceInput onTranscript={onTranscript} />)
    await userEvent.click(screen.getByRole('button', { name: /dictate/i }))
    const rec = latest()
    await act(async () => { rec.onresult(resultEvent(0, [['a', true]])) })
    await act(async () => { rec.onresult(resultEvent(1, [['a', true], ['b', true]])) })
    await userEvent.click(screen.getByRole('button', { name: /stop dictation/i }))
    await fireEnd(rec)
    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('a b'))
    expect(onTranscript).not.toHaveBeenCalledWith('a a b')
  })

  it('replaces interim text rather than appending it', async () => {
    // An interim phrase is a re-guess of the same words. Appending them turned
    // "email the team" into "em email email the team".
    install()
    const onTranscript = vi.fn()
    render(<VoiceInput onTranscript={onTranscript} />)
    await userEvent.click(screen.getByRole('button', { name: /dictate/i }))
    const rec = latest()
    await act(async () => { rec.onresult(resultEvent(0, [['em', false]])) })
    expect(await screen.findByText('em')).toBeInTheDocument()
    await act(async () => { rec.onresult(resultEvent(0, [['email the team', false]])) })
    expect(await screen.findByText('email the team')).toBeInTheDocument()
    expect(screen.queryByText('em email the team')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /stop dictation/i }))
    await fireEnd(rec)
    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('email the team'))
  })

  it('restarts when the engine ends a session the user did not stop', async () => {
    // Engines end sessions on their own, mobile Safari most aggressively.
    install()
    render(<VoiceInput onTranscript={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /dictate/i }))
    const first = latest()
    await act(async () => { first.onresult(resultEvent(0, [['half a sentence', true]])) })
    await fireEnd(first)
    expect(FakeRecognition.instances).toHaveLength(2)
    expect(screen.getByRole('button', { name: /stop dictation/i })).toBeInTheDocument()
  })

  it('gives up instead of looping when the mic never produces anything', async () => {
    // An immediate end with no result, over and over, means the microphone is
    // not actually available; restarting forever would spin and re-prompt.
    install()
    render(<VoiceInput onTranscript={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /dictate/i }))
    for (let i = 0; i < 8; i += 1) {
      const rec = latest()
      if (!rec.onend) break
      await fireEnd(rec)
    }
    expect(await screen.findByText(/mic unavailable/i)).toBeInTheDocument()
    expect(FakeRecognition.instances.length).toBeLessThanOrEqual(5)
    expect(screen.getByRole('button', { name: /dictate/i })).toBeInTheDocument()
  })

  it('runs the transcript through cleanup before handing it up', async () => {
    install()
    const onTranscript = vi.fn()
    cleanDictation.mockResolvedValue({ text: 'Let us meet Wednesday.', cleaned: true })
    render(<VoiceInput onTranscript={onTranscript} supabase={{}} />)
    await userEvent.click(screen.getByRole('button', { name: /dictate/i }))
    const rec = latest()
    await act(async () => {
      rec.onresult(resultEvent(0, [["let's meet thursday no actually wednesday", true]]))
    })
    await userEvent.click(screen.getByRole('button', { name: /stop dictation/i }))
    await fireEnd(rec)
    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('Let us meet Wednesday.'))
    expect(cleanDictation).toHaveBeenCalledWith({}, "let's meet thursday no actually wednesday")
  })

  it('hands up the raw words and says so when cleanup was skipped', async () => {
    // Losing a dictation is far worse than an uncleaned one, so a failed pass
    // must be visible rather than silent.
    install()
    const onTranscript = vi.fn()
    cleanDictation.mockResolvedValue({ text: 'email the 370 staff by friday', cleaned: false })
    render(<VoiceInput onTranscript={onTranscript} />)
    await userEvent.click(screen.getByRole('button', { name: /dictate/i }))
    const rec = latest()
    await act(async () => { rec.onresult(resultEvent(0, [['email the 370 staff by friday', true]])) })
    await userEvent.click(screen.getByRole('button', { name: /stop dictation/i }))
    await fireEnd(rec)
    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('email the 370 staff by friday'))
    expect(await screen.findByText(/cleanup skipped/i)).toBeInTheDocument()
  })

  it('still hands up the words when cleanup itself throws', async () => {
    install()
    const onTranscript = vi.fn()
    cleanDictation.mockRejectedValue(new Error('boom'))
    render(<VoiceInput onTranscript={onTranscript} />)
    await userEvent.click(screen.getByRole('button', { name: /dictate/i }))
    const rec = latest()
    await act(async () => { rec.onresult(resultEvent(0, [['book the flight', true]])) })
    await userEvent.click(screen.getByRole('button', { name: /stop dictation/i }))
    await fireEnd(rec)
    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('book the flight'))
  })

  it('says so and stops listening when the mic permission is refused', async () => {
    install()
    render(<VoiceInput onTranscript={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /dictate/i }))
    await act(async () => { latest().onerror({ error: 'not-allowed' }) })
    expect(await screen.findByText(/permission denied/i)).toBeInTheDocument()
    // Back to an idle button rather than a form stuck mid-listen.
    expect(screen.getByRole('button', { name: /dictate/i })).toBeInTheDocument()
  })

  it('does not restart after a permission refusal', async () => {
    // Restarting a denied mic re-prompts forever.
    install()
    render(<VoiceInput onTranscript={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /dictate/i }))
    const rec = latest()
    await act(async () => { rec.onerror({ error: 'not-allowed' }) })
    await fireEnd(rec)
    expect(FakeRecognition.instances).toHaveLength(1)
  })

  it('stays quiet when the user simply said nothing', async () => {
    install()
    render(<VoiceInput onTranscript={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /dictate/i }))
    await act(async () => { latest().onerror({ error: 'no-speech' }) })
    await waitFor(() => {
      expect(screen.queryByText(/could not hear/i)).not.toBeInTheDocument()
    })
  })

  it('survives a constructor that throws, without breaking the form', async () => {
    install(function Broken() { throw new Error('no') })
    render(<VoiceInput onTranscript={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /dictate/i }))
    expect(await screen.findByText(/mic unavailable/i)).toBeInTheDocument()
  })

  it('releases the microphone on unmount', async () => {
    // A privacy bug, not a tidiness one: a recogniser left running holds the
    // mic open with the recording indicator lit after the view is gone.
    install()
    const { unmount } = render(<VoiceInput onTranscript={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /dictate/i }))
    unmount()
    expect(FakeRecognition.instances[0].aborted).toBe(1)
  })

  it('does not restart from a recogniser that outlives the component', async () => {
    install()
    const { unmount } = render(<VoiceInput onTranscript={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /dictate/i }))
    const rec = latest()
    unmount()
    await act(async () => { rec.onend() })
    expect(FakeRecognition.instances).toHaveLength(1)
  })
})

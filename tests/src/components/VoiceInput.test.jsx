import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
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

  it('hands the transcript up when the recogniser reports a result', async () => {
    install()
    const onTranscript = vi.fn()
    render(<VoiceInput onTranscript={onTranscript} />)
    await userEvent.click(screen.getByRole('button', { name: /dictate/i }))
    const rec = FakeRecognition.instances[0]
    rec.onresult({ results: [[{ transcript: 'email the 370 staff by friday' }]] })
    expect(onTranscript).toHaveBeenCalledWith('email the 370 staff by friday')
  })

  it('says so and stops listening when the mic permission is refused', async () => {
    install()
    render(<VoiceInput onTranscript={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /dictate/i }))
    FakeRecognition.instances[0].onerror({ error: 'not-allowed' })
    expect(await screen.findByText(/permission denied/i)).toBeInTheDocument()
    // Back to an idle button rather than a form stuck mid-listen.
    expect(screen.getByRole('button', { name: /dictate/i })).toBeInTheDocument()
  })

  it('stays quiet when the user simply said nothing', async () => {
    install()
    render(<VoiceInput onTranscript={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /dictate/i }))
    FakeRecognition.instances[0].onerror({ error: 'no-speech' })
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
})

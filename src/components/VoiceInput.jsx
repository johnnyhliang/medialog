import { useEffect, useRef, useState } from 'react'
import { cleanDictation } from '../lib/cleanDictation.js'

// Dictation for the capture field. The phone is the client where a task is
// actually remembered, and typing a sentence one-handed is the step that gets
// abandoned.
//
// Web Speech API only — no dependency, no upload, no key. On Chrome and Safari
// this is the platform's own recogniser; there is nothing here to configure and
// nothing leaves the page that the browser would not send anyway.
export function speechRecognitionCtor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

// How many times in a row the engine may end a session without ever producing a
// result before we stop restarting it. Without this the auto-restart in `onend`
// spins forever against a mic that is busy, muted or missing — a hot loop that
// re-prompts for permission and keeps the button lit while nothing is heard.
const MAX_EMPTY_RESTARTS = 3

// Renders NOTHING when the API is missing — notably Firefox, and unevenly on
// mobile browsers. A mic button that silently does nothing when tapped is worse
// than no mic button: the user assumes it heard them and moves on.
export default function VoiceInput({ onTranscript, disabled, supabase }) {
  const Ctor = speechRecognitionCtor()
  const [listening, setListening] = useState(false)
  const [error, setError] = useState(null)
  // The live, not-yet-final phrase. Shown so the user can see the mic is
  // hearing them — which is also what makes an early stop obvious instead of
  // mysterious.
  const [interim, setInterim] = useState('')
  const [cleaning, setCleaning] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const recRef = useRef(null)
  // Everything the engine has marked `isFinal` this session. Kept in a ref
  // because `onresult` fires from outside React's update cycle and would
  // otherwise accumulate against a stale closure.
  const committedRef = useRef('')
  const interimRef = useRef('')
  // Set the moment the user asks to stop, so the `onend` handler can tell a
  // deliberate stop from the engine giving up on its own.
  const stoppingRef = useRef(false)
  const emptyRestartsRef = useRef(0)
  const finalizedRef = useRef(false)

  // Stopping on unmount is a privacy fix, not tidiness: a recogniser left
  // running holds the microphone open, and on a PWA that survives navigating
  // away from the capture view with the browser's recording indicator lit.
  useEffect(() => {
    return () => {
      const rec = recRef.current
      recRef.current = null
      // Blocks the auto-restart: an unmounted component must not resurrect the
      // microphone from inside its own `onend`.
      stoppingRef.current = true
      finalizedRef.current = true
      if (!rec) return
      try { rec.abort() } catch { /* already dead; nothing to release */ }
    }
  }, [])

  if (!Ctor) return null

  // Hand the words up, cleaned if the AI is reachable and raw if it is not.
  // Never awaited by the caller and never gated on `disabled`: cleanup is a
  // second or two of network, and freezing the mic button or the textarea for
  // it would cost more than the punctuation is worth.
  async function finalize() {
    if (finalizedRef.current) return
    finalizedRef.current = true
    const raw = `${committedRef.current} ${interimRef.current}`.replace(/\s+/g, ' ').trim()
    committedRef.current = ''
    interimRef.current = ''
    setInterim('')
    if (!raw) return
    setCleaning(true)
    setSkipped(false)
    try {
      const { text, cleaned } = await cleanDictation(supabase, raw)
      setSkipped(!cleaned)
      onTranscript?.(text)
    } catch {
      // cleanDictation already falls back to raw internally; this is the last
      // guard so a throw here can never be the reason a dictation vanishes.
      setSkipped(true)
      onTranscript?.(raw)
    } finally {
      setCleaning(false)
    }
  }

  function stop() {
    const rec = recRef.current
    recRef.current = null
    stoppingRef.current = true
    setListening(false)
    if (!rec) { finalize(); return }
    try {
      rec.stop()
    } catch {
      // No `onend` is coming from a recogniser that refused to stop, so the
      // words have to be flushed here or they are lost.
      finalize()
    }
  }

  function start() {
    if (recRef.current) { stop(); return }
    setError(null)
    setSkipped(false)
    committedRef.current = ''
    interimRef.current = ''
    setInterim('')
    stoppingRef.current = false
    finalizedRef.current = false
    emptyRestartsRef.current = 0

    const rec = build()
    if (!rec) return
    recRef.current = rec
    setListening(true)
  }

  // Builds and starts one recogniser session. Called again from `onend` for the
  // restarts, so the handlers live here rather than in `start`.
  function build() {
    let rec
    try {
      rec = new Ctor()
    } catch {
      // Constructible but unusable happens on some embedded webviews. Fail to
      // typing rather than to a broken form.
      setError('mic unavailable')
      return null
    }
    rec.lang = typeof navigator !== 'undefined' ? (navigator.language || 'en-US') : 'en-US'
    // Interim results are what let the user watch the transcript build; without
    // them a session that ends early looks identical to one that heard nothing.
    rec.interimResults = true
    // `false` here was the reason dictation stopped mid-sentence: the engine
    // ends the session at the first natural pause.
    rec.continuous = true

    rec.onresult = (event) => {
      // Only from `resultIndex` forward. Walking the whole `event.results` list
      // re-reads every phrase already committed — under continuous recognition
      // each new event re-emits its predecessors, which is what produced
      // "a a b" instead of "a b".
      let freshInterim = ''
      try {
        for (let i = event.resultIndex ?? 0; i < event.results.length; i += 1) {
          const result = event.results[i]
          const said = result?.[0]?.transcript || ''
          if (result?.isFinal) {
            committedRef.current = `${committedRef.current} ${said}`.replace(/\s+/g, ' ').trimStart()
          } else {
            // Replaced, never appended: an interim phrase is a re-guess of the
            // same words, not new ones.
            freshInterim += said
          }
        }
      } catch { /* shape varies across engines; a partial transcript still helps */ }
      interimRef.current = freshInterim
      setInterim(freshInterim)
      if (committedRef.current || freshInterim) emptyRestartsRef.current = 0
    }

    rec.onerror = (event) => {
      // 'no-speech' and 'aborted' are the user saying nothing or changing their
      // mind, not failures worth a message.
      const code = event?.error
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setError('mic permission denied')
        // A denied permission will never succeed on retry; restarting would
        // just re-prompt in a loop.
        stoppingRef.current = true
      } else if (code && code !== 'no-speech' && code !== 'aborted') {
        setError('could not hear that')
        stoppingRef.current = true
      }
      // 'no-speech' is the only code worth restarting after: the user paused
      // longer than the engine's patience, which is exactly the case continuous
      // mode exists for. Everything else has already failed once and would fail
      // the same way again.
      if (code !== 'no-speech') {
        stoppingRef.current = true
        setListening(false)
      }
    }

    rec.onend = () => {
      // Engines end sessions on their own — mobile Safari does it aggressively
      // — so a stop the user did not ask for is a restart, not the end of the
      // dictation.
      if (stoppingRef.current || recRef.current !== rec) {
        recRef.current = null
        setListening(false)
        finalize()
        return
      }
      emptyRestartsRef.current += 1
      if (emptyRestartsRef.current > MAX_EMPTY_RESTARTS) {
        // Ending immediately with nothing heard, over and over, means the mic
        // is not actually available. Give up rather than spin.
        recRef.current = null
        setListening(false)
        setError('mic unavailable')
        finalize()
        return
      }
      const next = build()
      if (!next) {
        recRef.current = null
        setListening(false)
        finalize()
        return
      }
      recRef.current = next
    }

    try {
      rec.start()
    } catch {
      setError('mic unavailable')
      return null
    }
    return rec
  }

  return (
    <>
      <button
        type="button"
        className={`toggle-btn${listening ? ' active' : ''}`}
        aria-label={listening ? 'stop dictation' : 'dictate'}
        aria-pressed={listening}
        disabled={disabled}
        onClick={() => (listening ? stop() : start())}
      >
        {listening ? '● Listening' : '🎤'}
      </button>
      {interim && (
        <span aria-live="polite" style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>{interim}</span>
      )}
      {cleaning && (
        <span role="status" style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>tidying up…</span>
      )}
      {skipped && !cleaning && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>cleanup skipped — raw transcript</span>
      )}
      {error && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>{error}</span>
      )}
    </>
  )
}

import { useEffect, useRef, useState } from 'react'

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

// Renders NOTHING when the API is missing — notably Firefox, and unevenly on
// mobile browsers. A mic button that silently does nothing when tapped is worse
// than no mic button: the user assumes it heard them and moves on.
export default function VoiceInput({ onTranscript, disabled }) {
  const Ctor = speechRecognitionCtor()
  const [listening, setListening] = useState(false)
  const [error, setError] = useState(null)
  const recRef = useRef(null)

  // Stopping on unmount is a privacy fix, not tidiness: a recogniser left
  // running holds the microphone open, and on a PWA that survives navigating
  // away from the capture view with the browser's recording indicator lit.
  useEffect(() => {
    return () => {
      const rec = recRef.current
      recRef.current = null
      if (!rec) return
      try { rec.abort() } catch { /* already dead; nothing to release */ }
    }
  }, [])

  if (!Ctor) return null

  function stop() {
    const rec = recRef.current
    recRef.current = null
    setListening(false)
    if (!rec) return
    try { rec.stop() } catch { /* no-op */ }
  }

  function start() {
    if (recRef.current) { stop(); return }
    setError(null)
    let rec
    try {
      rec = new Ctor()
    } catch {
      // Constructible but unusable happens on some embedded webviews. Fail to
      // typing rather than to a broken form.
      setError('mic unavailable')
      return
    }
    rec.lang = typeof navigator !== 'undefined' ? (navigator.language || 'en-US') : 'en-US'
    rec.interimResults = false
    rec.continuous = false
    rec.onresult = (event) => {
      let said = ''
      try {
        for (const result of event.results) said += result[0]?.transcript || ''
      } catch { /* shape varies across engines; a partial transcript still helps */ }
      if (said.trim()) onTranscript?.(said.trim())
    }
    rec.onerror = (event) => {
      // 'no-speech' and 'aborted' are the user saying nothing or changing their
      // mind, not failures worth a message.
      const code = event?.error
      if (code === 'not-allowed' || code === 'service-not-allowed') setError('mic permission denied')
      else if (code && code !== 'no-speech' && code !== 'aborted') setError('could not hear that')
      recRef.current = null
      setListening(false)
    }
    rec.onend = () => {
      recRef.current = null
      setListening(false)
    }
    try {
      rec.start()
    } catch {
      setError('mic unavailable')
      return
    }
    recRef.current = rec
    setListening(true)
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
      {error && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>{error}</span>
      )}
    </>
  )
}

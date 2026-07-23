import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, CornerDownLeft, Loader2 } from 'lucide-react'
import { askLibrarian } from '../lib/db/librarian.js'

// Cursor-style docked assistant. Collapsed to a thin edge tab; expands to a
// right-hand panel that answers questions from the user's own notes with
// citations. Never covers the main content — it docks, it doesn't overlay.
//
// Renders citation numbers [n] as clickable chips that open the source entry.

function renderWithCitations(text, sources, onOpen) {
  // Split on [n] markers, turn valid ones into buttons that open the entry.
  const parts = String(text).split(/(\[\d+\])/g)
  return parts.map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/)
    if (!m) return <span key={i}>{part}</span>
    const n = Number(m[1])
    const src = sources.find((s) => s.n === n)
    if (!src) return <span key={i}>{part}</span>
    return (
      <button
        key={i}
        className="asst-cite"
        title={src.title}
        onClick={() => onOpen?.(src)}
      >
        {n}
      </button>
    )
  })
}

export default function AssistantPanel({ supabase, onOpenEntry, onClose }) {
  const [messages, setMessages] = useState([]) // {role, content, sources?}
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const el = scrollRef.current
    // guard: jsdom (tests) has no scrollTo
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, busy])

  async function send() {
    const q = input.trim()
    if (!q || busy) return
    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, { role: 'user', content: q }])
    setInput('')
    setBusy(true)
    try {
      const res = await askLibrarian(supabase, q, { history })
      setMessages((prev) => [...prev, { role: 'assistant', content: res.answer, sources: res.sources }])
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Something went wrong: ${e.message}`, sources: [] }])
    }
    setBusy(false)
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <aside className="asst-panel" aria-label="Library assistant">
      <header className="asst-head">
        <span className="asst-title"><Sparkles size={14} /> Ask your library</span>
        <button className="asst-close" onClick={onClose} aria-label="Close assistant"><X size={15} /></button>
      </header>

      <div className="asst-scroll" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="asst-empty">
            <p>Ask anything about what you’ve written.</p>
            <ul>
              <li>“what did I conclude about market making?”</li>
              <li>“summarize what I know about RAG”</li>
              <li>“where did I write about spaced repetition?”</li>
            </ul>
            <p className="asst-empty-note">Answers come only from your notes, with citations you can click.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`asst-msg asst-msg--${m.role}`}>
            <div className="asst-bubble">
              {m.role === 'assistant'
                ? renderWithCitations(m.content, m.sources ?? [], onOpenEntry)
                : m.content}
            </div>
            {m.role === 'assistant' && m.sources?.length > 0 && (
              <div className="asst-sources">
                {m.sources.map((s) => (
                  <button key={s.n} className="asst-source" onClick={() => onOpenEntry?.(s)} title={s.heading || s.title}>
                    <span className="asst-source-n">{s.n}</span>{s.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="asst-msg asst-msg--assistant">
            <div className="asst-bubble asst-thinking"><Loader2 size={14} className="asst-spin" /> searching your notes…</div>
          </div>
        )}
      </div>

      <div className="asst-input">
        <textarea
          ref={inputRef}
          rows={1}
          placeholder="Ask your library…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button className="asst-send" onClick={send} disabled={busy || !input.trim()} aria-label="Send">
          <CornerDownLeft size={15} />
        </button>
      </div>
    </aside>
  )
}

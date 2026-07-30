import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, CornerDownLeft, Loader2, Plus, History, Trash2 } from 'lucide-react'
import { askLibrarian } from '../lib/db/librarian.js'
import { askAppHelp, looksLikeAppQuestion } from '../lib/appHelp.js'
import {
  listConversations, createConversation, listMessages, addMessage,
  touchConversation, deleteConversation, titleFromQuestion,
} from '../lib/db/conversations.js'

// Cursor-style docked assistant. Collapsed to a thin edge tab; expands to a
// right-hand panel that answers questions from the user's own notes with
// citations. Never covers the main content — it docks, it doesn't overlay.
//
// Conversations persist in Supabase (migration 0049) so threads survive reloads
// and sync across devices. All persistence is best-effort: if the DB call fails
// (or supabase isn't wired, as in tests) the chat still works in-memory.
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

export default function AssistantPanel({ supabase, onOpenEntry, onClose, isModuleVisible = () => true }) {
  const [messages, setMessages] = useState([]) // {role, content, sources?}
  const [conversationId, setConversationId] = useState(null)
  const [conversations, setConversations] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Load the saved thread list (best-effort).
  useEffect(() => {
    if (!supabase?.from) return
    listConversations(supabase).then(setConversations).catch(() => {})
  }, [supabase])

  useEffect(() => {
    const el = scrollRef.current
    // guard: jsdom (tests) has no scrollTo
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, busy])

  function newChat() {
    setMessages([])
    setConversationId(null)
    setShowHistory(false)
    inputRef.current?.focus()
  }

  async function openConversation(id) {
    setShowHistory(false)
    try {
      const msgs = await listMessages(supabase, id)
      setMessages(msgs.map((m) => ({ role: m.role, content: m.content, sources: m.sources })))
      setConversationId(id)
    } catch { /* leave current thread as-is */ }
  }

  async function removeConversation(id, e) {
    e.stopPropagation()
    try { await deleteConversation(supabase, id) } catch { /* best-effort */ }
    setConversations((prev) => prev.filter((c) => c.id !== id))
    if (id === conversationId) newChat()
  }

  // Move a thread to the top of the list after it gets a new message.
  function bumpConversation(id) {
    setConversations((prev) => {
      const found = prev.find((c) => c.id === id)
      if (!found) return prev
      const rest = prev.filter((c) => c.id !== id)
      return [{ ...found, updated_at: new Date().toISOString() }, ...rest]
    })
  }

  async function send() {
    const q = input.trim()
    if (!q || busy) return
    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, { role: 'user', content: q }])
    setInput('')
    setBusy(true)

    // Ensure a persisted conversation exists, then save the question.
    let convId = conversationId
    try {
      if (!convId && supabase?.from) {
        const conv = await createConversation(supabase, titleFromQuestion(q))
        convId = conv.id
        setConversationId(convId)
        setConversations((prev) => [conv, ...prev])
      }
      if (convId) await addMessage(supabase, convId, { role: 'user', content: q })
    } catch { /* persistence is best-effort */ }

    try {
      // Two different questions wear the same input box: "what did I save about
      // X" is retrieval over notes; "how do I turn off X" is about the app. The
      // router is conservative — anything ambiguous falls through to the library,
      // which is the more common intent.
      const res = looksLikeAppQuestion(q)
        ? await askAppHelp(supabase, q, { isVisible: isModuleVisible, history })
        : await askLibrarian(supabase, q, { history })
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: res.answer,
        sources: res.sources ?? [],
        tabs: res.tabs ?? [],
      }])
      try {
        if (convId) {
          await addMessage(supabase, convId, { role: 'assistant', content: res.answer, sources: res.sources })
          await touchConversation(supabase, convId)
          bumpConversation(convId)
        }
      } catch { /* best-effort */ }
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
        <div className="asst-head-actions">
          <button
            className={`asst-icon-btn${showHistory ? ' is-active' : ''}`}
            onClick={() => setShowHistory((v) => !v)}
            aria-label="Conversation history"
            title="Conversation history"
          >
            <History size={15} />
          </button>
          <button className="asst-icon-btn" onClick={newChat} aria-label="New chat" title="New chat">
            <Plus size={15} />
          </button>
          <button className="asst-close" onClick={onClose} aria-label="Close assistant"><X size={15} /></button>
        </div>
      </header>

      {showHistory && (
        <div className="asst-history">
          {conversations.length === 0 ? (
            <p className="asst-history-empty muted">No saved conversations yet.</p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`asst-history-row${c.id === conversationId ? ' is-active' : ''}`}
                onClick={() => openConversation(c.id)}
              >
                <span className="asst-history-title">{c.title}</span>
                <button
                  className="asst-history-del"
                  onClick={(e) => removeConversation(c.id, e)}
                  aria-label={`Delete ${c.title}`}
                  title="Delete conversation"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

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

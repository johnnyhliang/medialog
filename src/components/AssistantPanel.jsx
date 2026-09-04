import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, CornerDownLeft, Loader2, Plus, History, Trash2 } from 'lucide-react'
import { askLibrarian } from '../lib/db/librarian.js'
import { askAppHelp, looksLikeAppQuestion } from '../lib/appHelp.js'
import {
  listConversations, createConversation, listMessages, addMessage,
  touchConversation, deleteConversation, titleFromQuestion,
} from '../lib/db/conversations.js'
import ConfirmModal from './ConfirmModal.jsx'
import VoiceInput from './VoiceInput.jsx'
import { routeMessage } from '../lib/parseTask.js'
import { createEntry, setDueDate, updateEntry } from '../lib/db/entries.js'
import { endOfLocalDay, resolveTimezone } from '../lib/timezone.js'
import { readPref } from '../lib/localPref.js'

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

export default function AssistantPanel({ supabase, onOpenEntry, onClose, onOpenSettings, isModuleVisible = () => true, inboxTopicId = null, onCaptured }) {
  const [messages, setMessages] = useState([]) // {role, content, sources?}
  const [conversationId, setConversationId] = useState(null)
  const [conversations, setConversations] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  // Which path the in-flight question took, so the spinner tells the truth. Since
  // the app-help router landed, 'searching your notes' was wrong for app questions.
  const [mode, setMode] = useState('library')
  // A capture the router extracted but has NOT written yet: { title, dueDate,
  // question, convId }. It sits in the stream as an editable card because a
  // wrong date committed silently is worse than no date — it surfaces on the
  // agenda as truth and nobody re-reads it.
  const [pendingCapture, setPendingCapture] = useState(null)
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

  // Deleting a thread is irreversible and the button sits inches from the row you
  // click to open one, so it asks first. Confirm state holds the whole conversation
  // rather than the id, so the prompt can name what is about to be lost.
  async function removeConversation() {
    const doomed = pendingDelete
    if (!doomed) return
    setPendingDelete(null)
    try { await deleteConversation(supabase, doomed.id) } catch { /* best-effort */ }
    setConversations((prev) => prev.filter((c) => c.id !== doomed.id))
    if (doomed.id === conversationId) newChat()
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

  // Persist the thread and the user's turn. Best-effort, as everywhere else in
  // this panel: a failed write must not swallow the message.
  async function ensureConversation(q) {
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
    return convId
  }

  // Append an assistant turn to the visible thread AND the stored one, so a
  // capture reads back the same as an answer when the conversation is reopened.
  async function recordAssistant(convId, msg) {
    setMessages((prev) => [...prev, msg])
    try {
      if (convId) {
        await addMessage(supabase, convId, { role: 'assistant', content: msg.content, sources: msg.sources ?? [] })
        await touchConversation(supabase, convId)
        bumpConversation(convId)
      }
    } catch { /* best-effort */ }
  }

  async function send() {
    const q = input.trim()
    if (!q || busy || pendingCapture) return
    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    const asked = looksLikeAppQuestion(q) ? 'app' : 'library'
    setMode(asked)
    setMessages((prev) => [...prev, { role: 'user', content: q }])
    setInput('')
    setBusy(true)

    const convId = await ensureConversation(q)

    // One call decides the fork AND extracts the fields — routing separately
    // would double the latency and cost of every message typed here.
    //
    // `routeMessage` answers 'ask' for everything it is not sure about,
    // including an AI provider that is not configured at all. That asymmetry is
    // the point: a misrouted question costs a retry, a misrouted capture writes
    // a row the user has to hunt down and delete.
    const tz = resolveTimezone(readPref('medialog_timezone', null))
    const routed = await routeMessage(supabase, q, { tz })
    if (routed?.intent === 'capture' && inboxTopicId) {
      setPendingCapture({ title: routed.title, dueDate: routed.dueDate || '', question: q, history, convId })
      setBusy(false)
      return
    }

    await runAsk(q, history, asked, convId)
  }

  async function runAsk(q, history, asked, convId) {
    setMode(asked)
    setBusy(true)
    try {
      // Two different questions wear the same input box: "what did I save about
      // X" is retrieval over notes; "how do I turn off X" is about the app. The
      // router is conservative — anything ambiguous falls through to the library,
      // which is the more common intent.
      const res = await (asked === 'app'
        ? askAppHelp(supabase, q, { isVisible: isModuleVisible, history })
        : askLibrarian(supabase, q, { history })) ?? {}
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: res.answer,
        sources: res.sources ?? [],
        tabs: res.tabs ?? [],
        mode: asked,
        // Carried so the bubble can say the machinery failed. Without it a
        // "couldn't reach the search service" answer looks identical to a
        // grounded one, which is the same lie one layer up.
        error: Boolean(res.error),
      }])
      try {
        if (convId) {
          await addMessage(supabase, convId, { role: 'assistant', content: res.answer, sources: res.sources })
          await touchConversation(supabase, convId)
          bumpConversation(convId)
        }
      } catch { /* best-effort */ }
    } catch (e) {
      // askLibrarian shapes retrieval outages into a normal result, but the
      // app-help path, the persistence calls and anything added later can still
      // reject — so this stays as the last line of defence. DbError.message is
      // the raw cause (see db/unwrap.js), so it reads as a real reason here.
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `Something went wrong: ${e.message}`,
        sources: [],
        error: true,
      }])
    } finally {
      // finally, not a trailing statement: a throw from anywhere above used to
      // be able to leave the spinner running for the rest of the session.
      setBusy(false)
    }
  }

  // The user has looked at the title and the date and said yes.
  //
  // `createEntry` is given the task as the NOTE, not as a title: a note-derived
  // title is a mirrored one, and passing a title instead would set
  // `title_edited` and freeze it against every later edit. See db/entries.js.
  //
  // The date goes through `endOfLocalDay`, never `new Date(str)` — the latter
  // reads a bare 'YYYY-MM-DD' as UTC midnight and lands the deadline on the
  // previous day for everyone west of Greenwich.
  async function confirmCapture() {
    const cap = pendingCapture
    if (!cap || busy) return
    setBusy(true)
    const tz = resolveTimezone(readPref('medialog_timezone', null))
    const dueAt = cap.dueDate ? endOfLocalDay(cap.dueDate, tz) : null
    try {
      const entry = await createEntry(supabase, { topicId: inboxTopicId, note: cap.title })
      // An estimate is what makes the task countable at the weekly review:
      // review_week sums estimates against available hours, and anything without
      // one falls back to a flat hour. Captured tasks would otherwise all weigh
      // the same, which is exactly the case feasibility is meant to catch.
      // Column added in migration 0083; best-effort, since losing an estimate
      // must not cost the user the task.
      if (cap.estimateMinutes) {
        try { await updateEntry(supabase, entry.id, { estimate_minutes: cap.estimateMinutes }) } catch { /* the task matters more */ }
      }
      if (dueAt) {
        // A failed date must not lose the task the user just confirmed, so it
        // only costs a line in the reply.
        try { await setDueDate(supabase, entry.id, dueAt) }
        catch { await recordAssistant(cap.convId, { role: 'assistant', content: 'Saved to Inbox, but the due date did not stick.', sources: [], error: true }) }
      }
      setPendingCapture(null)
      onCaptured?.(entry)
      await recordAssistant(cap.convId, {
        role: 'assistant',
        content: cap.dueDate ? `Saved to Inbox: ${cap.title} — due ${cap.dueDate}.` : `Saved to Inbox: ${cap.title}.`,
        sources: [],
      })
    } catch (e) {
      // The card stays on screen with the text intact so the user can retry.
      await recordAssistant(cap.convId, {
        role: 'assistant',
        content: `Couldn't save that: ${e.message}`,
        sources: [],
        error: true,
      })
    } finally {
      setBusy(false)
    }
  }

  // "That was a question" — the escape hatch from a misroute. It runs the
  // original words down the normal path rather than making the user retype.
  async function captureToQuestion() {
    const cap = pendingCapture
    if (!cap) return
    setPendingCapture(null)
    await runAsk(cap.question, cap.history, looksLikeAppQuestion(cap.question) ? 'app' : 'library', cap.convId)
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
                  onClick={(e) => { e.stopPropagation(); setPendingDelete(c) }}
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
            {m.role === 'assistant' && m.error && (
              <div className="asst-mode" role="status">couldn’t reach the service — this is not a statement about your notes</div>
            )}
            {m.role === 'assistant' && !m.error && m.mode === 'app' && (
              <div className="asst-mode">answered from the app guide, not your notes</div>
            )}
            {m.role === 'assistant' && m.tabs?.length > 0 && onOpenSettings && (
              <div className="asst-tabs">
                {m.tabs.map((t) => (
                  <button key={t} onClick={() => onOpenSettings(t)}>open Settings › {t}</button>
                ))}
              </div>
            )}
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
        {pendingCapture && (
          <div className="asst-msg asst-msg--assistant">
            <div className="asst-bubble">
              <p style={{ margin: '0 0 6px' }}>That reads like a task. Check it, then save:</p>
              <input
                aria-label="task title"
                value={pendingCapture.title}
                maxLength={200}
                style={{ width: '100%', marginBottom: 6 }}
                onChange={(e) => setPendingCapture((p) => ({ ...p, title: e.target.value }))}
              />
              <input
                type="date"
                aria-label="due date"
                value={pendingCapture.dueDate}
                onChange={(e) => setPendingCapture((p) => ({ ...p, dueDate: e.target.value }))}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button className="btn-small" disabled={busy || !pendingCapture.title.trim()} onClick={confirmCapture}>
                  Save to Inbox
                </button>
                <button className="btn-small btn-ghost" onClick={captureToQuestion}>Answer it instead</button>
                <button className="btn-small btn-ghost" onClick={() => setPendingCapture(null)}>Discard</button>
              </div>
            </div>
          </div>
        )}
        {busy && !pendingCapture && (
          <div className="asst-msg asst-msg--assistant">
            <div className="asst-bubble asst-thinking">
              <Loader2 size={14} className="asst-spin" />
              {mode === 'app' ? ' checking how the app works…' : ' searching your notes…'}
            </div>
          </div>
        )}
      </div>

      <div className="asst-input">
        <textarea
          ref={inputRef}
          rows={1}
          placeholder="Ask your library, or say what you need to do…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {/* Lands in the box, never sent. Cleanup is a model pass over the
            user's words and a wrong guess must be visible and editable before
            it becomes a captured task. `disabled` is not tied to the cleanup
            pass — that runs inside VoiceInput and must not freeze typing. */}
        <VoiceInput
          supabase={supabase}
          onTranscript={(t) => setInput((prev) => (prev ? `${prev} ${t}` : t))}
          disabled={busy}
        />
        <button className="asst-send" onClick={send} disabled={busy || !input.trim()} aria-label="Send">
          <CornerDownLeft size={15} />
        </button>
      </div>

      {pendingDelete && (
        <ConfirmModal
          message={`Delete “${pendingDelete.title}”? This conversation and its messages are gone for good.`}
          confirmLabel="Delete"
          onConfirm={removeConversation}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </aside>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import TopicDocEditor from './TopicDocEditor.jsx'
import MarkdownView from './MarkdownView.jsx'
import EntryList from './EntryList.jsx'
import QuickAdd from './QuickAdd.jsx'
import ReturnButton from './ReturnButton.jsx'
import { fuzzyFind } from '../lib/fuzzyFind.js'
import { extractEmbedIds } from '../lib/embeds.js'

const SCOPES = [
  { value: 'topic', label: 'This topic' },
  { value: 'doc', label: 'This doc' },
  { value: 'all', label: 'Everything' },
]

export default function TopicView({
  topic, entries, allCandidates, topics,
  onAddEntry, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave, onPreview, onDocChange,
  onNoteVersion, onShowHistory,
  onSearchAll, globalSearchResults,
  onTitleChange, onMove,
}) {
  const storageKey = `medialog_topic_view_${topic.id}`
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) return saved
    } catch {}
    return topic.master_doc ? 'doc' : 'list'
  })
  const [docEditing, setDocEditing] = useState(false)
  const [liveDoc, setLiveDoc] = useState(topic.master_doc || '')
  const [inputVal, setInputVal] = useState('')
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('topic')
  const [returnY, setReturnY] = useState(null)

  const scopeCtxRef = useRef({ scope: 'topic', currentTopicId: topic.id })

  const moveTargets = (topics || []).filter((t) => t.id !== topic.id)

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setQuery(inputVal), 120)
    return () => clearTimeout(t)
  }, [inputVal])

  // Fire global search when scope='all' and query changes
  useEffect(() => {
    if (scope === 'all' && onSearchAll) {
      onSearchAll(query)
    }
  }, [scope, query, onSearchAll])

  function setView(next) {
    setMode(next)
    try { localStorage.setItem(storageKey, next) } catch {}
  }

  const getEntry = useMemo(() => {
    const byId = new Map(entries.map((e) => [e.id, e]))
    return (id) => byId.get(id) || null
  }, [entries])

  const docEmbedIds = useMemo(() => new Set(extractEmbedIds(liveDoc)), [liveDoc])

  const filtered = useMemo(() => {
    if (scope === 'all') {
      return globalSearchResults ?? fuzzyFind(query, entries, ['title', 'note'])
    }
    let pool = scope === 'doc' ? entries.filter((e) => docEmbedIds.has(e.id)) : entries
    return fuzzyFind(query, pool, ['title', 'note'])
  }, [entries, query, scope, docEmbedIds, globalSearchResults])

  function handleJump(entryId) {
    setReturnY(window.scrollY)
    const el = document.getElementById(`entry-${entryId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('jump-highlight')
      setTimeout(() => el.classList.remove('jump-highlight'), 1500)
    }
  }

  function handleReturn() {
    if (returnY != null) window.scrollTo({ top: returnY, behavior: 'smooth' })
    setReturnY(null)
  }

  function handleDocChange(next) {
    setLiveDoc(next)
    onDocChange(next)
  }

  return (
    <>
      <div className="topic-header">
        <h2>{topic.name}</h2>
        <div className="view-toggle">
          <button className={mode === 'doc' ? 'active' : ''} onClick={() => setView('doc')}>Doc</button>
          <button className={mode === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button>
        </div>
      </div>

      {mode === 'doc' && (
        <div className="master-doc">
          {(docEditing || !liveDoc.trim()) ? (
            <TopicDocEditor
              topicId={topic.id}
              initialDoc={topic.master_doc || ''}
              candidates={allCandidates}
              scopeCtxRef={scopeCtxRef}
              onChange={handleDocChange}
            />
          ) : (
            <div onClick={() => setDocEditing(true)} style={{ cursor: 'text' }}>
              <MarkdownView getEntry={getEntry} onJump={handleJump} onPreview={onPreview}>
                {liveDoc}
              </MarkdownView>
            </div>
          )}
        </div>
      )}

      <div className="search-scope">
        <input
          className="searchbar"
          type="search"
          placeholder="Search…"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
        />
        <select value={scope} onChange={(e) => setScope(e.target.value)}>
          {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {!query && <QuickAdd onAdd={onAddEntry} disabled={false} />}

      <EntryList
        entries={filtered}
        onDelete={onDelete}
        onStatusChange={onStatusChange}
        onTagsChange={onTagsChange}
        onTogglePin={onTogglePin}
        onNoteSave={onNoteSave}
        onPreview={onPreview}
        onNoteVersion={onNoteVersion}
        onShowHistory={onShowHistory}
        onTitleChange={onTitleChange}
        moveTargets={moveTargets}
        onMove={onMove}
      />

      {returnY != null && <ReturnButton onReturn={handleReturn} />}
    </>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import TopicDocEditor from './TopicDocEditor.jsx'
import MarkdownView from './MarkdownView.jsx'
import EntryList from './EntryList.jsx'
import QuickAdd from './QuickAdd.jsx'
import ReturnButton from './ReturnButton.jsx'
import ArchiveSection from './ArchiveSection.jsx'
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
  onTitleChange, onMove, tagColors,
  allTags = [],
  pendingArchiveIds = new Set(),
  supabase,
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
  const [searchFocused, setSearchFocused] = useState(false)
  const [docWidth, setDocWidth] = useState(() => {
    try { return localStorage.getItem('medialog_doc_width') || 'readable' } catch { return 'readable' }
  })
  const [cardMinWidth, setCardMinWidth] = useState(() => {
    try { return Number(localStorage.getItem('medialog_card_min_width')) || 200 } catch { return 200 }
  })

  function setDocWidthAndSave(w) {
    setDocWidth(w)
    try { localStorage.setItem('medialog_doc_width', w) } catch {}
  }

  const scopeCtxRef = useRef({ scope: 'topic', currentTopicId: topic.id })

  const moveTargets = (topics || []).filter((t) => t.id !== topic.id)

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setQuery(inputVal), 120)
    return () => clearTimeout(t)
  }, [inputVal])

  // Tag search derived state (use inputVal for immediacy, not debounced query)
  const isTagSearch = inputVal.toLowerCase().startsWith('tag:')
  const tagSearchTerm = isTagSearch ? inputVal.slice(4).toLowerCase().trim() : ''

  // Reset tag suggestion limit when leaving tag search
  useEffect(() => {
    if (!isTagSearch) setTagSuggestLimit(20)
  }, [isTagSearch])

  const [tagSuggestLimit, setTagSuggestLimit] = useState(20)

  const tagSuggestions = useMemo(() => {
    if (!isTagSearch) return []
    return (allTags || [])
      .filter(t => !tagSearchTerm || t.name.toLowerCase().includes(tagSearchTerm))
      .slice(0, tagSuggestLimit)
  }, [isTagSearch, tagSearchTerm, allTags, tagSuggestLimit])

  const filteredByTag = useMemo(() => {
    if (!isTagSearch) return null
    if (!tagSearchTerm) return entries // tag: with no term → show all, don't fuzzy-search "tag:"
    return entries.filter(e => (e.tags || []).some(t => t.toLowerCase().includes(tagSearchTerm)))
  }, [isTagSearch, tagSearchTerm, entries])

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
    let result
    if (filteredByTag !== null) {
      result = filteredByTag
    } else if (scope === 'all') {
      result = globalSearchResults ?? fuzzyFind(query, entries, ['title', 'url', 'note'])
    } else {
      let pool = scope === 'doc' ? entries.filter((e) => docEmbedIds.has(e.id)) : entries
      result = fuzzyFind(query, pool, ['title', 'url', 'note'])
    }
    // Hide done entries unless they're pending archive (timer still running)
    return result.filter(e => e.status !== 'done' || pendingArchiveIds.has(e.id))
  }, [entries, query, scope, docEmbedIds, globalSearchResults, filteredByTag, pendingArchiveIds])

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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {mode === 'doc' && (
            <div className="doc-width-btns">
              {[
                { key: 'narrow',   label: 'S' },
                { key: 'readable', label: 'M' },
                { key: 'wide',     label: 'L' },
                { key: 'full',     label: '∞' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  className={docWidth === key ? 'active' : ''}
                  onClick={() => setDocWidthAndSave(key)}
                  title={key}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {mode === 'list' && (
            <div className="card-density-ctrl" title="Card size">
              <input
                type="range"
                min={130}
                max={400}
                step={10}
                value={cardMinWidth}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setCardMinWidth(v)
                  try { localStorage.setItem('medialog_card_min_width', String(v)) } catch {}
                }}
                aria-label="Card size"
              />
            </div>
          )}
          <div className="view-toggle">
            <button className={mode === 'doc' ? 'active' : ''} onClick={() => setView('doc')}>Doc</button>
            <button className={mode === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button>
          </div>
        </div>
      </div>

      {mode === 'doc' && (
        <div className={`master-doc doc-width-${docWidth}`}>
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
        <div className={`searchbar-wrap${isTagSearch ? ' tag-mode' : ''}`}>
          {isTagSearch && <span className="tag-mode-pill">tag:</span>}
          <input
            className="searchbar"
            type="search"
            placeholder="Search…"
            value={isTagSearch ? inputVal.slice(4) : inputVal}
            onChange={(e) => setInputVal(isTagSearch ? `tag:${e.target.value}` : e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && isTagSearch && tagSearchTerm === '') {
                e.preventDefault()
                setInputVal('')
              }
            }}
          />
          {isTagSearch && (
            <button
              className="tag-mode-clear"
              aria-label="Exit tag search"
              onMouseDown={(e) => { e.preventDefault(); setInputVal(''); setSearchFocused(false) }}
            >✕</button>
          )}
        </div>
        <select value={scope} onChange={(e) => setScope(e.target.value)}>
          {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {searchFocused && (
          <div className="tag-search-dropdown">
            {!isTagSearch && (
              <div
                className="tag-search-item tag-search-trigger"
                onMouseDown={(e) => { e.preventDefault(); setInputVal('tag:'); setSearchFocused(true) }}
              >
                <span className="tag-mode-pill tag-mode-pill-sm">tag:</span>
                Search by tag
              </div>
            )}
            {isTagSearch && tagSuggestions.map(t => (
              <div
                key={t.id}
                className="tag-search-item"
                onMouseDown={(e) => { e.preventDefault(); setInputVal(`tag:${t.name}`) }}
              >
                {t.color && <span className="tag-color-swatch" style={{ background: t.color }} />}
                #{t.name}
              </div>
            ))}
            {isTagSearch && (allTags || []).filter(t => !tagSearchTerm || t.name.toLowerCase().includes(tagSearchTerm)).length > tagSuggestions.length && (
              <div className="tag-search-item" style={{ color: 'var(--muted)' }} onMouseDown={(e) => { e.preventDefault(); setTagSuggestLimit(l => l + 20) }}>
                Load more…
              </div>
            )}
          </div>
        )}
      </div>

      {!query && <QuickAdd onAdd={onAddEntry} disabled={false} />}

      <div style={{ '--card-min-width': `${cardMinWidth}px` }}>
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
          tagColors={tagColors}
        />
      </div>

      <ArchiveSection
        key={topic.id}
        topicId={topic.id}
        supabase={supabase}
        onStatusChange={onStatusChange}
        onDelete={onDelete}
      />

      {returnY != null && <ReturnButton onReturn={handleReturn} />}
    </>
  )
}

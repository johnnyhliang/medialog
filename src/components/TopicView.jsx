import { lazy, Suspense, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { readPref, writePref } from '../lib/localPref.js'
// TopicDocEditor pulls in CodeMirror and its lezer grammars — ~520 KB, 46% of
// the entry bundle, evaluated on every page load including Metrics. EntryCard
// already lazy-loads NoteEditor for the same reason; this static import was
// cancelling that boundary out, since both reach CodeMirror through NoteEditor.
const TopicDocEditor = lazy(() => import('./TopicDocEditor.jsx'))
import MarkdownView from './MarkdownView.jsx'
import EntryList from './EntryList.jsx'
import QuickAdd from './QuickAdd.jsx'
import ReturnButton from './ReturnButton.jsx'
import ArchiveSection from './ArchiveSection.jsx'
import ConfirmModal from './ConfirmModal.jsx'
import { extractEmbedIds } from '../lib/embeds.js'
import { entryMatchesLiteral } from '../lib/searchSnippets.js'

// A shared frozen default: `new Set()` in the parameter list would be a fresh
// object on every render, which is enough on its own to make the `filtered` memo
// below recompute forever for any caller that omits the prop.
const EMPTY_IDS = new Set()

const SCOPES = [
  { value: 'topic', label: 'This topic' },
  { value: 'doc', label: 'This doc' },
  { value: 'all', label: 'Everything' },
]

export default function TopicView({
  topic, entries, allCandidates, topics,
  onAddEntry, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave, onPreview, onOpenRelated, onDocChange,
  onNoteVersion, onShowHistory,
  onSearchAll, globalSearchResults,
  onTitleChange, onDueDateChange, onMove, tagColors,
  allTags = [],
  pendingArchiveIds = EMPTY_IDS,
  jumpEntryId = null,
  supabase,
  onCheckDuplicate,
  onEntryUpdate,
  onArchiveTopic,
  onUnarchiveTopic,
  onDeleteTopic,
  onExportTopic,
  focusedEntryId,
  editTargetId,
  onClearEditTarget,
  onOrderedIds, onRetire,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('touchstart', handleClick) }
  }, [menuOpen])
  const storageKey = `medialog_topic_view_${topic.id}`
  const [mode, setMode] = useState(() => {
    const saved = readPref(storageKey, null)
    if (saved) return saved
    return topic.master_doc ? 'doc' : 'list'
  })
  const [docEditing, setDocEditing] = useState(() => !((topic.master_doc || '').trim()))
  const [liveDoc, setLiveDoc] = useState(topic.master_doc || '')
  const [inputVal, setInputVal] = useState('')
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('topic')
  const [returnY, setReturnY] = useState(null)
  const [searchFocused, setSearchFocused] = useState(false)
  const [docWidth, setDocWidth] = useState(() => {
    return readPref('medialog_doc_width', null) || 'readable'
  })
  const [cols, setCols] = useState(() => {
    return Number(readPref('medialog_card_cols', null)) || 3
  })
  const gridRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    if (!gridRef.current) return
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    ro.observe(gridRef.current)
    return () => ro.disconnect()
  }, [])

  const colsToMinWidth = useCallback((c, w) => {
    if (!w) return 200
    const gap = 12
    return Math.floor((w - gap * (c - 1)) / c)
  }, [])

  // Treat the user's column count as a MAX. Step down (e.g. 3→2→1) when the
  // container can't fit that many cards at a comfortable width — otherwise a
  // fixed grid either cramps on small screens or leaves an awkward gap before
  // collapsing to one column.
  const COMFORTABLE_CARD = 240
  const fitCols = containerWidth
    ? Math.max(1, Math.floor((containerWidth + 12) / (COMFORTABLE_CARD + 12)))
    : cols
  const effectiveCols = Math.min(cols, fitCols)
  const cardMinWidth = containerWidth ? colsToMinWidth(effectiveCols, containerWidth) : 200

  function setDocWidthAndSave(w) {
    setDocWidth(w)
    writePref('medialog_doc_width', w)
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

  // Declared BEFORE the effect that calls its setter. It worked previously only
  // through hoisting of the surrounding function scope, which is an accident
  // rather than a guarantee.
  const [tagSuggestLimit, setTagSuggestLimit] = useState(20)

  // Reset tag suggestion limit when leaving tag search
  useEffect(() => {
    if (!isTagSearch) setTagSuggestLimit(20)
  }, [isTagSearch])

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
    writePref(storageKey, next)
  }

  const getEntry = useMemo(() => {
    const byId = new Map(entries.map((e) => [e.id, e]))
    return (id) => byId.get(id) || null
  }, [entries])

  const docEmbedIds = useMemo(() => new Set(extractEmbedIds(liveDoc)), [liveDoc])

  // Retired entries stay in the main list on purpose — many are quick-access
  // links that are read often and edited rarely, so hiding them would be the
  // wrong trade. This narrows *to* them, for reviewing or undoing a decision.
  const [retiredOnly, setRetiredOnly] = useState(false)
  const retiredCount = useMemo(() => entries.filter(e => e.retired_at).length, [entries])
  // Un-retiring the last one from inside the filter would otherwise unmount the
  // toggle while it is still on, stranding the list empty with no way back.
  useEffect(() => {
    if (retiredCount === 0 && retiredOnly) setRetiredOnly(false)
  }, [retiredCount, retiredOnly])

  const filtered = useMemo(() => {
    let result
    if (filteredByTag !== null) {
      result = filteredByTag
    } else if (scope === 'all') {
      result = globalSearchResults ?? entries.filter((entry) => entryMatchesLiteral(entry, query))
    } else {
      let pool = scope === 'doc' ? entries.filter((e) => docEmbedIds.has(e.id)) : entries
      result = pool.filter((entry) => entryMatchesLiteral(entry, query))
    }
    // Browsing hides done entries (unless pending-archive timer is running).
    // But an active search reaches them too — like `is:archived` on GitHub, you
    // only see archived items when you actually ask for something.
    //
    // `jumpEntryId` is the third exemption, and it is not a search: arriving from
    // an assistant citation or a related-entries link is an explicit request for
    // ONE entry. Without it an archived target was filtered out before render, so
    // getElementById found nothing and the optional chain swallowed the failure —
    // you landed on the topic and nothing happened, with no scroll and no error.
    const isSearching = inputVal.trim().length > 0
    result = result.filter(e => (
      isSearching || e.status !== 'done' || pendingArchiveIds.has(e.id) || e.id === jumpEntryId
    ))
    return retiredOnly ? result.filter(e => e.retired_at) : result
  }, [entries, query, inputVal, scope, docEmbedIds, globalSearchResults, filteredByTag, pendingArchiveIds, retiredOnly, jumpEntryId])

  const orderedIds = useMemo(() => filtered.map((e) => e.id), [filtered])
  // Keyed on the joined ids rather than the array. `onOrderedIds` is the parent's
  // setState, so this effect re-renders us; depending on an array would only be
  // safe for as long as `filtered`'s memo stays stable, and one unstable dep in
  // that list (a caller omitting `pendingArchiveIds`, say) would turn a re-render
  // into an unbounded effect loop. The key can't drift that way.
  const orderedKey = orderedIds.join(',')
  useEffect(() => {
    onOrderedIds?.(orderedIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedKey])

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
          <div className="topic-more-menu" ref={menuRef}>
            <button
              className="topic-more-trigger"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Topic actions"
              aria-expanded={menuOpen}
            >⋯</button>
            {menuOpen && (
              <div className="topic-more-dropdown">
                <button onClick={() => { setMenuOpen(false); onExportTopic?.(topic) }}>Export as Markdown</button>
                {topic.name !== 'Inbox' && (
                  <>
                    {topic.archived_at ? (
                      <button onClick={() => { setMenuOpen(false); onUnarchiveTopic?.(topic.id) }}>Unarchive topic</button>
                    ) : (
                      <button onClick={() => { setMenuOpen(false); onArchiveTopic?.(topic.id) }}>Archive topic</button>
                    )}
                    <button
                      className="topic-more-danger"
                      onClick={() => { setMenuOpen(false); setConfirmDelete(true) }}
                    >Delete topic…</button>
                  </>
                )}
              </div>
            )}
          </div>
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
            <div className="card-density-ctrl" title="Columns">
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={cols}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setCols(v)
                  writePref('medialog_card_cols', String(v))
                }}
                aria-label="Columns"
              />
              <span className="card-density-label">{cols} col{cols !== 1 ? 's' : ''}</span>
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
          {docEditing ? (
            <Suspense fallback={<p className="muted">Loading editor…</p>}>
              <TopicDocEditor
                topicId={topic.id}
                initialDoc={topic.master_doc || ''}
                candidates={allCandidates}
                scopeCtxRef={scopeCtxRef}
                onChange={handleDocChange}
                onDone={() => setDocEditing(false)}
              />
            </Suspense>
          ) : liveDoc.trim() ? (
            <div onClick={() => setDocEditing(true)} style={{ cursor: 'text' }}>
              <MarkdownView getEntry={getEntry} onJump={handleJump} onPreview={onPreview}>
                {liveDoc}
              </MarkdownView>
            </div>
          ) : (
            <p className="master-doc-empty" onClick={() => setDocEditing(true)}>Click to add a doc for this topic…</p>
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

      {!query && <div style={{ marginTop: 12 }}><QuickAdd onAdd={onAddEntry} disabled={false} onCheckDuplicate={onCheckDuplicate} supabase={supabase} /></div>}

      <div className="entries-section-header">
        <span className="entries-section-label">Entries</span>
        {filtered.length > 0 && <span className="entries-section-count">{filtered.length}</span>}
        {(retiredCount > 0 || retiredOnly) && (
          <button
            className={`retired-filter-btn${retiredOnly ? ' active' : ''}`}
            onClick={() => setRetiredOnly(v => !v)}
            aria-pressed={retiredOnly}
            title={retiredOnly ? 'Show all entries' : 'Show only entries you are done with'}
          >
            done with · {retiredCount}
          </button>
        )}
      </div>

      <div ref={gridRef} style={{ '--card-min-width': `${cardMinWidth}px` }}>
        <EntryList
          entries={filtered}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
          onTagsChange={onTagsChange}
          onTogglePin={onTogglePin}
          onNoteSave={onNoteSave}
          onPreview={onPreview}
          onOpenRelated={onOpenRelated}
          onNoteVersion={onNoteVersion}
          onShowHistory={onShowHistory}
          onTitleChange={onTitleChange}
          onDueDateChange={onDueDateChange}
          moveTargets={moveTargets}
          onMove={onMove}
          tagColors={tagColors}
          onEntryUpdate={onEntryUpdate}
          onRetire={onRetire}
          focusedEntryId={focusedEntryId}
          editTargetId={editTargetId}
          onClearEditTarget={onClearEditTarget}
          searchQuery={inputVal.trim()}
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

      {confirmDelete && (
        <ConfirmModal
          message={`Permanently delete "${topic.name}" and move all its entries to trash?`}
          confirmLabel="Delete"
          onConfirm={() => { setConfirmDelete(false); onDeleteTopic?.(topic.id) }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { readPref, writePref } from '../lib/localPref.js'
import { searchEntries, searchSemantic, listReadingQueue } from '../lib/db/entries.js'
import { annotateEmbedded } from '../lib/db/retrieval.js'
import { track } from '../lib/track.js'
import { Search, BookOpen, Clock } from 'lucide-react'
import { buildSearchPreview, splitHighlightParts } from '../lib/searchSnippets.js'
import PracticeCard from './PracticeCard.jsx'

const STATUS_LABEL = { active: 'active', backlog: 'backlog' }
const STATUS_CLASS = { active: 'status-active', backlog: 'status-backlog' }
const SEMANTIC_SEARCH_ENABLED = import.meta.env.VITE_SEMANTIC_SEARCH !== 'false'

function faviconUrl(url) {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32` } catch { return null }
}

function EntryRow({ entry, onSelect, query = '' }) {
  const favicon = entry.url ? faviconUrl(entry.url) : null
  const searchPreview = query ? buildSearchPreview(entry, query) : null
  const highlighted = (text) => splitHighlightParts(text, query).map((part, i) => (
    part.match ? <mark key={i} className="search-hit">{part.text}</mark> : <span key={i}>{part.text}</span>
  ))
  return (
    <div className="explore-row" onClick={() => onSelect?.(entry)}>
      <div className="explore-row-main">
        {favicon ? (
          <img
            className="explore-favicon"
            src={favicon}
            alt=""
            loading="lazy"
            onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
          />
        ) : (
          <span className="explore-favicon explore-favicon--note">✎</span>
        )}
        <span className="explore-row-title">
          {query ? highlighted(entry.title || entry.url || 'Untitled') : (entry.title || entry.url || 'Untitled')}
        </span>
        {entry.embedded != null && (
          <span
            className={`explore-embed-dot${entry.embedded ? ' is-embedded' : ''}`}
            title={entry.embedded ? 'Indexed for semantic search' : 'Not yet embedded — semantic search can’t reach this'}
          >
            {entry.embedded ? '◆' : '◇'}
          </span>
        )}
        {entry.similarity != null && (
          <span className="explore-similarity">{Math.round(entry.similarity * 100)}%</span>
        )}
        <span className={`entry-status-chip ${STATUS_CLASS[entry.status] || ''}`}>
          {STATUS_LABEL[entry.status] || entry.status}
        </span>
      </div>
      {entry.passage && (
        <p className="explore-passage">
          {entry.passageHeading && <span className="explore-passage-heading">{entry.passageHeading} · </span>}
          {entry.passage.length > 220 ? `${entry.passage.slice(0, 220).trimEnd()}…` : entry.passage}
        </p>
      )}
      {!entry.passage && searchPreview?.snippets?.length > 0 && (
        <div className="entry-search-snippets entry-search-snippets--explore">
          {searchPreview.snippets.map((snippet, i) => (
            <p key={`${snippet.field}-${i}`} className="entry-search-snippet">
              <span className="entry-search-snippet-label">{snippet.field}</span>
              <span>{highlighted(snippet.text)}</span>
            </p>
          ))}
        </div>
      )}
      <div className="explore-row-meta">
        {entry.topicName && <span className="explore-topic-pill">{entry.topicName}</span>}
        {entry.tags?.map((t) => (
          <span key={t} className="explore-tag">#{t}</span>
        ))}
        {entry.url && (
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="explore-url"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => { try { return new URL(entry.url).hostname } catch { return entry.url } })()} ↗
          </a>
        )}
      </div>
    </div>
  )
}

export default function ExploreView({ supabase, topics, onSelectEntry, onOrderedIds, showPractice = false, timezone }) {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [queue, setQueue] = useState([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [semanticMode, setSemanticMode] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [topicFilter, setTopicFilter] = useState('all')
  const [recentSearches, setRecentSearches] = useState(() => {
    // JSON.parse can still throw on a corrupted value, so the try stays; what it
    // no longer has to catch is storage itself being unavailable.
    try { return JSON.parse(readPref('medialog_recent_searches', '[]')) } catch { return [] }
  })
  const [showRecent, setShowRecent] = useState(false)
  const timerRef = useRef(null)
  const inputRef = useRef(null)

  function saveRecentSearch(q) {
    const next = [q, ...recentSearches.filter((s) => s !== q)].slice(0, 5)
    setRecentSearches(next)
    writePref('medialog_recent_searches', JSON.stringify(next))
  }

  useEffect(() => {
    listReadingQueue(supabase).then((rows) => {
      setQueue(rows)
      setQueueLoading(false)
    })
    inputRef.current?.focus()
  }, [supabase])

  useEffect(() => {
    // Clearing the timer only cancels a search that hasn't started yet. Once the
    // request is in flight nothing stops it, and a slow one resolves *after* the
    // query it was superseded by — `rust` outliving `rust traits`, because more
    // rows means a bigger annotateEmbedded round trip. So the effect also carries
    // a cancellation flag, and every writer below is guarded by it.
    let cancelled = false
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!query.trim()) { setSearchResults(null); setSearchError(null); return }
    setSearching(true)
    setSearchError(null)
    const useSemantic = semanticMode && SEMANTIC_SEARCH_ENABLED
    const delay = useSemantic ? 600 : 300
    timerRef.current = setTimeout(async () => {
      // Fired inside the debounce, so it counts searches, not keystrokes. The
      // query itself is never recorded — only which engine ran.
      track(supabase, 'search_run', { mode: useSemantic ? 'semantic' : 'keyword' })
      try {
        const raw = useSemantic
          ? await searchSemantic(supabase, query.trim())
          : await searchEntries(supabase, query.trim())
        const results = await annotateEmbedded(supabase, raw)
        if (cancelled) return
        setSearchResults(results)
        saveRecentSearch(query.trim())
      } catch (e) {
        if (cancelled) return
        // Not `if (useSemantic)`. Keyword search throws too now that the db layer
        // stops flattening failures to `[]`, and the old branch dropped that
        // throw on the floor: no results, no error, the spinner just stopped and
        // the list kept showing whatever the previous query returned. A failed
        // search reports itself whichever engine ran it.
        setSearchError(e.message || `${useSemantic ? 'semantic' : 'keyword'} search failed`)
        // `[]` rather than leaving the stale results up, so the count and the
        // list agree with the error message instead of contradicting it. The
        // empty list is never read as "no matches" here — the error renders
        // above it and suppresses the empty copy.
        setSearchResults([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, delay)
    return () => { cancelled = true; clearTimeout(timerRef.current) }
  }, [query, supabase, semanticMode])

  const displayItems = searchResults ?? queue
  const isSearching = query.trim().length > 0

  const filtered = useMemo(() => displayItems.filter((e) => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false
    if (topicFilter !== 'all' && e.topic_id !== topicFilter) return false
    return true
  }), [displayItems, statusFilter, topicFilter])

  const orderedIds = useMemo(() => filtered.map((e) => e.id), [filtered])
  // Depend on the joined string, not the array. `onOrderedIds` is the parent's
  // setState, so the effect re-renders us; if the dependency were the array
  // itself — a fresh literal every render — Object.is would never match and the
  // effect would fire forever ("Maximum update depth exceeded"). The key changes
  // only when the ids actually change.
  const orderedKey = orderedIds.join(',')
  useEffect(() => {
    onOrderedIds?.(orderedIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedKey])

  const grouped = !isSearching
    ? filtered.reduce((acc, e) => {
        const key = e.topicName || 'uncategorised'
        if (!acc[key]) acc[key] = []
        acc[key].push(e)
        return acc
      }, {})
    : null

  return (
    <div className="explore-view">
      <div className="explore-header">
        <h2 className="explore-title">explore</h2>
        <p className="explore-subtitle">search everything · reading queue across all topics</p>
      </div>

      {/* Hidden while searching: you came here to find something of your own,
          and a suggestion box on top of your results is noise. */}
      {showPractice && !isSearching && <PracticeCard supabase={supabase} timezone={timezone} />}

      <div className="explore-search-wrap">
        <Search size={15} className="explore-search-icon" />
        <input
          ref={inputRef}
          className="explore-search-input"
          placeholder={semanticMode ? 'ask by meaning — “notes about focus and burnout”…' : 'search titles, urls, notes, tags…'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowRecent(true)}
          onBlur={() => setTimeout(() => setShowRecent(false), 150)}
        />
        {showRecent && !query && recentSearches.length > 0 && (
          <div className="recent-searches-dropdown">
            {recentSearches.map((s) => (
              <button
                key={s}
                className="recent-search-item"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setQuery(s)
                  setShowRecent(false)
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {searching && <span className="explore-search-spinner" />}
        {SEMANTIC_SEARCH_ENABLED && (
        <button
          className={`explore-semantic-btn${semanticMode ? ' explore-semantic-btn--on' : ''}`}
          onClick={() => setSemanticMode((m) => !m)}
          title="Semantic search — finds by meaning across your whole library, not just literal words"
        >
          semantic
        </button>
        )}
        {query && (
          <button className="explore-clear-btn" onClick={() => { setQuery(''); setSemanticMode(false) }}>×</button>
        )}
      </div>

      <div className="explore-filters">
        <select
          className="explore-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">all statuses</option>
          <option value="active">active</option>
          <option value="backlog">backlog</option>
          <option value="done">done</option>
        </select>
        <select
          className="explore-filter-select"
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
        >
          <option value="all">all topics</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <span className="explore-count">
          {filtered.length} {isSearching ? 'results' : 'to read'}
        </span>
      </div>

      <div className="explore-results">
        {searchError && (
          <p className="explore-semantic-error">{searchError}</p>
        )}
        {queueLoading && !isSearching ? (
          <p className="muted" style={{ padding: '24px 0' }}>loading…</p>
        ) : filtered.length === 0 ? (
          // Suppressed when the search errored: "no results" is an answer about
          // the library, and we do not have one to give.
          searchError ? null : (
            <p className="muted" style={{ padding: '24px 0' }}>
              {isSearching ? 'no results' : 'nothing in queue — nice.'}
            </p>
          )
        ) : isSearching ? (
          filtered.map((e) => (
            <EntryRow key={e.id} entry={e} onSelect={onSelectEntry} query={semanticMode ? '' : query.trim()} />
          ))
        ) : (
          Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([topic, entries]) => (
            <div key={topic} className="explore-group">
              <div className="explore-group-label">
                <BookOpen size={11} />
                {topic}
                <span className="explore-group-count">{entries.length}</span>
              </div>
              {entries.map((e) => (
                <EntryRow key={e.id} entry={e} onSelect={onSelectEntry} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

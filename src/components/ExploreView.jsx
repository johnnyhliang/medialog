import { useEffect, useRef, useState } from 'react'
import { searchEntries, searchSemantic, listReadingQueue } from '../lib/db/entries.js'
import { Search, BookOpen, Clock } from 'lucide-react'

const STATUS_LABEL = { active: 'active', backlog: 'backlog' }
const STATUS_CLASS = { active: 'status-active', backlog: 'status-backlog' }

function faviconUrl(url) {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32` } catch { return null }
}

function EntryRow({ entry, onSelect }) {
  const favicon = entry.url ? faviconUrl(entry.url) : null
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
          {entry.title || entry.url || 'Untitled'}
        </span>
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

export default function ExploreView({ supabase, topics, onSelectEntry, onOrderedIds }) {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [queue, setQueue] = useState([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [semanticMode, setSemanticMode] = useState(false)
  const [semanticError, setSemanticError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [topicFilter, setTopicFilter] = useState('all')
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('medialog_recent_searches') ?? '[]') } catch { return [] }
  })
  const [showRecent, setShowRecent] = useState(false)
  const timerRef = useRef(null)
  const inputRef = useRef(null)

  function saveRecentSearch(q) {
    const next = [q, ...recentSearches.filter((s) => s !== q)].slice(0, 5)
    setRecentSearches(next)
    localStorage.setItem('medialog_recent_searches', JSON.stringify(next))
  }

  useEffect(() => {
    listReadingQueue(supabase).then((rows) => {
      setQueue(rows)
      setQueueLoading(false)
    })
    inputRef.current?.focus()
  }, [supabase])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!query.trim()) { setSearchResults(null); setSemanticError(null); return }
    setSearching(true)
    setSemanticError(null)
    const delay = semanticMode ? 600 : 300
    timerRef.current = setTimeout(async () => {
      try {
        const results = semanticMode
          ? await searchSemantic(supabase, query.trim())
          : await searchEntries(supabase, query.trim())
        setSearchResults(results)
        saveRecentSearch(query.trim())
      } catch (e) {
        if (semanticMode) {
          setSemanticError(e.message || 'semantic search failed')
          setSearchResults([])
        }
      } finally {
        setSearching(false)
      }
    }, delay)
    return () => clearTimeout(timerRef.current)
  }, [query, supabase, semanticMode])

  const displayItems = searchResults ?? queue
  const isSearching = query.trim().length > 0

  const filtered = displayItems.filter((e) => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false
    if (topicFilter !== 'all' && e.topic_id !== topicFilter) return false
    return true
  })

  useEffect(() => {
    onOrderedIds?.(filtered.map((e) => e.id))
  }, [filtered])

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

      <div className="explore-search-wrap">
        <Search size={15} className="explore-search-icon" />
        <input
          ref={inputRef}
          className="explore-search-input"
          placeholder="search titles, urls, notes, tags…"
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
        {query && (
          <button
            className={`explore-semantic-btn${semanticMode ? ' explore-semantic-btn--on' : ''}`}
            onClick={() => setSemanticMode((m) => !m)}
            title="Toggle semantic search"
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
        {semanticError && (
          <p className="explore-semantic-error">{semanticError}</p>
        )}
        {queueLoading && !isSearching ? (
          <p className="muted" style={{ padding: '24px 0' }}>loading…</p>
        ) : filtered.length === 0 ? (
          <p className="muted" style={{ padding: '24px 0' }}>
            {isSearching ? 'no results' : 'nothing in queue — nice.'}
          </p>
        ) : isSearching ? (
          filtered.map((e) => (
            <EntryRow key={e.id} entry={e} onSelect={onSelectEntry} />
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

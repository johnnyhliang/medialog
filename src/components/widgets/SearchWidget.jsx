import { useState } from 'react'

const ENGINES = [
  { label: 'google',     key: 'G',   url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&udm=14` },
  { label: 'ddg',        key: 'DDG', url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  { label: 'kagi',       key: 'K',   url: (q) => `https://kagi.com/search?q=${encodeURIComponent(q)}` },
]

function loadEngine() {
  try { return localStorage.getItem('medialog_search_engine') || 'G' } catch { return 'G' }
}

export default function SearchWidget() {
  const [query, setQuery] = useState('')
  const [engine, setEngine] = useState(loadEngine)

  function handleKeyDown(e) {
    if (e.key !== 'Enter' || !query.trim()) return
    const eng = ENGINES.find((en) => en.key === engine) || ENGINES[0]
    window.open(eng.url(query.trim()), '_blank')
    setQuery('')
  }

  function selectEngine(key) {
    setEngine(key)
    try { localStorage.setItem('medialog_search_engine', key) } catch {}
  }

  return (
    <div className="kw-search">
      <input
        className="kw-search-input"
        placeholder="search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="kw-engine-row">
        {ENGINES.map((en) => (
          <button
            key={en.key}
            className={`kw-engine-btn${engine === en.key ? ' active' : ''}`}
            onClick={() => selectEngine(en.key)}
          >
            {en.label}
          </button>
        ))}
      </div>
    </div>
  )
}

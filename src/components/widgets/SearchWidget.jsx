// src/components/widgets/SearchWidget.jsx
import { useState } from 'react'

const ENGINES = [
  { label: 'G',   url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&udm=14` },
  { label: 'DDG', url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  { label: 'K',   url: (q) => `https://kagi.com/search?q=${encodeURIComponent(q)}` },
]

function loadEngine() {
  try { return localStorage.getItem('medialog_search_engine') || 'G' } catch { return 'G' }
}

export default function SearchWidget() {
  const [query, setQuery] = useState('')
  const [engine, setEngine] = useState(loadEngine)

  function handleKeyDown(e) {
    if (e.key !== 'Enter' || !query.trim()) return
    const eng = ENGINES.find((en) => en.label === engine) || ENGINES[0]
    window.open(eng.url(query.trim()), '_blank')
    setQuery('')
  }

  function selectEngine(label) {
    setEngine(label)
    try { localStorage.setItem('medialog_search_engine', label) } catch {}
  }

  return (
    <div className="widget-search">
      <input
        className="widget-search-input"
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="widget-engine-row">
        {ENGINES.map((en) => (
          <button
            key={en.label}
            className={`widget-engine-btn${engine === en.label ? ' active' : ''}`}
            onClick={() => selectEngine(en.label)}
          >
            {en.label}
          </button>
        ))}
      </div>
    </div>
  )
}

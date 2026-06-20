import { useEffect, useRef, useState } from 'react'

const ENGINES = [
  { label: 'google',      key: 'G',   url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&udm=14` },
  { label: 'ddg',         key: 'DDG', url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  { label: 'brave',       key: 'BRV', url: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}` },
]

const DDG_API = 'https://api.duckduckgo.com/?format=json&no_redirect=1&no_html=1&q='

function loadEngine() {
  try { return localStorage.getItem('medialog_search_engine') || 'G' } catch { return 'G' }
}

function useDdgAnswer(query) {
  const [answer, setAnswer] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!query.trim()) { setAnswer(null); return }

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(DDG_API + encodeURIComponent(query.trim()))
        const data = await res.json()
        const text = data.Answer || data.AbstractText || data.Definition || null
        const source = data.Answer ? null : (data.AbstractSource || data.DefinitionSource || null)
        const url = data.Answer ? null : (data.AbstractURL || data.DefinitionURL || null)
        setAnswer(text ? { text, source, url } : null)
      } catch {
        setAnswer(null)
      }
    }, 500)

    return () => clearTimeout(timerRef.current)
  }, [query])

  return answer
}

export default function SearchWidget() {
  const [query, setQuery] = useState('')
  const [engine, setEngine] = useState(loadEngine)
  const answer = useDdgAnswer(query)

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
      {answer && (
        <div className="kw-answer">
          <p className="kw-answer-text">{answer.text}</p>
          {answer.source && answer.url && (
            <a href={answer.url} target="_blank" rel="noopener noreferrer" className="kw-answer-source">
              {answer.source} ↗
            </a>
          )}
        </div>
      )}
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

import { useState } from 'react'
import { crawlArchive } from '../lib/crawlArchive.js'

export default function ArchiveCrawl({ topics, onImport }) {
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState('idle') // idle | crawling | preview | importing | done
  const [result, setResult] = useState(null)   // { items, via }
  const [error, setError] = useState(null)
  const [topicId, setTopicId] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [importedCount, setImportedCount] = useState(0)

  const nonInbox = topics.filter((t) => t.name !== 'Inbox')

  async function handleCrawl() {
    if (!url.trim()) return
    setPhase('crawling')
    setError(null)
    setResult(null)
    try {
      const res = await crawlArchive(url.trim())
      setResult(res)
      setSelected(new Set(res.items.map((_, i) => i)))
      setPhase('preview')
    } catch (err) {
      setError(err.message)
      setPhase('idle')
    }
  }

  function toggleItem(i) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === result.items.length) setSelected(new Set())
    else setSelected(new Set(result.items.map((_, i) => i)))
  }

  async function handleImport() {
    if (!topicId || !result || phase === 'importing') return
    const items = result.items
      .filter((_, i) => selected.has(i))
      .map((x) => ({ url: x.url, title: x.title, note: '' }))
    if (!items.length) return
    setPhase('importing')
    try {
      const count = await onImport(topicId, items)
      setImportedCount(count)
      setPhase('done')
    } catch (err) {
      setError(err.message)
      setPhase('preview')
    }
  }

  function reset() {
    setUrl('')
    setPhase('idle')
    setResult(null)
    setError(null)
    setTopicId('')
    setSelected(new Set())
  }

  const selectedCount = result ? [...selected].length : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <p className="section-label" style={{ marginBottom: '0.4rem' }}>Blog archive import</p>
        <p className="muted" style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          Paste a blog URL — we'll pull its full article history from the sitemap or RSS feed and import everything as backlog entries.
        </p>
      </div>

      {phase === 'idle' || phase === 'crawling' ? (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="url"
            placeholder="https://aligrithm.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCrawl()}
            disabled={phase === 'crawling'}
            style={{ flex: 1 }}
          />
          <button onClick={handleCrawl} disabled={phase === 'crawling' || !url.trim()}>
            {phase === 'crawling' ? 'crawling…' : 'crawl'}
          </button>
        </div>
      ) : null}

      {error && (
        <p className="muted" style={{ fontSize: '0.8rem', color: 'var(--danger, #c0392b)' }}>
          {error}
        </p>
      )}

      {phase === 'preview' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <p className="muted" style={{ fontSize: '0.8rem' }}>
              found {result.items.length} articles via {result.via}
            </p>
            <button style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }} onClick={toggleAll}>
              {selected.size === result.items.length ? 'deselect all' : 'select all'}
            </button>
          </div>

          <div style={{
            maxHeight: '320px', overflowY: 'auto',
            border: '1px solid var(--border)', borderRadius: '3px',
            fontSize: '0.8rem',
          }}>
            {result.items.map((item, i) => (
              <label
                key={i}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                  padding: '0.4rem 0.6rem',
                  borderBottom: i < result.items.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer',
                  background: selected.has(i) ? 'transparent' : 'rgba(0,0,0,0.02)',
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggleItem(i)}
                  style={{ marginTop: '2px', flexShrink: 0 }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 400, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </div>
                  <div className="muted" style={{ fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.url}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              style={{ flex: 1 }}
            >
              <option value="">— pick a topic —</option>
              {nonInbox.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              onClick={handleImport}
              disabled={!topicId || !selectedCount}
            >
              import {selectedCount} entries
            </button>
            <button
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
              onClick={reset}
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {phase === 'importing' && (
        <p className="muted" style={{ fontSize: '0.8rem' }}>importing {selectedCount} entries…</p>
      )}

      {phase === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            ✓ imported {importedCount} entries into{' '}
            {topics.find((t) => t.id === topicId)?.name ?? 'topic'}
          </p>
          <button style={{ alignSelf: 'flex-start', fontSize: '0.75rem' }} onClick={reset}>
            import another
          </button>
        </div>
      )}
    </div>
  )
}

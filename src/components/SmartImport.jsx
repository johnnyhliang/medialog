import { useState } from 'react'

export default function SmartImport({ topics, onImport }) {
  const [data, setData] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [expandedTopic, setExpandedTopic] = useState(null)

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result)
        if (!parsed.entries || !parsed.suggested_topics) throw new Error('bad format')
        setData(parsed)
        setSelected(new Set(parsed.suggested_topics))
        setStatus(null)
      } catch {
        setStatus('Could not parse file — make sure it is a valid import-preview.json.')
      }
    }
    reader.readAsText(file)
  }

  function toggleAll() {
    if (selected.size === data.suggested_topics.length) setSelected(new Set())
    else setSelected(new Set(data.suggested_topics))
  }

  function toggleTopic(t) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  async function handleImport() {
    if (!data || busy) return
    const toImport = data.entries.filter((e) => selected.has(e.suggested_topic))
    if (!toImport.length) return
    setBusy(true)
    setStatus('Importing…')
    try {
      const count = await onImport(toImport)
      setStatus(`Done — imported ${count} entries across ${selected.size} topics.`)
    } catch (err) {
      setStatus(`Error: ${err.message}`)
    }
    setBusy(false)
  }

  const selectedCount = data
    ? data.entries.filter((e) => selected.has(e.suggested_topic)).length
    : 0

  return (
    <div>
      <p className="section-label">Smart Import</p>
      <p className="muted" style={{ marginBottom: '0.75rem' }}>
        Run <code>node scripts/parse-import.js</code> first, then load the generated{' '}
        <code>import-preview.json</code> file.
      </p>

      <input type="file" accept=".json" onChange={handleFile} />

      {status && <p className="muted" style={{ marginTop: '0.5rem' }}>{status}</p>}

      {data && (
        <div style={{ marginTop: '1rem' }}>
          <p className="muted">
            {data.stats.total} entries · {data.stats.duplicates_removed} duplicates removed ·{' '}
            {data.stats.files_parsed} source files
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0.75rem 0 0.5rem' }}>
            <p className="section-label" style={{ margin: 0 }}>Topics</p>
            <button style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }} onClick={toggleAll}>
              {selected.size === data.suggested_topics.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
            {data.suggested_topics.map((t) => {
              const count = data.stats.by_topic[t] || 0
              const isNew = !topics.find((x) => x.name === t)
              const isExpanded = expandedTopic === t
              const topicEntries = isExpanded ? data.entries.filter((e) => e.suggested_topic === t) : []

              return (
                <div key={t} style={{ borderLeft: '2px solid var(--border)', paddingLeft: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.2rem 0' }}>
                    <input
                      type="checkbox"
                      checked={selected.has(t)}
                      onChange={() => toggleTopic(t)}
                    />
                    <span style={{ fontWeight: 500 }}>{t}</span>
                    <span className="muted" style={{ fontSize: '0.8rem' }}>
                      {count} entries{isNew ? ' · new topic' : ''}
                    </span>
                    <button
                      style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', marginLeft: 'auto' }}
                      onClick={(e) => { e.preventDefault(); setExpandedTopic(isExpanded ? null : t) }}
                    >
                      {isExpanded ? 'hide' : 'preview'}
                    </button>
                  </label>

                  {isExpanded && (
                    <div style={{ paddingLeft: '1.5rem', paddingBottom: '0.5rem' }}>
                      {topicEntries.slice(0, 15).map((e, i) => (
                        <div key={i} className="muted" style={{ fontSize: '0.78rem', padding: '0.15rem 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.url
                            ? <a href={e.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{e.title || e.url}</a>
                            : <span>📄 {e.title}</span>
                          }
                        </div>
                      ))}
                      {topicEntries.length > 15 && (
                        <p className="muted" style={{ fontSize: '0.75rem' }}>…and {topicEntries.length - 15} more</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <button onClick={handleImport} disabled={busy || !selectedCount}>
            {busy ? 'Importing…' : `Import ${selectedCount} entries`}
          </button>
        </div>
      )}
    </div>
  )
}

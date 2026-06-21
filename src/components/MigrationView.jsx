import { useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { parseTabs, parseAppleNotesHtml, parseKeepJson, parseObsidianZip } from '../lib/parseMigration.js'

const FORMATS = [
  { id: 'tabs',    label: 'Chrome / Browser Tabs', hint: 'Paste URLs or "Title - URL" lines (one per line). Supports OneTab export format.' },
  { id: 'notes',   label: 'Apple Notes', hint: 'Export from Notes app → File → Export as HTML, then upload the .html file.' },
  { id: 'keep',    label: 'Google Keep', hint: 'Download via Google Takeout → Keep → JSON file.' },
  { id: 'obsidian',label: 'Obsidian Vault', hint: 'Zip your vault folder, then upload the .zip file.' },
]

export default function MigrationView({ topics, onImportEntries, addToast }) {
  const [format, setFormat] = useState('tabs')
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState(null)
  const [triaging, setTriaging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [topicOverrides, setTopicOverrides] = useState({})
  const fileRef = useRef(null)

  async function handleParse() {
    try {
      let entries = []
      if (format === 'tabs') {
        entries = parseTabs(text)
      } else if (format === 'notes') {
        entries = parseAppleNotesHtml(text)
      } else if (format === 'keep') {
        entries = parseKeepJson(text)
      }
      if (entries.length === 0) {
        addToast('Nothing found to import — check the format', 'error')
        return
      }
      setParsed(entries)
      setSelected(new Set(entries.map((_, i) => i)))
      setTopicOverrides({})
    } catch (e) {
      addToast(`Parse error: ${e.message}`, 'error')
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      let entries = []
      if (format === 'obsidian') {
        entries = await parseObsidianZip(file)
      } else if (format === 'notes') {
        const html = await file.text()
        entries = parseAppleNotesHtml(html)
      } else if (format === 'keep') {
        const json = await file.text()
        entries = parseKeepJson(json)
      }
      if (entries.length === 0) {
        addToast('Nothing found in file — check format', 'error')
        return
      }
      setParsed(entries)
      setSelected(new Set(entries.map((_, i) => i)))
      setTopicOverrides({})
    } catch (e) {
      addToast(`File error: ${e.message}`, 'error')
    }
  }

  async function handleAiTriage() {
    if (!parsed?.length) return
    setTriaging(true)
    try {
      const topicNames = topics.map((t) => t.name)
      const batch = parsed.slice(0, 80).map((e, i) => ({
        i,
        title: e.title || e.url || e.note?.slice(0, 80) || '',
        url: e.url || null,
        note: e.note?.slice(0, 120) || null,
      }))
      const prompt = `You are helping a user import content into a personal media log.

Existing topics: ${JSON.stringify(topicNames)}

For each item below, return a JSON array with one object per item:
{ "i": <index>, "topic": "<best matching topic name, or a new topic name if none fit>", "keep": <true|false — false if this looks like noise, spam, or low-value content> }

Items:
${JSON.stringify(batch, null, 2)}

Return ONLY the JSON array, no explanation.`

      const { data, error } = await supabase.functions.invoke('ai', {
        body: { prompt, json: true },
      })
      if (error) throw new Error(error.message)

      let suggestions
      try {
        suggestions = typeof data === 'string' ? JSON.parse(data) : data
        if (!Array.isArray(suggestions)) suggestions = suggestions.result ?? suggestions.suggestions ?? []
      } catch {
        throw new Error('AI returned invalid JSON')
      }

      const overrides = {}
      const newSelected = new Set(selected)
      for (const s of suggestions) {
        if (s.topic) overrides[s.i] = s.topic
        if (s.keep === false) newSelected.delete(s.i)
      }
      setTopicOverrides(overrides)
      setSelected(newSelected)
      addToast(`AI triaged ${suggestions.length} items`, 'success')
    } catch (e) {
      addToast(`AI triage failed: ${e.message}`, 'error')
    }
    setTriaging(false)
  }

  async function handleImport() {
    if (!parsed || importing) return
    const toImport = parsed
      .map((e, i) => ({ ...e, suggestedTopic: topicOverrides[i] ?? e.suggestedTopic }))
      .filter((_, i) => selected.has(i))
    if (!toImport.length) return

    setImporting(true)
    try {
      // Find or create topics, then bulk insert into inbox
      const topicMap = {}
      for (const t of topics) topicMap[t.name.toLowerCase()] = t.id

      const entries = toImport.map((e) => ({
        url: e.url || null,
        title: e.title || null,
        note: e.note || null,
        topic_id: topicMap[e.suggestedTopic?.toLowerCase()] ?? null,
        status: 'backlog',
        tags: e.tags ?? [],
      }))

      const count = await onImportEntries(entries, toImport)
      addToast(`Imported ${count} entries`, 'success')
      setParsed(null)
      setText('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      addToast(`Import failed: ${e.message}`, 'error')
    }
    setImporting(false)
  }

  const selectedCount = parsed ? [...selected].length : 0
  const fmt = FORMATS.find((f) => f.id === format)
  const needsTextInput = format === 'tabs' || (format === 'notes' && !parsed) || (format === 'keep' && !parsed)
  const needsFileInput = format === 'obsidian' || format === 'notes' || format === 'keep'

  return (
    <div style={{ maxWidth: 720, padding: '1.5rem' }}>
      <h2 style={{ marginTop: 0, marginBottom: 4 }}>Import</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 24 }}>
        Bring in content from Chrome tabs, Apple Notes, Google Keep, or Obsidian. All entries land in your inbox for triage.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {FORMATS.map((f) => (
          <button
            key={f.id}
            className={`settings-tab ${format === f.id ? 'active' : ''}`}
            onClick={() => { setFormat(f.id); setParsed(null); setText('') }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="muted" style={{ fontSize: 12, marginBottom: 16 }}>{fmt.hint}</p>

      {!parsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(format === 'tabs' || format === 'notes' || format === 'keep') && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                format === 'tabs' ? 'Paste URLs or "Title - URL" lines here…' :
                format === 'notes' ? 'Paste exported HTML here, or upload the file below…' :
                'Paste JSON content here, or upload the file below…'
              }
              style={{ width: '100%', minHeight: 180, fontFamily: 'monospace', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }}
            />
          )}

          {needsFileInput && (
            <div>
              <input ref={fileRef} type="file"
                accept={format === 'obsidian' ? '.zip' : format === 'notes' ? '.html,.htm' : '.json'}
                onChange={handleFile}
              />
            </div>
          )}

          {(format === 'tabs' || ((format === 'notes' || format === 'keep') && text)) && (
            <button style={{ alignSelf: 'flex-start' }} onClick={handleParse} disabled={!text.trim()}>
              Parse
            </button>
          )}
        </div>
      )}

      {parsed && (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 13 }}>{parsed.length} entries found · {selectedCount} selected</span>
            <button onClick={handleAiTriage} disabled={triaging} style={{ fontSize: 12, padding: '4px 10px' }}>
              {triaging ? 'Triaging…' : '✦ AI Triage'}
            </button>
            <button onClick={() => setSelected(new Set(parsed.map((_, i) => i)))} style={{ fontSize: 12, padding: '4px 10px' }}>
              Select all
            </button>
            <button onClick={() => setSelected(new Set())} style={{ fontSize: 12, padding: '4px 10px' }}>
              Deselect all
            </button>
            <button onClick={() => { setParsed(null); setText(''); if (fileRef.current) fileRef.current.value = '' }} style={{ fontSize: 12, padding: '4px 10px' }}>
              ← Back
            </button>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px', width: 32 }}></th>
                  <th style={{ padding: '6px 8px' }}>Title / Note</th>
                  <th style={{ padding: '6px 8px', width: 160 }}>Topic</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((entry, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)', opacity: selected.has(i) ? 1 : 0.4 }}>
                    <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                      <input type="checkbox" checked={selected.has(i)} onChange={() => {
                        setSelected((prev) => {
                          const next = new Set(prev)
                          if (next.has(i)) next.delete(i); else next.add(i)
                          return next
                        })
                      }} />
                    </td>
                    <td style={{ padding: '5px 8px', maxWidth: 380, overflow: 'hidden' }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.title || entry.note?.slice(0, 60) || <span className="muted">Untitled</span>}
                      </div>
                      {entry.url && (
                        <div className="muted" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.url}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '5px 8px' }}>
                      <input
                        list="topic-suggestions"
                        value={topicOverrides[i] ?? entry.suggestedTopic ?? ''}
                        onChange={(e) => setTopicOverrides((prev) => ({ ...prev, [i]: e.target.value }))}
                        placeholder="Inbox"
                        style={{ width: '100%', fontSize: 12, padding: '2px 6px' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <datalist id="topic-suggestions">
            {topics.map((t) => <option key={t.id} value={t.name} />)}
          </datalist>

          <button className="primary" onClick={handleImport} disabled={importing || selectedCount === 0}>
            {importing ? 'Importing…' : `Import ${selectedCount} entries`}
          </button>
        </div>
      )}
    </div>
  )
}

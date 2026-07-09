import { useEffect, useState } from 'react'
import { ArrowLeft, CornerDownRight } from 'lucide-react'
import { getDeepTopic, addSection, setCursor, setSectionStatus, addTakeaway } from '../lib/db/deepTopics.js'
import PdfViewer from './PdfViewer.jsx'

export default function DeepTopicView({ supabase, topicId, onBack, addToast }) {
  const [data, setData] = useState(null)
  const [newSection, setNewSection] = useState('')
  const [takeaway, setTakeaway] = useState('')
  const [note, setNote] = useState('')
  const [tangentFor, setTangentFor] = useState(null) // parent entry id
  const [tab, setTab] = useState('read') // 'read' | 'learned'
  const [busy, setBusy] = useState(false)

  async function load() {
    try { setData(await getDeepTopic(supabase, topicId)) }
    catch (e) { addToast?.(e.message, 'error') }
  }
  useEffect(() => { load() }, [topicId])

  if (!data) return <div className="dt-view"><p className="muted">loading…</p></div>

  const { topic, sections, takeaways } = data
  const hasSource = !!topic.source_url
  const cursor = sections.find((s) => s.id === topic.cursor_section_id) || sections[0] || null
  const cursorTakeaways = cursor ? takeaways.filter((t) => t.section_id === cursor.id && !t.parent_id) : []
  const childrenOf = (id) => takeaways.filter((t) => t.parent_id === id)

  async function handleAddSection() {
    const title = newSection.trim()
    if (!title || busy) return
    setBusy(true)
    try {
      const position = (sections.at(-1)?.position ?? 0) + 1
      const created = await addSection(supabase, { topicId, title, position })
      await setCursor(supabase, topicId, created.id)
      setNewSection('')
      await load()
    } catch (e) { addToast?.(e.message, 'error') }
    setBusy(false)
  }

  async function handleSelectSection(s) {
    try { await setCursor(supabase, topicId, s.id); await load() }
    catch (e) { addToast?.(e.message, 'error') }
  }

  async function handleAddTakeaway(parentId = null) {
    const tk = takeaway.trim()
    if (!tk || !cursor || busy) return
    setBusy(true)
    try {
      await addTakeaway(supabase, { topicId, sectionId: cursor.id, takeaway: tk, note: note.trim(), parentId })
      setTakeaway(''); setNote(''); setTangentFor(null)
      await load()
    } catch (e) { addToast?.(e.message, 'error') }
    setBusy(false)
  }

  async function handleMarkDone() {
    if (!cursor) return
    try { await setSectionStatus(supabase, cursor.id, 'done'); await load() }
    catch (e) { addToast?.(e.message, 'error') }
  }

  return (
    <div className="dt-view">
      <div className="dt-header">
        <button className="dt-back" onClick={onBack}><ArrowLeft size={16} /> reading</button>
        <h2 className="dt-title">{topic.name}</h2>
        <div className="dt-tabs">
          <button className={tab === 'read' ? 'active' : ''} onClick={() => setTab('read')}>read</button>
          <button className={tab === 'learned' ? 'active' : ''} onClick={() => setTab('learned')}>what I learned</button>
        </div>
      </div>

      <div className={`dt-body${hasSource ? '' : ' dt-body--no-source'}`}>
        <div className="dt-source">
          {topic.source_kind === 'pdf' && topic.source_url && (
            <>
              <PdfViewer url={topic.source_url} />
              {/* hotlinked PDFs can fail on a host without CORS — always offer the raw file */}
              <a className="dt-source-link" href={topic.source_url} target="_blank" rel="noreferrer">open original ↗</a>
            </>
          )}
          {topic.source_kind !== 'pdf' && topic.source_url && (
            <a className="dt-source-link" href={topic.source_url} target="_blank" rel="noreferrer">open source ↗</a>
          )}
        </div>

        <div className="dt-main">
          {tab === 'read' ? (
            <>
              <div className="dt-outline">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    className={`dt-section ${s.id === cursor?.id ? 'current' : ''} dt-section--${s.status}`}
                    onClick={() => handleSelectSection(s)}
                  >
                    {s.title}
                  </button>
                ))}
                <div className="dt-add-section">
                  <input placeholder="add section…" value={newSection} onChange={(e) => setNewSection(e.target.value)} />
                  <button onClick={handleAddSection} disabled={busy || !newSection.trim()}>add section</button>
                </div>
              </div>

              {cursor ? (
                <div className="dt-current">
                  <div className="dt-current-head">
                    <span className="dt-current-title">{cursor.title}</span>
                    <button className="dt-done-btn" onClick={handleMarkDone}>mark section done</button>
                  </div>

                  <div className="dt-takeaways">
                    {cursorTakeaways.length === 0 && <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>no takeaways yet — write what you can use.</p>}
                    {cursorTakeaways.map((t) => (
                      <div key={t.id} className="dt-takeaway">
                        <p className="dt-takeaway-text">{t.takeaway}</p>
                        {t.note && <p className="dt-takeaway-note">{t.note}</p>}
                        {childrenOf(t.id).map((c) => (
                          <div key={c.id} className="dt-tangent">
                            <CornerDownRight size={12} />
                            <div><p className="dt-takeaway-text">{c.takeaway}</p>{c.note && <p className="dt-takeaway-note">{c.note}</p>}</div>
                          </div>
                        ))}
                        <button className="dt-tangent-btn" onClick={() => setTangentFor(tangentFor === t.id ? null : t.id)}>
                          {tangentFor === t.id ? 'cancel' : '+ tangent'}
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="dt-add-takeaway">
                    <input placeholder="takeaway — what can you use?" value={takeaway} onChange={(e) => setTakeaway(e.target.value)} />
                    <input placeholder="summary / quote (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                    <button onClick={() => handleAddTakeaway(tangentFor)} disabled={busy || !takeaway.trim()}>
                      {tangentFor ? 'save tangent' : 'save takeaway'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="muted">Add the first section to start.</p>
              )}
            </>
          ) : (
            <div className="dt-learned">
              {sections.map((s) => {
                const items = takeaways.filter((t) => t.section_id === s.id)
                if (!items.length) return null
                return (
                  <div key={s.id} className="dt-learned-section">
                    <p className="dt-learned-title">{s.title}</p>
                    {items.map((t) => (
                      <p key={t.id} className={`dt-learned-item ${t.parent_id ? 'child' : ''}`}>{t.takeaway}</p>
                    ))}
                  </div>
                )
              })}
              {takeaways.length === 0 && <p className="muted">Nothing yet — your takeaways will collect here.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

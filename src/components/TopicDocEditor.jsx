import { useEffect, useMemo, useRef, useState } from 'react'
import NoteEditor from './NoteEditor.jsx'
import { makeEntryCompletion } from '../lib/entryAutocomplete.js'
import { updateTopicDoc } from '../lib/db/topics.js'
import { supabase } from '../lib/supabaseClient.js'

export default function TopicDocEditor({ topicId, initialDoc, candidates, scopeCtxRef, onChange, onDone }) {
  const [doc, setDoc] = useState(initialDoc || '')
  const [saveStatus, setSaveStatus] = useState('idle')
  const saveTimer = useRef(null)
  const candidatesRef = useRef(candidates)
  candidatesRef.current = candidates
  const docRef = useRef(doc)
  docRef.current = doc

  useEffect(() => { setDoc(initialDoc || '') }, [topicId, initialDoc])

  const completion = useMemo(
    () => makeEntryCompletion(
      () => candidatesRef.current,
      () => scopeCtxRef.current,
      () => docRef.current,
    ),
    [scopeCtxRef],
  )

  function handleChange(next) {
    setDoc(next)
    onChange(next)
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateTopicDoc(supabase, topicId, next)
        .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 1500) })
        .catch(() => setSaveStatus('failed'))
    }, 800)
  }

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  function finishEditing() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      updateTopicDoc(supabase, topicId, docRef.current).catch(() => {})
    }
    onDone?.()
  }

  return (
    <div onKeyDown={(e) => { if (e.key === 'Escape') { e.currentTarget.querySelector('.cm-content')?.blur(); finishEditing() } }}>
      <NoteEditor
        value={doc}
        onChange={handleChange}
        supabase={supabase}
        extraExtensions={[completion]}
      />
      <div className="topic-doc-editor-footer">
        {saveStatus === 'saving' && <span className="save-status">Saving…</span>}
        {saveStatus === 'saved' && <span className="save-status">Saved</span>}
        {saveStatus === 'failed' && <span className="save-status save-status--failed">Save failed</span>}
        <button className="btn-small" onClick={finishEditing}>Done</button>
      </div>
    </div>
  )
}

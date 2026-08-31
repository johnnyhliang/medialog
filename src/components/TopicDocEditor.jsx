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

  // The debounced write that hasn't run yet. Kept in a ref (not state) so it can
  // still be flushed from unmount cleanup, where touching state is illegal.
  const pending = useRef(null)
  // `true` once the component is gone — the flush still has to run, but the
  // status setters it would normally call no longer have anywhere to land.
  const unmounted = useRef(false)

  // Flushing, not cancelling, is the point. TopicView is keyed on the topic id,
  // so clicking another topic within the 800 ms debounce unmounts this subtree;
  // the old cleanup cleared the timer and the save simply never happened. The
  // parent's in-memory copy still showed the new text, so nothing looked wrong
  // until a reload revealed the typing was gone.
  function flush() {
    const p = pending.current
    if (!p) return
    pending.current = null
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    return updateTopicDoc(supabase, p.topicId, p.doc)
      .then(() => {
        if (unmounted.current) return
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 1500)
      })
      .catch(() => { if (!unmounted.current) setSaveStatus('failed') })
  }

  function handleChange(next) {
    setDoc(next)
    onChange(next)
    setSaveStatus('saving')
    pending.current = { topicId, doc: next }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(flush, 800)
  }

  useEffect(() => {
    unmounted.current = false
    // Same failure mode as unmount, one level up: closing the tab mid-debounce
    // dropped the write too.
    const onBeforeUnload = () => { flush() }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      unmounted.current = true
      if (saveTimer.current) clearTimeout(saveTimer.current)
      flush()
    }
  }, [])

  function finishEditing() {
    flush()
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

import { useEffect, useMemo, useRef, useState } from 'react'
import NoteEditor from './NoteEditor.jsx'
import { makeEntryCompletion } from '../lib/entryAutocomplete.js'
import { updateTopicDoc } from '../lib/db/topics.js'
import { supabase } from '../lib/supabaseClient.js'

export default function TopicDocEditor({ topicId, initialDoc, candidates, scopeCtxRef, onChange }) {
  const [doc, setDoc] = useState(initialDoc || '')
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
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateTopicDoc(supabase, topicId, next).catch(() => {})
    }, 800)
  }

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  return (
    <NoteEditor
      value={doc}
      onChange={handleChange}
      supabase={supabase}
      extraExtensions={[completion]}
    />
  )
}

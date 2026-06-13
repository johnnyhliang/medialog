import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient.js'
import { listTopics, createTopic, getTopicByName } from './lib/db/topics.js'
import {
  listEntriesByTopic, createEntry, updateEntry, deleteEntry, searchEntries,
  bulkCreateEntries, listForRevisit, markSurfaced,
} from './lib/db/entries.js'
import { setEntryTags } from './lib/db/tags.js'
import { fetchTitle } from './lib/enrich.js'
import { buildMarkdownFiles } from './lib/exportMarkdown.js'
import { buildZip, downloadBlob } from './lib/buildZip.js'
import AuthGate from './components/AuthGate.jsx'
import TopicList from './components/TopicList.jsx'
import EntryList from './components/EntryList.jsx'
import QuickAdd from './components/QuickAdd.jsx'
import SearchBar from './components/SearchBar.jsx'
import BulkImport from './components/BulkImport.jsx'
import SortInbox from './components/SortInbox.jsx'
import ProgressView from './components/ProgressView.jsx'
import Revisit from './components/Revisit.jsx'

function Workspace() {
  const [topics, setTopics] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [entries, setEntries] = useState([])
  const [query, setQuery] = useState('')
  const [view, setView] = useState('browse') // 'browse' | 'bulk' | 'sort' | 'progress' | 'revisit'
  const [inboxEntries, setInboxEntries] = useState([])
  const [revisitEntries, setRevisitEntries] = useState([])

  const inboxTopic = topics.find((t) => t.name === 'Inbox')

  useEffect(() => {
    listTopics(supabase).then((t) => {
      setTopics(t)
      if (t.length && !selectedId) setSelectedId(t[0].id)
    })
  }, [])

  useEffect(() => {
    if (query.trim()) {
      searchEntries(supabase, query.trim()).then(setEntries)
    } else if (selectedId) {
      listEntriesByTopic(supabase, selectedId).then(setEntries)
    } else {
      setEntries([])
    }
  }, [selectedId, query])

  async function handleAddTopic(name) {
    const t = await createTopic(supabase, name)
    setTopics((prev) => [...prev, t].sort((a, b) => a.name.localeCompare(b.name)))
    setSelectedId(t.id)
  }

  async function handleAddEntry({ url, note }) {
    const e = await createEntry(supabase, { topicId: selectedId, url, note })
    setEntries((prev) => [{ ...e, tags: [] }, ...prev])
    if (url) {
      const title = await fetchTitle(supabase, url)
      if (title) {
        const updated = await updateEntry(supabase, e.id, { title })
        setEntries((prev) => prev.map((x) => (x.id === e.id ? { ...updated, tags: x.tags } : x)))
      }
    }
  }

  async function handleDelete(id) {
    await deleteEntry(supabase, id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  async function handleStatusChange(entryId, status) {
    const updated = await updateEntry(supabase, entryId, { status })
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...updated, tags: e.tags } : e)))
  }

  async function handleTagsChange(entryId, tags) {
    await setEntryTags(supabase, entryId, tags)
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, tags } : e)))
  }

  async function loadInbox() {
    if (inboxTopic) setInboxEntries(await listEntriesByTopic(supabase, inboxTopic.id))
  }

  async function handleBulkImport(items) {
    const inbox = inboxTopic || (await getTopicByName(supabase, 'Inbox'))
    const created = await bulkCreateEntries(supabase, inbox.id, items)
    return created.length
  }

  async function handleAssign(entryId, topicId) {
    await updateEntry(supabase, entryId, { topic_id: topicId })
    setInboxEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  async function handleSortDelete(entryId) {
    await deleteEntry(supabase, entryId)
    setInboxEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  async function loadRevisit() {
    setRevisitEntries(await listForRevisit(supabase, 10))
  }

  async function handleSeen(entryId) {
    await markSurfaced(supabase, entryId)
    setRevisitEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  async function handleExport() {
    const all = []
    for (const t of topics) {
      const rows = await listEntriesByTopic(supabase, t.id)
      all.push(...rows)
    }
    const files = buildMarkdownFiles(topics, all)
    const blob = await buildZip(files)
    downloadBlob(blob, `medialog-${new Date().toISOString().slice(0, 10)}.zip`)
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand-row">
          <h1>MediaLog</h1>
          <button className="signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
        <ul className="nav">
          <li><button className={view === 'browse' ? 'active' : ''} onClick={() => setView('browse')}>Browse</button></li>
          <li><button className={view === 'bulk' ? 'active' : ''} onClick={() => setView('bulk')}>Bulk Import</button></li>
          <li><button className={view === 'sort' ? 'active' : ''} onClick={() => { setView('sort'); loadInbox() }}>Sort Inbox</button></li>
          <li><button className={view === 'revisit' ? 'active' : ''} onClick={() => { setView('revisit'); loadRevisit() }}>Revisit</button></li>
          <li><button className={view === 'progress' ? 'active' : ''} onClick={() => setView('progress')}>Progress</button></li>
          <li><button onClick={handleExport}>Export</button></li>
        </ul>
        <TopicList
          topics={topics}
          selectedId={selectedId}
          onSelect={(id) => { setSelectedId(id); setQuery(''); setView('browse') }}
          onAdd={handleAddTopic}
        />
      </aside>
      <main className="main">
        {view === 'browse' && (
          <>
            <SearchBar value={query} onChange={setQuery} />
            {!query && selectedId && (
              <QuickAdd onAdd={handleAddEntry} disabled={!selectedId} />
            )}
            <EntryList
              entries={entries}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              onTagsChange={handleTagsChange}
            />
          </>
        )}
        {view === 'bulk' && <BulkImport onImport={handleBulkImport} />}
        {view === 'sort' && (
          <SortInbox
            entries={inboxEntries}
            topics={topics}
            onAssign={handleAssign}
            onDelete={handleSortDelete}
          />
        )}
        {view === 'progress' && (
          <ProgressView
            topicName={topics.find((t) => t.id === selectedId)?.name || ''}
            entries={entries}
          />
        )}
        {view === 'revisit' && <Revisit entries={revisitEntries} onSeen={handleSeen} />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthGate>
      <Workspace />
    </AuthGate>
  )
}

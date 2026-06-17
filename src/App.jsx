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
import StatusFilter from './components/StatusFilter.jsx'
import TopicTOC from './components/TopicTOC.jsx'
import ProgressView from './components/ProgressView.jsx'
import Revisit from './components/Revisit.jsx'
import SettingsView from './components/SettingsView.jsx'

function Workspace() {
  const [topics, setTopics] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [entries, setEntries] = useState([])
  const [query, setQuery] = useState('')
  const [view, setView] = useState('browse') // 'browse' | 'bulk' | 'sort' | 'progress' | 'revisit' | 'settings'
  const [statusFilter, setStatusFilter] = useState('') // '' | 'backlog' | 'active' | 'done'
  const [inboxEntries, setInboxEntries] = useState([])
  const [revisitEntries, setRevisitEntries] = useState([])

  const inboxTopic = topics.find((t) => t.name === 'Inbox')

  useEffect(() => {
    refreshTopics()
    
    // Handle OAuth redirect from GitHub for backup linking
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code && window.location.pathname.includes('/settings')) {
      handleGitHubCallback(code)
    }
  }, [])

  async function refreshTopics() {
    const t = await listTopics(supabase)
    setTopics(t)
    if (t.length && !selectedId) setSelectedId(t[0].id)
  }

  async function handleGitHubCallback(code) {
    setView('settings')
    window.history.replaceState({}, document.title, window.location.pathname)
    const { data, error } = await supabase.functions.invoke('github-token', {
      body: { code }
    })
    if (error) alert(`GitHub Connection Failed: ${error.message}`)
    else window.location.reload() // Refresh to load new config
  }

  // Auto-backup debouncer
  useEffect(() => {
    const timer = setTimeout(async () => {
      const { data: config } = await supabase.from('user_configs').select('auto_backup').single()
      if (config?.auto_backup) {
        supabase.functions.invoke('github-backup', { body: { action: 'push' } })
      }
    }, 60000) // 1 minute debounce
    return () => clearTimeout(timer)
  }, [entries, topics])

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

  async function handleTogglePin(entryId, pinned) {
    const updated = await updateEntry(supabase, entryId, { pinned })
    setEntries((prev) => {
      const next = prev.map((e) => (e.id === entryId ? { ...updated, tags: e.tags } : e))
      return [...next].sort((a, b) => (b.pinned === a.pinned ? 0 : b.pinned ? 1 : -1))
    })
  }

  async function handleNoteSave(entryId, note) {
    const updated = await updateEntry(supabase, entryId, { note })
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...updated, tags: e.tags } : e)))
  }

  async function loadInbox() {
    if (inboxTopic) setInboxEntries(await listEntriesByTopic(supabase, inboxTopic.id))
  }

  async function handleBulkImport(items) {
    const inbox = inboxTopic || (await getTopicByName(supabase, 'Inbox'))
    const created = await bulkCreateEntries(supabase, inbox.id, items)
    return created.length
  }

  async function handleSmartImport(importedEntries) {
    const byTopic = {}
    for (const e of importedEntries) {
      const t = e.suggested_topic || 'Inbox'
      if (!byTopic[t]) byTopic[t] = []
      byTopic[t].push(e)
    }

    let total = 0
    const newTopics = []

    for (const [topicName, items] of Object.entries(byTopic)) {
      let topic = topics.find((t) => t.name === topicName)
      if (!topic) {
        topic = await createTopic(supabase, topicName)
        newTopics.push(topic)
      }
      const created = await bulkCreateEntries(supabase, topic.id, items)
      total += created.length
    }

    if (newTopics.length > 0) {
      setTopics((prev) => [...prev, ...newTopics].sort((a, b) => a.name.localeCompare(b.name)))
    }

    return total
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
          <li><button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>Settings</button></li>
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
            <StatusFilter value={statusFilter} onChange={setStatusFilter} />
            <TopicTOC entries={entries} />
            <EntryList
              entries={statusFilter ? entries.filter((e) => e.status === statusFilter) : entries}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              onTagsChange={handleTagsChange}
              onTogglePin={handleTogglePin}
              onNoteSave={handleNoteSave}
            />
          </>
        )}
        {view === 'bulk' && (
          <BulkImport
            onImport={handleBulkImport}
            onSmartImport={handleSmartImport}
            topics={topics}
          />
        )}
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
        {view === 'settings' && <SettingsView topics={topics} onRefreshData={refreshTopics} />}
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

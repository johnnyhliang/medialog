import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient.js'
import { listTopics, createTopic } from './lib/db/topics.js'
import {
  listEntriesByTopic, createEntry, deleteEntry, searchEntries,
} from './lib/db/entries.js'
import AuthGate from './components/AuthGate.jsx'
import TopicList from './components/TopicList.jsx'
import EntryList from './components/EntryList.jsx'
import QuickAdd from './components/QuickAdd.jsx'
import SearchBar from './components/SearchBar.jsx'

function Workspace() {
  const [topics, setTopics] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [entries, setEntries] = useState([])
  const [query, setQuery] = useState('')

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
    setEntries((prev) => [e, ...prev])
  }

  async function handleDelete(id) {
    await deleteEntry(supabase, id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <div style={{ display: 'flex', gap: 24, padding: 16 }}>
      <aside style={{ minWidth: 160 }}>
        <h1>MediaLog</h1>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        <TopicList
          topics={topics}
          selectedId={selectedId}
          onSelect={(id) => { setSelectedId(id); setQuery('') }}
          onAdd={handleAddTopic}
        />
      </aside>
      <main style={{ flex: 1 }}>
        <SearchBar value={query} onChange={setQuery} />
        {!query && selectedId && (
          <QuickAdd onAdd={handleAddEntry} disabled={!selectedId} />
        )}
        <EntryList entries={entries} onDelete={handleDelete} />
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

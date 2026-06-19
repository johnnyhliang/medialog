import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { LayoutGrid, Upload, Inbox, RotateCcw, BarChart2, Settings2, Trash2 as TrashIcon, Download, Menu } from 'lucide-react'
import { supabase } from './lib/supabaseClient.js'
import { listTopics, createTopic, getTopicByName } from './lib/db/topics.js'
import {
  listEntriesByTopic, createEntry, updateEntry, searchEntries,
  bulkCreateEntries, listForRevisit, markSurfaced, listRecentActivity,
  softDeleteEntry, listTrashedEntries, restoreEntry, emptyTrash,
} from './lib/db/entries.js'
import { setEntryTags, listTags, updateTagColor } from './lib/db/tags.js'
import { listVersions, createVersion } from './lib/db/versions.js'
import { fetchTitle } from './lib/enrich.js'
import { buildMarkdownFiles } from './lib/exportMarkdown.js'
import { buildZip, downloadBlob } from './lib/buildZip.js'
import AuthGate from './components/AuthGate.jsx'
import TopicList from './components/TopicList.jsx'
import QuickAdd from './components/QuickAdd.jsx'
import BulkImport from './components/BulkImport.jsx'
import SortInbox from './components/SortInbox.jsx'
import ProgressView from './components/ProgressView.jsx'
import Revisit from './components/Revisit.jsx'
import SettingsView from './components/SettingsView.jsx'
import TrashView from './components/TrashView.jsx'
import TopicView from './components/TopicView.jsx'
import VersionHistory from './components/VersionHistory.jsx'
import Modal from './components/Modal.jsx'
import { useFilePreview } from './hooks/useFilePreview.js'
import useToast from './hooks/useToast.js'
import Toast from './components/Toast.jsx'
const FilePreviewModal = lazy(() => import('./components/FilePreviewModal.jsx'))

function Workspace() {
  const [topics, setTopics] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [entries, setEntries] = useState([])
  const [globalSearchResults, setGlobalSearchResults] = useState(null)
  const [view, setView] = useState('browse') // 'browse' | 'bulk' | 'sort' | 'progress' | 'revisit' | 'settings' | 'trash'
  const [inboxEntries, setInboxEntries] = useState([])
  const [revisitEntries, setRevisitEntries] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [trashEntries, setTrashEntries] = useState([])
  const [historyFor, setHistoryFor] = useState(null)
  const [versions, setVersions] = useState([])
  const [allTags, setAllTags] = useState([])

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem('medialog_sidebar_open') !== 'false' } catch { return true }
  })

  function toggleSidebar() {
    setSidebarOpen((prev) => {
      const next = !prev
      try { localStorage.setItem('medialog_sidebar_open', String(next)) } catch {}
      return next
    })
  }

  const { previewUrl, openPreview, closePreview } = useFilePreview()
  const { toasts, addToast, dismissToast } = useToast()

  const inboxTopic = topics.find((t) => t.name === 'Inbox')
  const selectedTopic = topics.find((t) => t.id === selectedId) || null

  // Candidate index for the [[ autocomplete (current topic's entries).
  const candidateIndex = useMemo(() => {
    const topicName = selectedTopic?.name || ''
    return entries.map((e) => ({
      id: e.id,
      title: e.title || 'Untitled',
      topicId: selectedId,
      topicName,
    }))
  }, [entries, selectedId, selectedTopic])

  function handleDocChange(topicId, doc) {
    setTopics((prev) => prev.map((t) => (t.id === topicId ? { ...t, master_doc: doc } : t)))
  }

  const tagColors = useMemo(
    () => Object.fromEntries(allTags.filter(t => t.color).map(t => [t.name, t.color])),
    [allTags]
  )

  useEffect(() => {
    refreshTopics()
    refreshTags()

    // Handle OAuth redirect from GitHub for backup linking
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code && window.location.pathname.includes('/settings')) {
      handleGitHubCallback(code)
    }
  }, [])

  async function refreshTags() {
    const tags = await listTags(supabase)
    setAllTags(tags)
  }

  async function handleUpdateTagColor(tagName, color) {
    const tag = allTags.find(t => t.name === tagName)
    if (!tag) return
    await updateTagColor(supabase, tag.id, color)
    setAllTags(prev => prev.map(t => t.name === tagName ? { ...t, color: color || null } : t))
  }

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

  // Auto-backup: fires 60s after the last change, won't reset on every keystroke
  const autoBackupTimer = useRef(null)
  const pendingBackup = useRef(false)
  useEffect(() => {
    pendingBackup.current = true
    if (autoBackupTimer.current) return // timer already running — let it fire
    autoBackupTimer.current = setTimeout(async () => {
      autoBackupTimer.current = null
      if (!pendingBackup.current) return
      pendingBackup.current = false
      try {
        const { data: config } = await supabase.from('user_configs').select('auto_backup').maybeSingle()
        if (config?.auto_backup) {
          await supabase.functions.invoke('github-backup', { body: { action: 'push' } })
          addToast('Auto-backup complete', 'success')
        }
      } catch {
        // auto-backup failures are silent — user can trigger manually in Settings
      }
    }, 60000)
  }, [entries, topics])

  useEffect(() => {
    if (selectedId) {
      listEntriesByTopic(supabase, selectedId).then(setEntries)
    } else {
      setEntries([])
    }
  }, [selectedId])

  async function handleSearchAll(q) {
    if (!q.trim()) { setGlobalSearchResults(null); return }
    const results = await searchEntries(supabase, q.trim())
    setGlobalSearchResults(results)
  }

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
    await softDeleteEntry(supabase, id)
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

  async function handleTitleChange(entryId, title, url) {
    const patch = url !== undefined ? { title, url } : { title }
    const updated = await updateEntry(supabase, entryId, patch)
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...updated, tags: e.tags } : e)))
  }

  async function handleMove(entryId, newTopicId) {
    await updateEntry(supabase, entryId, { topic_id: newTopicId })
    setEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  async function handleNoteVersion(entryId, note) {
    await createVersion(supabase, entryId, note)
  }

  async function handleShowHistory(entryId) {
    setVersions(await listVersions(supabase, entryId))
    setHistoryFor(entryId)
  }

  async function handleRestoreVersion(note) {
    const updated = await updateEntry(supabase, historyFor, { note })
    await createVersion(supabase, historyFor, note)
    setEntries((prev) => prev.map((e) => (e.id === historyFor ? { ...updated, tags: e.tags } : e)))
    setHistoryFor(null)
  }

  async function loadInbox() {
    if (inboxTopic) setInboxEntries(await listEntriesByTopic(supabase, inboxTopic.id))
  }

  // Fire-and-forget: fetch titles for newly created entries that have a URL but no title yet
  async function enrichEntries(created) {
    for (const e of created) {
      if (e.url && !e.title) {
        const title = await fetchTitle(supabase, e.url)
        if (title) await updateEntry(supabase, e.id, { title })
      }
    }
  }

  async function handleBulkImport(items) {
    const inbox = inboxTopic || (await getTopicByName(supabase, 'Inbox'))
    const created = await bulkCreateEntries(supabase, inbox.id, items)
    enrichEntries(created)   // ← fire-and-forget
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
    const allCreated = []

    for (const [topicName, items] of Object.entries(byTopic)) {
      let topic = topics.find((t) => t.name === topicName)
      if (!topic) {
        topic = await createTopic(supabase, topicName)
        newTopics.push(topic)
      }
      const created = await bulkCreateEntries(supabase, topic.id, items)
      allCreated.push(...created)
      total += created.length
    }

    if (newTopics.length > 0) {
      setTopics((prev) => [...prev, ...newTopics].sort((a, b) => a.name.localeCompare(b.name)))
    }

    enrichEntries(allCreated)   // ← fire-and-forget
    return total
  }

  async function handleAssign(entryId, topicId) {
    await updateEntry(supabase, entryId, { topic_id: topicId })
    setInboxEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  async function handleSortDelete(entryId) {
    await softDeleteEntry(supabase, entryId)
    setInboxEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  async function loadTrash() {
    setTrashEntries(await listTrashedEntries(supabase))
  }

  async function handleRestore(entryId) {
    await restoreEntry(supabase, entryId)
    setTrashEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  async function handleEmptyTrash() {
    await emptyTrash(supabase)
    setTrashEntries([])
  }

  async function loadRevisit() {
    setRevisitEntries(await listForRevisit(supabase, 10))
    setRecentActivity(await listRecentActivity(supabase, 30))
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
    <div className={`app${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
      {/* Mobile topbar */}
      <header className="mobile-topbar">
        <h1>MediaLog</h1>
        <button className="hamburger-btn" onClick={toggleSidebar} aria-label="Toggle menu">
          <Menu size={22} />
        </button>
      </header>

      {/* Sidebar overlay (mobile) */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`}
        onClick={toggleSidebar}
      />

      <aside className={`sidebar${sidebarOpen ? ' mobile-open' : ''}`}>
        <div className="brand-row">
          <h1>MediaLog</h1>
          <button className="signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
        <ul className="nav">
          <li>
            <button className={view === 'browse' ? 'active' : ''} onClick={() => setView('browse')} title="Browse">
              <LayoutGrid size={16} /><span>Browse</span>
            </button>
          </li>
          <li>
            <button className={view === 'bulk' ? 'active' : ''} onClick={() => setView('bulk')} title="Bulk Import">
              <Upload size={16} /><span>Bulk Import</span>
            </button>
          </li>
          <li>
            <button className={view === 'sort' ? 'active' : ''} onClick={() => { setView('sort'); loadInbox() }} title="Sort Inbox">
              <Inbox size={16} /><span>Sort Inbox</span>
            </button>
          </li>
          <li>
            <button className={view === 'revisit' ? 'active' : ''} onClick={() => { setView('revisit'); loadRevisit() }} title="Revisit">
              <RotateCcw size={16} /><span>Revisit</span>
            </button>
          </li>
          <li>
            <button className={view === 'progress' ? 'active' : ''} onClick={() => setView('progress')} title="Progress">
              <BarChart2 size={16} /><span>Progress</span>
            </button>
          </li>
          <li>
            <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')} title="Settings">
              <Settings2 size={16} /><span>Settings</span>
            </button>
          </li>
          <li>
            <button className={view === 'trash' ? 'active' : ''} onClick={() => { setView('trash'); loadTrash() }} title="Trash">
              <TrashIcon size={16} /><span>Trash</span>
            </button>
          </li>
          <li>
            <button onClick={handleExport} title="Export">
              <Download size={16} /><span>Export</span>
            </button>
          </li>
        </ul>
        <TopicList
          topics={topics}
          selectedId={selectedId}
          onSelect={(id) => { setSelectedId(id); setGlobalSearchResults(null); setView('browse') }}
          onAdd={handleAddTopic}
          sidebarCollapsed={!sidebarOpen}
        />
        <button className="sidebar-toggle" onClick={toggleSidebar} title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
          {sidebarOpen ? '‹' : '›'}
        </button>
      </aside>
      <main className="main">
        <div key={view === 'browse' ? `browse-${selectedId}` : view} className="view-enter">
        {view === 'browse' && selectedTopic && (
          <TopicView
            key={selectedTopic.id}
            topic={selectedTopic}
            topics={topics}
            entries={entries}
            allCandidates={candidateIndex}
            onAddEntry={handleAddEntry}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
            onTagsChange={handleTagsChange}
            onTogglePin={handleTogglePin}
            onNoteSave={handleNoteSave}
            onPreview={openPreview}
            onDocChange={(doc) => handleDocChange(selectedTopic.id, doc)}
            onNoteVersion={handleNoteVersion}
            onShowHistory={handleShowHistory}
            onSearchAll={handleSearchAll}
            globalSearchResults={globalSearchResults}
            onTitleChange={handleTitleChange}
            onMove={handleMove}
            tagColors={tagColors}
            allTags={allTags}
          />
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
        {view === 'revisit' && <Revisit entries={revisitEntries} onSeen={handleSeen} recentActivity={recentActivity} />}
        {view === 'settings' && <SettingsView topics={topics} onRefreshData={refreshTopics} addToast={addToast} allTags={allTags} onUpdateTagColor={handleUpdateTagColor} />}
        {view === 'trash' && (
          <TrashView
            entries={trashEntries}
            onRestore={handleRestore}
            onEmptyTrash={handleEmptyTrash}
          />
        )}
        </div>
      </main>
      {previewUrl && (
        <Suspense fallback={null}>
          <FilePreviewModal url={previewUrl} onClose={closePreview} />
        </Suspense>
      )}
      <Toast toasts={toasts} onDismiss={dismissToast} />
      {historyFor && (
        <Modal onClose={() => setHistoryFor(null)} label="Version history" maxWidth="560px">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '70vh', overflow: 'auto' }}>
            <p className="section-label">Version history</p>
            <VersionHistory versions={versions} onRestore={handleRestoreVersion} />
            <button onClick={() => setHistoryFor(null)}>Close</button>
          </div>
        </Modal>
      )}
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

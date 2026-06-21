// src/App.jsx
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Search, Upload, Inbox, RotateCcw, BarChart2, Settings2, Trash2 as TrashIcon, Download, Menu, Home, FolderOpen, Rss, Briefcase } from 'lucide-react'
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
import FeedView from './components/FeedView.jsx'
import ApplicationsView from './components/ApplicationsView.jsx'
import ExploreView from './components/ExploreView.jsx'
import HomeView from './components/HomeView.jsx'
import FilesView from './components/FilesView.jsx'
import TopicView from './components/TopicView.jsx'
import ExportModal from './components/ExportModal.jsx'
import VersionHistoryModal from './components/VersionHistoryModal.jsx'
import { useFilePreview } from './hooks/useFilePreview.js'
import useToast from './hooks/useToast.js'
import Toast from './components/Toast.jsx'
import { useTopics } from './hooks/useTopics.js'
import { useEntries } from './hooks/useEntries.js'
import { usePendingArchive } from './hooks/usePendingArchive.js'
import { useInbox } from './hooks/useInbox.js'
import { useTrash } from './hooks/useTrash.js'
import { useRevisit } from './hooks/useRevisit.js'
import { useTags } from './hooks/useTags.js'
import { useVersions } from './hooks/useVersions.js'
import { useExport } from './hooks/useExport.js'
import { useArchiveToast } from './hooks/useArchiveToast.js'
const FilePreviewModal = lazy(() => import('./components/FilePreviewModal.jsx'))

function Workspace() {
  const { topics, setTopics, selectedId, setSelectedId, inboxCount, setInboxCount, selectedTopic, inboxTopic, applyAddTopic } = useTopics()
  const { entries, setEntries, globalSearchResults, setGlobalSearchResults, applyUpdateEntry, applyDeleteEntry, applyMoveEntry } = useEntries()
  const { pendingArchiveIds, addPending, removePending } = usePendingArchive(selectedId)
  const { inboxEntries, setInboxEntries, applyAssign, applySortDelete } = useInbox()
  const { trashEntries, setTrashEntries, applyRestore, applyClear } = useTrash()
  const { revisitEntries, setRevisitEntries, recentActivity, setRecentActivity, applySeen } = useRevisit()
  const { allTags, setAllTags, tagColors, applyUpdateTagColor } = useTags()
  const { historyFor, versions, openHistory, closeHistory } = useVersions()
  const { exportModal, openExportLoading, setExportResult, closeExportModal } = useExport()
  const { archiveToast, setArchiveToast } = useArchiveToast()
  const [trashToast, setTrashToast] = useState(() => {
    try { return localStorage.getItem('medialog_trash_toast') !== 'false' } catch { return true }
  })
  const { previewUrl, openPreview, closePreview } = useFilePreview()
  const { toasts, addToast, dismissToast } = useToast()

  const [view, setView] = useState('home')
  const [trackPrefill, setTrackPrefill] = useState(null)

  function handleTrack(opportunity) {
    setTrackPrefill(opportunity)
    setView('applications')
  }
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      // v2: sidebar defaults open; only respect a stored 'false' if user explicitly set it post-fix
      const stored = localStorage.getItem('medialog_sidebar_open')
      const migrated = localStorage.getItem('medialog_sidebar_migrated')
      if (!migrated) {
        localStorage.removeItem('medialog_sidebar_open')
        localStorage.setItem('medialog_sidebar_migrated', '1')
        return true
      }
      return stored !== 'false'
    } catch { return true }
  })

  function toggleSidebar() {
    setSidebarOpen((prev) => {
      const next = !prev
      try { localStorage.setItem('medialog_sidebar_open', String(next)) } catch {}
      return next
    })
  }

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

  function handleTopicIconChange(topicId, icon) {
    setTopics((prev) => prev.map((t) => (t.id === topicId ? { ...t, icon } : t)))
  }

  useEffect(() => {
    supabase.from('user_configs').select('archive_toast').maybeSingle().then(({ data }) => {
      if (data && typeof data.archive_toast === 'boolean') setArchiveToast(data.archive_toast)
    })
  }, [])

  useEffect(() => {
    refreshTopics()
    refreshTags()
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code && window.location.pathname.includes('/settings')) {
      handleGitHubCallback(code)
    }
  }, [])

  const autoBackupTimer = useRef(null)
  const pendingBackup = useRef(false)
  const pendingEntryScroll = useRef(null)
  useEffect(() => {
    pendingBackup.current = true
    if (autoBackupTimer.current) return
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
        // auto-backup failures are silent
      }
    }, 60000)
  }, [entries, topics])

  useEffect(() => {
    if (selectedId) {
      listEntriesByTopic(supabase, selectedId).then(data => {
        setEntries(data)
        if (pendingEntryScroll.current) {
          const id = pendingEntryScroll.current
          pendingEntryScroll.current = null
          setTimeout(() => {
            document.getElementById(`entry-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 150)
        }
      })
    } else {
      setEntries([])
    }
  }, [selectedId])

  async function refreshTags() {
    const tags = await listTags(supabase)
    setAllTags(tags)
  }

  async function handleUpdateTagColor(tagName, color) {
    const tag = allTags.find(t => t.name === tagName)
    if (!tag) return
    await updateTagColor(supabase, tag.id, color)
    applyUpdateTagColor(tagName, color)
  }

  async function refreshTopics() {
    const t = await listTopics(supabase)
    setTopics(t)
    const inbox = t.find((topic) => topic.name === 'Inbox')
    if (inbox) {
      const { count } = await supabase
        .from('entries')
        .select('id', { count: 'exact', head: true })
        .eq('topic_id', inbox.id)
        .is('deleted_at', null)
      setInboxCount(count ?? 0)
    }
  }

  async function handleGitHubCallback(code) {
    setView('settings')
    window.history.replaceState({}, document.title, window.location.pathname)
    const { data, error } = await supabase.functions.invoke('github-token', { body: { code } })
    if (error) alert(`GitHub Connection Failed: ${error.message}`)
    else window.location.reload()
  }

  async function handleToggleArchiveToast(val) {
    setArchiveToast(val)
    await supabase.from('user_configs').update({ archive_toast: val }).eq('user_id', (await supabase.auth.getUser()).data.user.id)
  }

  async function handleSearchAll(q) {
    if (!q.trim()) { setGlobalSearchResults(null); return }
    const results = await searchEntries(supabase, q.trim())
    setGlobalSearchResults(results)
  }

  async function handleCheckDuplicate(url) {
    if (!url) return null
    const { data } = await supabase
      .from('entries')
      .select('id, created_at, topics(name)')
      .eq('url', url)
      .is('deleted_at', null)
      .limit(1)
    const row = data?.[0]
    if (!row) return null
    return { id: row.id, created_at: row.created_at, topic_name: row.topics?.name || 'Unknown' }
  }

  async function handleAddTopic(name) {
    const t = await createTopic(supabase, name)
    applyAddTopic(t)
  }

  async function handleAddEntry({ url, note, title: prefetchedTitle }) {
    const e = await createEntry(supabase, { topicId: selectedId, url, note })
    setEntries((prev) => [{ ...e, tags: [] }, ...prev])
    if (url) {
      const title = prefetchedTitle ?? await fetchTitle(supabase, url)
      if (title) {
        const updated = await updateEntry(supabase, e.id, { title })
        applyUpdateEntry(e.id, updated)
      }
    }
  }

  function handleToggleTrashToast(val) {
    setTrashToast(val)
    try { localStorage.setItem('medialog_trash_toast', val) } catch {}
  }

  async function handleUndoTrash(entry) {
    await restoreEntry(supabase, entry.id)
    applyRestore(entry.id)
    if (entry.topic_id === selectedId) {
      setEntries((prev) => [entry, ...prev])
    }
  }

  async function handleDelete(id) {
    const entry = entries.find((e) => e.id === id)
    await softDeleteEntry(supabase, id)
    applyDeleteEntry(id)
    if (trashToast && entry) {
      addToast('Moved to trash', 'info', {
        duration: 5000,
        actions: [{ label: 'Undo', onClick: () => handleUndoTrash(entry) }],
      })
    }
  }

  async function handleStatusChange(entryId, status) {
    const entry = entries.find(e => e.id === entryId)
    const prevStatus = entry?.status || null
    const updated = await updateEntry(supabase, entryId, { status })
    applyUpdateEntry(entryId, updated)

    if (status === 'done') {
      if (archiveToast) {
        addPending(entryId)
        addToast(
          'Moved to archive',
          'info',
          {
            duration: 3000,
            actions: [{ label: 'Undo', onClick: () => handleUndoArchive(entryId, prevStatus) }],
            onExpire: () => removePending(entryId),
          }
        )
      }
    } else {
      removePending(entryId)
    }
  }

  async function handleUndoArchive(entryId, prevStatus) {
    const updated = await updateEntry(supabase, entryId, { status: prevStatus })
    applyUpdateEntry(entryId, updated)
    removePending(entryId)
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
    applyUpdateEntry(entryId, updated)
  }

  async function handleTitleChange(entryId, title, url) {
    const patch = url !== undefined ? { title, url } : { title }
    const updated = await updateEntry(supabase, entryId, patch)
    applyUpdateEntry(entryId, updated)
  }

  async function handleMove(entryId, newTopicId) {
    await updateEntry(supabase, entryId, { topic_id: newTopicId })
    applyMoveEntry(entryId)
  }

  async function handleNoteVersion(entryId, note) {
    await createVersion(supabase, entryId, note)
  }

  async function handleShowHistory(entryId) {
    const versionList = await listVersions(supabase, entryId)
    openHistory(entryId, versionList)
  }

  async function handleRestoreVersion(note) {
    const updated = await updateEntry(supabase, historyFor, { note })
    await createVersion(supabase, historyFor, note)
    applyUpdateEntry(historyFor, updated)
    closeHistory()
  }

  async function loadInbox() {
    if (inboxTopic) setInboxEntries(await listEntriesByTopic(supabase, inboxTopic.id))
  }

  function handleSortInbox() {
    setView('sort')
    loadInbox()
  }

  function handleSelectTopic(topic) {
    setSelectedId(topic.id)
    setGlobalSearchResults(null)
    setView('browse')
  }

  function handleSelectEntry(entry) {
    pendingEntryScroll.current = entry.id
    setSelectedId(entry.topic_id)
    setGlobalSearchResults(null)
    setView('browse')
  }

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
    enrichEntries(created)
    setInboxCount((prev) => prev + created.length)
    return created.length
  }

  async function handleSaveFromFeed(item, topicId) {
    const entry = await createEntry(supabase, { topicId, url: item.url, title: item.title, note: item.note || '' })
    enrichEntries([entry])
    if (selectedId === topicId) setEntries((prev) => [entry, ...prev])
    const inbox = topics.find((t) => t.name === 'Inbox')
    if (inbox && topicId === inbox.id) setInboxCount((prev) => prev + 1)
    addToast('saved to ' + (topics.find((t) => t.id === topicId)?.name ?? 'topic'), 'success')
  }

  async function handleArchiveImport(topicId, items) {
    const created = await bulkCreateEntries(supabase, topicId, items)
    enrichEntries(created)
    if (selectedId === topicId) {
      setEntries((prev) => [...created, ...prev])
    }
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

    enrichEntries(allCreated)
    return total
  }

  async function handleAssign(entryId, topicId) {
    await updateEntry(supabase, entryId, { topic_id: topicId })
    applyAssign(entryId)
    setInboxCount((prev) => Math.max(0, prev - 1))
  }

  async function handleSortDelete(entryId) {
    await softDeleteEntry(supabase, entryId)
    applySortDelete(entryId)
    setInboxCount((prev) => Math.max(0, prev - 1))
  }

  async function loadTrash() {
    setTrashEntries(await listTrashedEntries(supabase))
  }

  async function handleRestore(entryId) {
    await restoreEntry(supabase, entryId)
    applyRestore(entryId)
  }

  async function handleEmptyTrash() {
    await emptyTrash(supabase)
    applyClear()
  }

  async function loadRevisit() {
    setRevisitEntries(await listForRevisit(supabase, 10))
    setRecentActivity(await listRecentActivity(supabase, 30))
  }

  async function handleSeen(entryId) {
    await markSurfaced(supabase, entryId)
    applySeen(entryId)
  }

  async function handleExportClick() {
    openExportLoading()
    try {
      const { data, error } = await supabase
        .from('entries')
        .select('id, note, title, url')
        .is('deleted_at', null)
      if (error) throw error
      const rawBytes = (data || []).reduce((sum, e) => {
        return sum + (e.note?.length || 0) + (e.title?.length || 0) + (e.url?.length || 0)
      }, 0)
      const estimatedKB = Math.round((rawBytes * 1.15 * 0.35) / 1024) || 1
      setExportResult(estimatedKB, data.length)
    } catch {
      setExportResult(null, null)
    }
  }

  async function handleExportConfirm() {
    closeExportModal()
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
      <header className="mobile-topbar">
        <h1>MediaLog</h1>
        <button className="hamburger-btn" onClick={toggleSidebar} aria-label="Toggle menu">
          <Menu size={22} />
        </button>
      </header>

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
            <button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')} title="Home">
              <Home size={16} /><span>Home</span>
            </button>
          </li>
          <li>
            <button className={view === 'explore' ? 'active' : ''} onClick={() => setView('explore')} title="Explore">
              <Search size={16} /><span>Explore</span>
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
            <button className={view === 'files' ? 'active' : ''} onClick={() => setView('files')} title="Files">
              <FolderOpen size={16} /><span>Files</span>
            </button>
          </li>
          <li>
            <button className={view === 'feed' ? 'active' : ''} onClick={() => setView('feed')} title="Feed">
              <Rss size={16} /><span>Feed</span>
            </button>
          </li>
          <li>
            <button className={view === 'applications' ? 'active' : ''} onClick={() => setView('applications')} title="Applications">
              <Briefcase size={16} /><span>Applications</span>
            </button>
          </li>
          <li>
            <button onClick={handleExportClick} title="Export">
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
          <span className="sidebar-toggle-icon" style={{ transform: sidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}>‹</span>
          <span className="sidebar-toggle-label">{sidebarOpen ? 'collapse' : 'expand'}</span>
        </button>
      </aside>

      <main className="main">
        <div key={view === 'browse' ? `browse-${selectedId}` : view === 'explore' ? 'explore' : view} className="view-enter">
          {view === 'home' && (
            <HomeView
              topics={topics}
              inboxCount={inboxCount}
              onSelectTopic={handleSelectTopic}
              onSortInbox={handleSortInbox}
              onTopicIconChange={handleTopicIconChange}
              supabase={supabase}
              onTrack={handleTrack}
            />
          )}
          {view === 'explore' && (
            <ExploreView
              supabase={supabase}
              topics={topics}
              onSelectEntry={(entry) => {
                setSelectedId(entry.topic_id)
                setView('browse')
              }}
            />
          )}
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
              pendingArchiveIds={pendingArchiveIds}
              supabase={supabase}
              onCheckDuplicate={handleCheckDuplicate}
            />
          )}
          {view === 'bulk' && (
            <BulkImport
              onImport={handleBulkImport}
              onSmartImport={handleSmartImport}
              onArchiveImport={handleArchiveImport}
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
          {view === 'revisit' && (
            <Revisit entries={revisitEntries} onSeen={handleSeen} recentActivity={recentActivity} />
          )}
          {view === 'settings' && (
            <SettingsView
              topics={topics}
              onRefreshData={refreshTopics}
              addToast={addToast}
              allTags={allTags}
              onUpdateTagColor={handleUpdateTagColor}
              archiveToast={archiveToast}
              onToggleArchiveToast={handleToggleArchiveToast}
              trashToast={trashToast}
              onToggleTrashToast={handleToggleTrashToast}
            />
          )}
          {view === 'trash' && (
            <TrashView
              entries={trashEntries}
              onRestore={handleRestore}
              onEmptyTrash={handleEmptyTrash}
            />
          )}
          {view === 'files' && (
            <FilesView
              supabase={supabase}
              onSelectEntry={handleSelectEntry}
            />
          )}
          {view === 'feed' && (
            <FeedView
              supabase={supabase}
              topics={topics}
              onSaveItem={handleSaveFromFeed}
            />
          )}
          {view === 'applications' && (
            <ApplicationsView
              supabase={supabase}
              prefill={trackPrefill}
              onClearPrefill={() => setTrackPrefill(null)}
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
      {exportModal && (
        <ExportModal
          exportModal={exportModal}
          topics={topics}
          onConfirm={handleExportConfirm}
          onClose={closeExportModal}
        />
      )}
      {historyFor && (
        <VersionHistoryModal
          versions={versions}
          onRestore={handleRestoreVersion}
          onClose={closeHistory}
        />
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

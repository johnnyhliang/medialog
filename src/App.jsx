// src/App.jsx
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, Upload, Inbox, RotateCcw, BarChart2, Settings2, Trash2 as TrashIcon, Download, Menu, Home, FolderOpen, Rss, Briefcase, PackageOpen, Archive, ScrollText, Highlighter, BookOpen } from 'lucide-react'
import { supabase } from './lib/supabaseClient.js'
import { listTopics, createTopic, getTopicByName, listDeletedTopics, archiveTopic, unarchiveTopic, softDeleteTopic, restoreDeletedTopic, togglePinTopic } from './lib/db/topics.js'
import {
  listEntriesByTopic, createEntry, updateEntry, searchEntries,
  bulkCreateEntries, listForRevisit, markSurfaced, listRecentActivity,
  softDeleteEntry, listTrashedEntries, restoreEntry, emptyTrash, snoozeEntry, rateRevisit,
} from './lib/db/entries.js'
import { setEntryTags, listTags, updateTagColor } from './lib/db/tags.js'
import { seedStarterTopic } from './lib/starterTopic.js'
import { getCommands } from './lib/commands.js'
import { resolveBindings, eventToKey } from './lib/keybindings.js'
import CommandPalette from './components/CommandPalette.jsx'
import AssistantPanel from './components/AssistantPanel.jsx'
import { Sparkles } from 'lucide-react'
import { listVersions, createVersion } from './lib/db/versions.js'
import { fetchTitle, fetchLinkPreview } from './lib/enrich.js'
import { preservationPatch } from './lib/preservation.js'
import { chunkEntryAsync } from './lib/chunkEntry.js'
import { track } from './lib/track.js'
import { runBackup } from './lib/db/githubBackup.js'
import { isDev } from './lib/account.js'
import { DEFAULT_FEATURE_FLAGS, loadFeatureFlags } from './lib/featureFlags.js'
import { isModuleVisible as checkModuleVisible } from './lib/modules.js'
import { DEFAULT_TIER, loadEntitlement, loadModulePrefs } from './lib/entitlements.js'
import { buildMarkdownFiles, buildTopicMarkdown, topicFilename } from './lib/exportMarkdown.js'
import { buildZip, downloadBlob } from './lib/buildZip.js'
import AuthGate from './components/AuthGate.jsx'
import TopicList from './components/TopicList.jsx'
import QuickAdd from './components/QuickAdd.jsx'
import SortInbox from './components/SortInbox.jsx'
import ProgressView from './components/ProgressView.jsx'
import Revisit from './components/Revisit.jsx'
import TrashView from './components/TrashView.jsx'
import HomeView from './components/HomeView.jsx'
import GuideView from './components/GuideView.jsx'
import NavSidebar from './components/NavSidebar.jsx'
// Heavy / infrequently-opened views are code-split so they don't bloat the
// initial bundle. They render inside the <Suspense> around the view area.
const BulkImport = lazy(() => import('./components/BulkImport.jsx'))
const ArchiveView = lazy(() => import('./components/ArchiveView.jsx'))
const SettingsView = lazy(() => import('./components/SettingsView.jsx'))
const FeedView = lazy(() => import('./components/FeedView.jsx'))
const CareerView = lazy(() => import('./components/CareerView.jsx'))
const HighlightsView = lazy(() => import('./components/HighlightsView.jsx'))
const DigestView = lazy(() => import('./components/DigestView.jsx'))
const ExploreView = lazy(() => import('./components/ExploreView.jsx'))
const FilesView = lazy(() => import('./components/FilesView.jsx'))
const TidyView = lazy(() => import('./components/TidyView.jsx'))
const InterviewView = lazy(() => import('./components/InterviewView.jsx'))
const ReadingView = lazy(() => import('./components/ReadingView.jsx'))
const DeepTopicView = lazy(() => import('./components/DeepTopicView.jsx'))
const MetricsView = lazy(() => import('./components/MetricsView.jsx'))
import TopicView from './components/TopicView.jsx'
import CatchOverlay from './components/CatchOverlay.jsx'
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
import { useArchiveToast } from './hooks/useArchiveToast.js'
import { readBoolPref, writePref } from './lib/localPref.js'
import { useTheme } from './hooks/useTheme.js'
const FilePreviewModal = lazy(() => import('./components/FilePreviewModal.jsx'))

function Workspace() {
  const { topics, setTopics, activeTopics, archivedTopics, selectedId, setSelectedId, inboxCount, setInboxCount, selectedTopic, inboxTopic, applyAddTopic, applyArchiveTopic, applyUnarchiveTopic, applyDeleteTopic, applyRestoreDeletedTopic } = useTopics()
  const [deletedTopics, setDeletedTopics] = useState([])
  const { entries, setEntries, globalSearchResults, setGlobalSearchResults, applyUpdateEntry, applyDeleteEntry, applyMoveEntry } = useEntries()
  const { pendingArchiveIds, addPending, removePending } = usePendingArchive(selectedId)
  const { inboxEntries, setInboxEntries, applyAssign, applySortDelete } = useInbox()
  const { trashEntries, setTrashEntries, applyRestore, applyClear } = useTrash()
  const { revisitEntries, setRevisitEntries, recentActivity, setRecentActivity, applySeen } = useRevisit()
  const { allTags, setAllTags, tagColors, applyUpdateTagColor } = useTags()
  const { historyFor, versions, openHistory, closeHistory } = useVersions()
  const [exportBusy, setExportBusy] = useState(false)
  const { archiveToast, setArchiveToast } = useArchiveToast()
  const { palette: themePalette, style: themeStyle, setPalette, setStyle } = useTheme()
  const [trashToast, setTrashToast] = useState(() => readBoolPref('medialog_trash_toast', true))
  const { previewUrl, openPreview, closePreview } = useFilePreview()
  const { toasts, addToast, dismissToast } = useToast()

  const [view, setView] = useState('home')
  const [deepTopicId, setDeepTopicId] = useState(null)
  const [catchOpen, setCatchOpen] = useState(false)

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [focusedEntryId, setFocusedEntryId] = useState(null)
  const [orderedEntryIds, setOrderedEntryIds] = useState([])
  const [snoozeTarget, setSnoozeTarget] = useState(null)
  const [editTargetId, setEditTargetId] = useState(null)
  const [user, setUser] = useState(null)
  const [featureFlags, setFeatureFlags] = useState(DEFAULT_FEATURE_FLAGS)
  const [tier, setTier] = useState(DEFAULT_TIER)
  const [modulePrefs, setModulePrefs] = useState(null)
  // Composed gate: entitlement (tier) AND preference (modulePrefs). See
  // src/lib/modules.js — this is cosmetic, RLS is the real enforcement.
  const isModuleVisible = useCallback(
    (id) => checkModuleVisible(id, { tier, prefs: modulePrefs, isDev, flags: featureFlags }),
    [tier, modulePrefs, featureFlags]
  )
  const showFounder = tier === 'founder' || isDev
  // Assistant: founder-only, and separately enable/disableable (persisted).
  const [assistantEnabled, setAssistantEnabled] = useState(() => readBoolPref('medialog_assistant_enabled', true))
  const [assistantOpen, setAssistantOpen] = useState(false)
  function toggleAssistant() {
    setAssistantOpen((v) => !v)
  }

  const focusedEntry = focusedEntryId
    ? (entries.find((e) => e.id === focusedEntryId) ?? null)
    : null

  const pendingKeyRef = useRef(null)
  const pendingKeyTimerRef = useRef(null)

  function focusNextEntry() {
    if (!orderedEntryIds.length) return
    const idx = orderedEntryIds.indexOf(focusedEntryId)
    const next = orderedEntryIds[idx + 1] ?? orderedEntryIds[0]
    setFocusedEntryId(next)
  }

  function focusPrevEntry() {
    if (!orderedEntryIds.length) return
    const idx = orderedEntryIds.indexOf(focusedEntryId)
    const prev = orderedEntryIds[idx - 1] ?? orderedEntryIds[orderedEntryIds.length - 1]
    setFocusedEntryId(prev)
  }

  function editFocusedEntry() {
    setEditTargetId(focusedEntryId)
  }

  async function cycleFocusedStatus() {
    if (!focusedEntry) return
    const cycle = { backlog: 'active', active: 'done', done: 'backlog' }
    const next = cycle[focusedEntry.status] ?? 'backlog'
    const updated = await updateEntry(supabase, focusedEntry.id, { status: next })
    applyUpdateEntry(focusedEntry.id, updated)
  }

  const paletteCommands = useMemo(() => getCommands({
    setView,
    setSelectedId,
    inboxTopic,
    topics,
    focusedEntry,
    openPalette: () => setPaletteOpen(true),
    closePalette: () => setPaletteOpen(false),
    focusNextEntry,
    focusPrevEntry,
    editFocusedEntry,
    cycleFocusedStatus,
    openSnooze: (entry) => entry && setSnoozeTarget(entry),
    openCatch: () => setCatchOpen(true),
    // Omitted entirely when the assistant is unavailable, so getCommands drops
    // the binding rather than registering a shortcut that does nothing.
    toggleAssistant: showFounder && assistantEnabled ? toggleAssistant : undefined,
  }), [view, focusedEntry, topics, inboxTopic, showFounder, assistantEnabled])

  function navigateTo(v) {
    setView(v)
    setFocusedEntryId(null)
    setOrderedEntryIds([])
  }

  function navigateToTopic(topicId) {
    setSelectedId(topicId)
    navigateTo('browse')
  }

  async function handleSnoozeFromPalette(entry, dateStr) {
    await snoozeEntry(supabase, entry.id, dateStr)
    applyUpdateEntry(entry.id, { ...entry, surface_after: dateStr })
    setSnoozeTarget(null)
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

  useEffect(() => {
    if (showFounder) return
    if (view === 'career') setView('home')
    setAssistantOpen(false)
  }, [showFounder, view])

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

  // Retention hook. Fires on entering the digest view rather than inside
  // DigestView, which is lazy-loaded and has no supabase client of its own.
  useEffect(() => {
    if (view === 'digest') track(supabase, 'digest_opened')
  }, [view])

  useEffect(() => {
    supabase.from('user_configs').select('archive_toast').maybeSingle().then(({ data }) => {
      if (data && typeof data.archive_toast === 'boolean') setArchiveToast(data.archive_toast)
    })
  }, [])

  // Keyed on the user, not mounted once: tier and module prefs are per-account,
  // so signing in has to re-resolve them or a fresh session keeps the previous
  // account's gating.
  useEffect(() => {
    let cancelled = false
    if (!user) { setTier(DEFAULT_TIER); setModulePrefs(null); return }
    Promise.all([loadEntitlement(supabase), loadModulePrefs(supabase)])
      .then(([entitlement, prefs]) => {
        if (cancelled) return
        setTier(entitlement.tier)
        setModulePrefs(prefs)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    let cancelled = false
    async function refreshFeatureFlags() {
      const flags = await loadFeatureFlags(supabase)
      if (!cancelled) setFeatureFlags(flags)
    }
    refreshFeatureFlags()
    const featureFlagTimer = setInterval(refreshFeatureFlags, 60 * 1000)
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null)
    })
    refreshTopics()
    refreshTags()
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code && window.location.pathname.includes('/settings')) {
      handleGitHubCallback(code)
    }
    return () => {
      cancelled = true
      clearInterval(featureFlagTimer)
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
        const { data: config } = await supabase
          .from('user_configs')
          .select('auto_backup, github_token')
          .maybeSingle()
        if (config?.auto_backup && config?.github_token) {
          const res = await runBackup(supabase, { message: 'MediaLog auto-backup' })
          if (!res.unchanged) addToast('Auto-backup complete', 'success')
        }
      } catch (e) {
        // Never interrupt the user for a background backup, but record why it
        // failed — this path silently did nothing at all for months.
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('user_configs')
            .update({ last_error: String(e.message ?? e) })
            .eq('user_id', user.id)
        }
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

  useEffect(() => {
    if (navigator.maxTouchPoints > 0) return

    const bindings = resolveBindings(paletteCommands)

    function handleKeyDown(e) {
      const tag = document.activeElement?.tagName?.toLowerCase()
      const isEditing = tag === 'input' || tag === 'textarea' ||
        document.activeElement?.closest('[data-codemirror]') ||
        document.activeElement?.closest('.cm-editor')

      const key = eventToKey(e)

      // Commands flagged whileEditing run before the isEditing guard, so they
      // work with focus in an input. Previously ctrl+k was special-cased here and
      // the assistant toggle was hardcoded outright — which made it the one
      // shortcut that could not be discovered or remapped. Both are now ordinary
      // registry entries.
      const early = bindings.get(key)
      if (early?.whileEditing) {
        e.preventDefault()
        early.handler()
        return
      }

      if (isEditing) return

      if (pendingKeyRef.current) {
        const chord = `${pendingKeyRef.current} ${key}`
        clearTimeout(pendingKeyTimerRef.current)
        pendingKeyRef.current = null
        if (bindings.has(chord)) {
          e.preventDefault()
          bindings.get(chord).handler()
        }
        return
      }

      const startsChord = [...bindings.keys()].some((k) => k.startsWith(key + ' '))
      if (startsChord) {
        pendingKeyRef.current = key
        pendingKeyTimerRef.current = setTimeout(() => { pendingKeyRef.current = null }, 500)
        return
      }

      if (bindings.has(key)) {
        e.preventDefault()
        bindings.get(key).handler()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [paletteCommands, focusedEntryId, orderedEntryIds, showFounder, assistantEnabled])

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
    let t = await listTopics(supabase)
    // Brand-new account (Inbox only, or nothing): drop in the worked-example
    // topic so the first screen has something to read instead of a tour.
    if (t.filter((topic) => topic.name !== 'Inbox').length === 0) {
      const seeded = await seedStarterTopic(supabase, { createTopic, createEntry })
        .catch(() => null)
      if (seeded) t = await listTopics(supabase)
    }
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
    track(supabase, 'search_run', { mode: 'keyword' })
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
    track(supabase, 'topic_created')
    applyAddTopic(t)
  }

  async function handleAddEntry({ url, note, title: prefetchedTitle, tags = [], onTitleStatus, onEmbedStatus }) {
    let e
    try {
      e = await createEntry(supabase, { topicId: selectedId, url, note })
    } catch (err) {
      return { ok: false, error: err }
    }
    track(supabase, 'entry_created', { source: 'paste' })
    setEntries((prev) => [{ ...e, tags: [] }, ...prev])
    if (tags.length > 0) {
      await setEntryTags(supabase, e.id, tags)
      setEntries((prev) => prev.map((entry) => entry.id === e.id ? { ...entry, tags } : entry))
    }
    // Enrichment runs after returning success to caller
    ;(async () => {
      let finalEntry = e
      if (url) {
        onTitleStatus?.('fetching')
        try {
          const meta = await fetchLinkPreview(supabase, url)
          const title = prefetchedTitle ?? meta?.title ?? null
          const patch = {}
          if (title) patch.title = title
          if (meta?.image) patch.og_image = meta.image
          if (meta?.description) patch.og_description = meta.description
          Object.assign(patch, preservationPatch(meta))
          if (Object.keys(patch).length > 0) {
            const updated = await updateEntry(supabase, e.id, patch)
            applyUpdateEntry(e.id, updated)
            finalEntry = updated
          }
          onTitleStatus?.('done')
        } catch {
          onTitleStatus?.('failed')
        }
      }
      onEmbedStatus?.('indexing')
      try {
        await chunkEntryAsync(supabase, { ...finalEntry, note })
        onEmbedStatus?.('done')
      } catch {
        onEmbedStatus?.('failed')
      }
    })()
    return { ok: true }
  }

  // Catch mode: like handleAddEntry but always lands in Inbox, from anywhere.
  async function handleCatchEntry({ url, note, title: prefetchedTitle, onTitleStatus, onEmbedStatus }) {
    if (!inboxTopic) return { ok: false, error: new Error('no inbox') }
    let e
    try {
      e = await createEntry(supabase, { topicId: inboxTopic.id, url, note })
    } catch (err) {
      return { ok: false, error: err }
    }
    track(supabase, 'entry_created', { source: 'capture' })
    setInboxCount((c) => c + 1)
    if (selectedId === inboxTopic.id) setEntries((prev) => [{ ...e, tags: [] }, ...prev])
    ;(async () => {
      let finalEntry = e
      if (url) {
        onTitleStatus?.('fetching')
        try {
          const meta = await fetchLinkPreview(supabase, url)
          const title = prefetchedTitle ?? meta?.title ?? null
          const patch = {}
          if (title) patch.title = title
          if (meta?.image) patch.og_image = meta.image
          if (meta?.description) patch.og_description = meta.description
          Object.assign(patch, preservationPatch(meta))
          if (Object.keys(patch).length > 0) {
            const updated = await updateEntry(supabase, e.id, patch)
            finalEntry = updated
          }
          onTitleStatus?.('done')
        } catch {
          onTitleStatus?.('failed')
        }
      }
      onEmbedStatus?.('indexing')
      try {
        await chunkEntryAsync(supabase, { ...finalEntry, note })
        onEmbedStatus?.('done')
      } catch {
        onEmbedStatus?.('failed')
      }
    })()
    return { ok: true }
  }

  // PWA share target: /app.html?url=…&title=…&text=… from the OS share sheet
  // lands here. Save straight to Inbox, then clean the URL.
  useEffect(() => {
    if (!inboxTopic) return
    const params = new URLSearchParams(window.location.search)
    const sharedUrl = params.get('url') || null
    const sharedText = params.get('text') || ''
    const sharedTitle = params.get('title') || ''
    if (!sharedUrl && !sharedText && !sharedTitle) return
    // Android often puts the URL in `text`
    const urlFromText = !sharedUrl && /https?:\/\/\S+/.test(sharedText)
      ? sharedText.match(/https?:\/\/\S+/)[0]
      : null
    const note = [sharedTitle, urlFromText ? sharedText.replace(urlFromText, '').trim() : sharedText]
      .filter(Boolean).join(' — ')
    window.history.replaceState({}, '', window.location.pathname)
    handleCatchEntry({ url: sharedUrl || urlFromText, note })
      .then((r) => addToast(r?.ok !== false ? 'Saved to Inbox' : 'Share save failed', r?.ok !== false ? undefined : 'error'))
  }, [inboxTopic?.id])

  function handleToggleTrashToast(val) {
    setTrashToast(val)
    writePref('medialog_trash_toast', val)
  }

  async function handleUndoTrash(entry) {
    const inboxId = inboxTopic?.id
    await restoreEntry(supabase, entry.id, inboxId)
    applyRestore(entry.id)
    if (inboxId) setInboxCount((prev) => prev + 1)
  }

  async function handleDelete(id) {
    const entry = entries.find((e) => e.id === id)
    try {
      await softDeleteEntry(supabase, id)
    } catch {
      addToast('Failed to delete entry', 'error')
      return
    }
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
    let updated
    try {
      updated = await updateEntry(supabase, entryId, { status })
    } catch {
      addToast('Failed to update status', 'error')
      return
    }
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
    try {
      const updated = await updateEntry(supabase, entryId, { status: prevStatus })
      applyUpdateEntry(entryId, updated)
      removePending(entryId)
    } catch {
      addToast('Failed to undo archive', 'error')
    }
  }

  async function handleTagsChange(entryId, tags) {
    try {
      await setEntryTags(supabase, entryId, tags)
      setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, tags } : e)))
    } catch {
      addToast('Failed to update tags', 'error')
    }
  }

  async function handleTogglePin(entryId, pinned) {
    try {
      const updated = await updateEntry(supabase, entryId, { pinned })
      setEntries((prev) => {
        const next = prev.map((e) => (e.id === entryId ? { ...updated, tags: e.tags } : e))
        return [...next].sort((a, b) => (b.pinned === a.pinned ? 0 : b.pinned ? 1 : -1))
      })
    } catch {
      addToast('Failed to pin entry', 'error')
    }
  }

  async function handleNoteSave(entryId, note) {
    try {
      const updated = await updateEntry(supabase, entryId, { note })
      applyUpdateEntry(entryId, updated)
      chunkEntryAsync(supabase, updated)
    } catch {
      addToast('Note failed to save', 'error')
    }
  }

  async function handleTitleChange(entryId, title, url) {
    const patch = url !== undefined ? { title, url } : { title }
    try {
      const updated = await updateEntry(supabase, entryId, patch)
      applyUpdateEntry(entryId, updated)
    } catch {
      addToast('Failed to save title', 'error')
    }
  }

  async function handleMove(entryId, newTopicId) {
    try {
      await updateEntry(supabase, entryId, { topic_id: newTopicId })
    } catch {
      addToast('Failed to move entry', 'error')
      return
    }
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

  // A related passage only knows its entry id; resolve it and reuse the normal
  // select-and-scroll path so the target entry opens wherever it lives.
  async function handleOpenRelated(entryId) {
    // The related footer and the assistant can point at any entry, not just the
    // loaded topic's — fetch it if it isn't already in memory.
    let entry = entries.find((e) => e.id === entryId)
    if (!entry) {
      const { data } = await supabase.from('entries').select('id, topic_id').eq('id', entryId).maybeSingle()
      entry = data
    }
    if (entry) handleSelectEntry(entry)
  }

  async function enrichEntries(created) {
    for (const e of created) {
      // Text preservation must be attempted for EVERY url entry, not only ones
      // missing a title/image — a bulk import that arrives with titles already
      // filled in used to skip enrichment entirely and so never preserved text.
      if (!e.url) continue
      if (e.title && e.og_image && e.full_text_status) continue
      const meta = await fetchLinkPreview(supabase, e.url)
      const patch = {}
      if (!e.title && meta?.title) patch.title = meta.title
      if (!e.og_image && meta?.image) patch.og_image = meta.image
      if (!e.og_description && meta?.description) patch.og_description = meta.description
      if (!e.full_text) Object.assign(patch, preservationPatch(meta))
      if (Object.keys(patch).length === 0) continue
      const updated = await updateEntry(supabase, e.id, patch)
      applyUpdateEntry(e.id, updated)
      // Newly preserved text is a retrieval source, so index it. The caller's
      // own chunk pass ran against the pre-enrichment entry and saw no full_text.
      if (patch.full_text) chunkEntryAsync(supabase, updated)
    }
  }

  async function handleBulkImport(items) {
    const inbox = inboxTopic || (await getTopicByName(supabase, 'Inbox'))
    const created = await bulkCreateEntries(supabase, inbox.id, items)
    enrichEntries(created)
    created.forEach(e => chunkEntryAsync(supabase, e))
    // One event per entry, not per batch — track() batches the inserts.
    created.forEach(() => track(supabase, 'entry_created', { source: 'bulk' }))
    setInboxCount((prev) => prev + created.length)
    return created.length
  }

  async function handleSaveFromFeed(item, topicId) {
    const entry = await createEntry(supabase, { topicId, url: item.url, title: item.title, note: item.note || '' })
    enrichEntries([entry])
    chunkEntryAsync(supabase, entry)
    // Saving a single item out of the feed is a capture, not an import.
    track(supabase, 'entry_created', { source: 'capture' })
    if (selectedId === topicId) setEntries((prev) => [entry, ...prev])
    const inbox = topics.find((t) => t.name === 'Inbox')
    if (inbox && topicId === inbox.id) setInboxCount((prev) => prev + 1)
    addToast('saved to ' + (topics.find((t) => t.id === topicId)?.name ?? 'topic'), 'success')
  }

  async function handleArchiveImport(topicId, items) {
    const created = await bulkCreateEntries(supabase, topicId, items)
    enrichEntries(created)
    created.forEach(e => chunkEntryAsync(supabase, e))
    created.forEach(() => track(supabase, 'entry_created', { source: 'import' }))
    if (selectedId === topicId) {
      setEntries((prev) => [...created, ...prev])
    }
    return created.length
  }

  async function handleMigrationImport(entries, raw) {
    // Group by suggestedTopic; topics without a match go to Inbox
    const inbox = inboxTopic || (await getTopicByName(supabase, 'Inbox'))
    const byTopic = {}
    for (const e of entries) {
      const key = e.topic_id ? `__id__${e.topic_id}` : (e.suggestedTopic || '__inbox__')
      if (!byTopic[key]) byTopic[key] = []
      byTopic[key].push(e)
    }
    let total = 0
    const newTopics = []
    const allCreated = []
    for (const [key, items] of Object.entries(byTopic)) {
      let topicId
      if (key.startsWith('__id__')) {
        topicId = key.slice(6)
      } else if (key === '__inbox__') {
        topicId = inbox.id
      } else {
        let topic = topics.find((t) => t.name.toLowerCase() === key.toLowerCase())
        if (!topic) { topic = await createTopic(supabase, key); newTopics.push(topic) }
        topicId = topic.id
      }
      const mapped = items.map(({ url, title, note, tags }) => ({ url, title, note, tags }))
      const created = await bulkCreateEntries(supabase, topicId, mapped)
      allCreated.push(...created)
      total += created.length
    }
    if (newTopics.length > 0) {
      setTopics((prev) => [...prev, ...newTopics].sort((a, b) => a.name.localeCompare(b.name)))
    }
    enrichEntries(allCreated)
    allCreated.forEach(e => chunkEntryAsync(supabase, e))
    allCreated.forEach(() => track(supabase, 'entry_created', { source: 'import' }))
    setInboxCount((prev) => prev + allCreated.filter((e) => e.topic_id === inbox.id).length)
    return total
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
    allCreated.forEach(e => chunkEntryAsync(supabase, e))
    allCreated.forEach(() => track(supabase, 'entry_created', { source: 'import' }))
    return total
  }

  async function handleAssign(entryId, topicId) {
    await updateEntry(supabase, entryId, { topic_id: topicId })
    // The activation metric. One event per entry filed, so `sum(count)` gives
    // sorting volume while `exists` gives activation.
    track(supabase, 'inbox_sorted', { count: 1 })
    applyAssign(entryId)
    setInboxCount((prev) => Math.max(0, prev - 1))
  }

  async function handleSortDelete(entryId) {
    await softDeleteEntry(supabase, entryId)
    applySortDelete(entryId)
    setInboxCount((prev) => Math.max(0, prev - 1))
  }

  async function loadTrash() {
    const [entries, topics] = await Promise.all([listTrashedEntries(supabase), listDeletedTopics(supabase)])
    setTrashEntries(entries)
    setDeletedTopics(topics)
  }

  async function handleArchiveTopic(id) {
    const updated = await archiveTopic(supabase, id)
    applyArchiveTopic(id, updated)
    if (selectedId === id) { setSelectedId(inboxTopic?.id ?? null); setView('browse') }
  }

  async function handleUnarchiveTopic(id) {
    const updated = await unarchiveTopic(supabase, id)
    applyUnarchiveTopic(id, updated)
  }

  async function handleDeleteTopic(id) {
    await softDeleteTopic(supabase, id)
    applyDeleteTopic(id)
    if (selectedId === id) { setSelectedId(inboxTopic?.id ?? null); setView('browse') }
    addToast('Topic moved to trash', 'info')
  }

  async function handleRestoreTopic(id) {
    await restoreDeletedTopic(supabase, id)
    const allTopics = await listTopics(supabase)
    const restored = allTopics.find(t => t.id === id)
    if (restored) applyRestoreDeletedTopic(restored)
    setDeletedTopics(prev => prev.filter(t => t.id !== id))
    addToast('Topic restored to Inbox', 'success')
  }

  async function handleRestore(entryId) {
    const inboxId = inboxTopic?.id
    await restoreEntry(supabase, entryId, inboxId)
    applyRestore(entryId)
    if (inboxId) setInboxCount((prev) => prev + 1)
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

  async function handleRateRevisit(entry, grade) {
    await rateRevisit(supabase, entry, grade)
    applySeen(entry.id)
  }

  // Export downloads directly. It used to open a confirm modal showing a size
  // estimate, which cost a full extra `entries` scan purely to render a number the
  // user could not act on — the only real choice was Export or Cancel, and they had
  // already chosen by clicking Export. The attachment caveat that modal carried is
  // now a toast, so nothing is lost but the interstitial.
  async function handleExport() {
    if (exportBusy) return
    setExportBusy(true)
    try {
      const all = []
      for (const t of topics) {
        const rows = await listEntriesByTopic(supabase, t.id)
        all.push(...rows)
      }
      const files = buildMarkdownFiles(topics, all)
      const blob = await buildZip(files)
      downloadBlob(blob, `medialog-${new Date().toISOString().slice(0, 10)}.zip`)
      addToast(`Exported ${all.length} entries — attachments aren’t included`, 'success')
    } catch (e) {
      addToast(e.message || 'Export failed', 'error')
    } finally {
      setExportBusy(false)
    }
  }

  // Single topic → single .md, sized to drop straight into a Claude Project.
  async function handleExportTopic(topic) {
    try {
      const rows = await listEntriesByTopic(supabase, topic.id)
      const md = buildTopicMarkdown(topic, rows)
      downloadBlob(new Blob([md], { type: 'text/markdown' }), topicFilename(topic.name))
    } catch (e) {
      addToast(e.message, 'error')
    }
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
        {user?.email && <p className="account-indicator" title={user.id}>{user.email}</p>}
        {/* Nav and topics share one scroll region so the topic list can use
            the full sidebar height instead of a cramped nested scrollbox. */}
        <div className="sidebar-scroll">
          <NavSidebar
            view={view}
            navigateTo={navigateTo}
            sideEffects={{ loadInbox, loadRevisit, loadTrash }}
            isModuleVisible={isModuleVisible}
          />
          <hr className="topic-divider" />
          <TopicList
            topics={topics}
            activeTopics={activeTopics}
            archivedTopics={archivedTopics}
            selectedId={view === 'browse' ? selectedId : null}
            onSelect={(id) => { setSelectedId(id); setGlobalSearchResults(null); setView('browse') }}
            onAdd={handleAddTopic}
            onPinToggle={async (id, pinned) => {
              const updated = await togglePinTopic(supabase, id, pinned)
              setTopics((prev) => prev.map((t) => t.id === id ? { ...t, pinned: updated.pinned } : t))
            }}
            sidebarCollapsed={!sidebarOpen}
            onArchive={handleArchiveTopic}
            onUnarchive={handleUnarchiveTopic}
            onDeleteTopic={handleDeleteTopic}
          />
        </div>
        <button className="sidebar-toggle" onClick={toggleSidebar} title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
          <span className="sidebar-toggle-icon" style={{ transform: sidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}>‹</span>
          <span className="sidebar-toggle-label">{sidebarOpen ? 'collapse' : 'expand'}</span>
        </button>
      </aside>

      <main className="main">
        <div key={view === 'browse' ? `browse-${selectedId}` : view === 'explore' ? 'explore' : view} className="view-enter">
         <Suspense fallback={<div className="view-loading" />}>
          {view === 'home' && (
            <HomeView
              addToast={addToast}
              topics={topics}
              inboxCount={inboxCount}
              onSelectTopic={handleSelectTopic}
              onSortInbox={handleSortInbox}
              onTopicIconChange={handleTopicIconChange}
              supabase={supabase}

              onSaveFeedItem={(item) => handleSaveFromFeed(item, inboxTopic?.id ?? topics[0]?.id)}
              onGoToFeed={() => setView('feed')}
              onOpenEntry={handleSelectEntry}
              onGoToDigest={() => navigateTo('digest')}
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
              onOrderedIds={setOrderedEntryIds}
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
              onOpenRelated={handleOpenRelated}
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
              onEntryUpdate={(updated) => {
                setEntries((prev) => prev.map((e) => e.id === updated.id ? { ...e, ...updated } : e))
              }}
              onArchiveTopic={handleArchiveTopic}
              onUnarchiveTopic={handleUnarchiveTopic}
              onDeleteTopic={handleDeleteTopic}
              onExportTopic={handleExportTopic}
              focusedEntryId={focusedEntryId}
              editTargetId={editTargetId}
              onClearEditTarget={() => setEditTargetId(null)}
              onOrderedIds={setOrderedEntryIds}
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
          {view === 'tidy' && (
            <TidyView
              supabase={supabase}
              topics={topics}
              inboxTopicId={inboxTopic?.id ?? null}
              onOpenEntry={handleSelectEntry}
              addToast={addToast}
            />
          )}
          {view === 'interview' && isModuleVisible('interview') && (
            <InterviewView supabase={supabase} addToast={addToast} />
          )}
          {view === 'reading' && (
            <ReadingView
              supabase={supabase}
              addToast={addToast}
              onOpenTopic={(id) => { setDeepTopicId(id); setView('deeptopic') }}
            />
          )}
          {view === 'deeptopic' && deepTopicId && (
            <DeepTopicView
              supabase={supabase}
              topicId={deepTopicId}
              addToast={addToast}
              onBack={() => setView('reading')}
            />
          )}
          {view === 'progress' && (
            <ProgressView
              supabase={supabase}
              topics={topics}
              initialTopicId={selectedId}
            />
          )}
          {view === 'revisit' && (
            <Revisit entries={revisitEntries} onSeen={handleSeen} onRate={handleRateRevisit} recentActivity={recentActivity} />
          )}
          {view === 'settings' && (
            <SettingsView
              isModuleVisible={isModuleVisible}
              topics={topics}
              onRefreshData={refreshTopics}
              addToast={addToast}
              allTags={allTags}
              onUpdateTagColor={handleUpdateTagColor}
              archiveToast={archiveToast}
              onToggleArchiveToast={handleToggleArchiveToast}
              trashToast={trashToast}
              onToggleTrashToast={handleToggleTrashToast}
              themePalette={themePalette}
              themeStyle={themeStyle}
              onSetPalette={setPalette}
              onSetStyle={setStyle}
              assistantEnabled={showFounder ? assistantEnabled : undefined}
              onToggleAssistant={showFounder ? ((v) => {
                setAssistantEnabled(v)
                writePref('medialog_assistant_enabled', v)
                if (!v) setAssistantOpen(false)
              }) : undefined}
              onImportEntries={handleMigrationImport}
              onExportAll={handleExport}
              exportBusy={exportBusy}
            />
          )}
          {view === 'guide' && <GuideView />}
          {view === 'trash' && (
            <TrashView
              entries={trashEntries}
              deletedTopics={deletedTopics}
              topics={topics}
              onRestore={handleRestore}
              onRestoreTopic={handleRestoreTopic}
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
              allTags={allTags}
              onSaveItem={handleSaveFromFeed}
              addToast={addToast}
              onOpenDeepTopic={(id) => { setDeepTopicId(id); setView('deeptopic') }}
              onOpenPatternTopic={(id) => { setSelectedId(id); setView('browse') }}
            />
          )}
          {view === 'archive' && (
            <ArchiveView
              topics={topics}
              archivedTopics={archivedTopics}
              onSelectTopic={(id) => { setSelectedId(id); setView('browse') }}
              onUnarchiveTopic={handleUnarchiveTopic}
              onDeleteTopic={handleDeleteTopic}
            />
          )}
          {view === 'metrics' && isModuleVisible('metrics') && (
            <MetricsView supabase={supabase} addToast={addToast} />
          )}

          {view === 'career' && isModuleVisible('career') && (
            <CareerView
              supabase={supabase}
              addToast={addToast}
            />
          )}
          {view === 'highlights' && (
            <HighlightsView supabase={supabase} />
          )}
          {view === 'digest' && (
            <DigestView
              topics={topics}
              inboxTopicId={inboxTopic?.id}
              onSortInbox={handleSortInbox}
              onGoToView={navigateTo}
              onOpenEntry={handleSelectEntry}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          )}
         </Suspense>
        </div>
      </main>

      {previewUrl && (
        <Suspense fallback={null}>
          <FilePreviewModal url={previewUrl} onClose={closePreview} />
        </Suspense>
      )}
      <Toast toasts={toasts} onDismiss={dismissToast} />
      {historyFor && (
        <VersionHistoryModal
          versions={versions}
          onRestore={handleRestoreVersion}
          onClose={closeHistory}
        />
      )}
      <CatchOverlay
        open={catchOpen}
        onClose={() => setCatchOpen(false)}
        onAdd={handleCatchEntry}
        onCheckDuplicate={handleCheckDuplicate}
        supabase={supabase}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={paletteCommands}
        topics={topics}
        onSelectTopic={navigateToTopic}
      />
      {snoozeTarget && (
        <div className="palette-overlay" onClick={() => setSnoozeTarget(null)}>
          <div className="palette-box" style={{ padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: '0 0 12px', fontSize: 14 }}>
              Snooze <strong>{snoozeTarget.title || 'entry'}</strong> until:
            </p>
            <input
              type="date"
              min={new Date().toISOString().split('T')[0]}
              autoFocus
              style={{ fontSize: 14, padding: '4px 8px' }}
              onChange={(e) => {
                if (e.target.value) handleSnoozeFromPalette(snoozeTarget, e.target.value + 'T00:00:00Z')
              }}
            />
          </div>
        </div>
      )}

      {showFounder && assistantEnabled && !assistantOpen && (
        <button className="asst-tab" onClick={toggleAssistant} title="Ask your library (⌘/)">
          <Sparkles size={16} />
        </button>
      )}
      {showFounder && assistantEnabled && assistantOpen && (
        <AssistantPanel
          isModuleVisible={isModuleVisible}
          onOpenSettings={(tab) => { setView('settings'); if (tab) try { localStorage.setItem('medialog_settings_tab', tab) } catch {} }}
          supabase={supabase}
          onOpenEntry={(src) => handleOpenRelated(src.entryId)}
          onClose={() => setAssistantOpen(false)}
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

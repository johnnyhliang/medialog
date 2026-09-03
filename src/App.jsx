// src/App.jsx
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, Upload, Inbox, RotateCcw, BarChart2, Settings2, Trash2 as TrashIcon, Download, Menu, Home, FolderOpen, Rss, Briefcase, PackageOpen, Archive, ScrollText, Highlighter, BookOpen } from 'lucide-react'
import { supabase } from './lib/supabaseClient.js'
import { takeGitHubOAuthCode, isGitHubBackupCallback } from './lib/captureOAuthCode.js'
import { loadManagerData, setNextAction, parkTopic, unparkTopic } from './lib/db/managerState.js'
import { listTopics, createTopic, getTopicByName, listDeletedTopics, archiveTopic, unarchiveTopic, softDeleteTopic, restoreDeletedTopic, togglePinTopic, updateTopicDoc, listProjects } from './lib/db/topics.js'
import { listContributions, recordContribution, unrecordContribution } from './lib/db/contributions.js'
import { listDeadlines, closeProgramWindow } from './lib/db/deadlines.js'
import { todayKey } from './lib/contributions.js'
import { toggleStep, parseFrontmatter, parseSteps } from './lib/goals.js'
import { callAI } from './lib/ai.js'
import { buildDraftPrompt, cleanDraft, hasDraftContext } from './lib/nextActionDraft.js'
import {
  listEntriesByTopic, createEntry, updateEntry, searchEntries,
  bulkCreateEntries, listForRevisit, markSurfaced, listRecentActivity,
  softDeleteEntry, listTrashedEntries, restoreEntry, emptyTrash, snoozeEntry, rateRevisit, retireEntry, unretireEntry,
  listAgenda, setDueDate,
} from './lib/db/entries.js'
import { setEntryTags, listTags, updateTagColor } from './lib/db/tags.js'
import { seedStarterTopic } from './lib/starterTopic.js'
import { getCommands } from './lib/commands.js'
import { resolveBindings, eventToKey } from './lib/keybindings.js'
import CommandPalette from './components/CommandPalette.jsx'
import AssistantPanel from './components/AssistantPanel.jsx'
import { Sparkles } from 'lucide-react'
import { listVersions, createVersion } from './lib/db/versions.js'
import { fetchLinkPreview } from './lib/enrich.js'
import { preservationPatch } from './lib/preservation.js'
import { chunkEntryAsync } from './lib/chunkEntry.js'
import { track } from './lib/track.js'
import { runBackup, BackupRecordError } from './lib/db/githubBackup.js'
import { getUserOrNull } from './lib/requireUser.js'
import { isDev } from './lib/account.js'
import { DEFAULT_FEATURE_FLAGS, loadFeatureFlags } from './lib/featureFlags.js'
import { isModuleVisible as checkModuleVisible } from './lib/modules.js'
import { DEFAULT_TIER, loadEntitlement, loadModulePrefs } from './lib/entitlements.js'
import { buildMarkdownFiles, buildTopicMarkdown, topicFilename } from './lib/exportMarkdown.js'
import { buildZip, downloadBlob } from './lib/buildZip.js'
import AuthGate from './components/AuthGate.jsx'
import TopicList from './components/TopicList.jsx'
// import QuickAdd from './components/QuickAdd.jsx'
import ProgressView from './components/ProgressView.jsx'
import Revisit from './components/Revisit.jsx'
import AgendaView from './components/AgendaView.jsx'
import TrashView from './components/TrashView.jsx'
import HomeView from './components/HomeView.jsx'
import GuideView from './components/GuideView.jsx'
import NavSidebar from './components/NavSidebar.jsx'
// Heavy / infrequently-opened views are code-split so they don't bloat the
// initial bundle. They render inside the <Suspense> around the view area. ai generated slop in the lines below but i think it actually works really well
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
const MetricsView = lazy(() => import('./components/MetricsView.jsx'))
const ManagerView = lazy(() => import('./components/ManagerView.jsx'))
import TopicView from './components/TopicView.jsx'
import CatchOverlay from './components/CatchOverlay.jsx'
import VersionHistoryModal from './components/VersionHistoryModal.jsx'
import { useFilePreview } from './hooks/useFilePreview.js'
import useToast from './hooks/useToast.js'
import Toast from './components/Toast.jsx'
import { useTopics } from './hooks/useTopics.js'
import { useEntries } from './hooks/useEntries.js'
import { usePendingArchive } from './hooks/usePendingArchive.js'
import { useTrash } from './hooks/useTrash.js'
import { useRevisit } from './hooks/useRevisit.js'
import { useTags } from './hooks/useTags.js'
import { useVersions } from './hooks/useVersions.js'
import { useArchiveToast } from './hooks/useArchiveToast.js'
import { readBoolPref, readPref, writePref, clearPref } from './lib/localPref.js'
import { useTheme } from './hooks/useTheme.js'
import { useTimezone } from './hooks/useTimezone.js'
import { startOfLocalDay } from './lib/timezone.js'
const FilePreviewModal = lazy(() => import('./components/FilePreviewModal.jsx'))

function Workspace() {
  const { topics, setTopics, activeTopics, archivedTopics, selectedId, setSelectedId, inboxCount, setInboxCount, selectedTopic, inboxTopic, applyAddTopic, applyArchiveTopic, applyUnarchiveTopic, applyDeleteTopic, applyRestoreDeletedTopic } = useTopics()
  const [deletedTopics, setDeletedTopics] = useState([])
  const [agendaEntries, setAgendaEntries] = useState([])
  // The Manager loads on navigation (sideEffects.loadManager), never at mount —
  // it must not add to the 22 round trips the app already makes on boot.
  const [managerData, setManagerData] = useState({ states: [], entries: [], contributions: [], projects: [], deadlines: [] })
  const [managerLoading, setManagerLoading] = useState(false)
  const { entries, setEntries, globalSearchResults, setGlobalSearchResults, applyUpdateEntry, applyDeleteEntry, applyMoveEntry } = useEntries()
  const { pendingArchiveIds, addPending, removePending } = usePendingArchive(selectedId)
  const { trashEntries, setTrashEntries, applyRestore, applyClear } = useTrash()
  const { revisitEntries, setRevisitEntries, recentActivity, setRecentActivity, applySeen } = useRevisit()
  const { allTags, setAllTags, tagColors, applyUpdateTagColor } = useTags()
  const { historyFor, versions, openHistory, closeHistory } = useVersions()
  const [exportBusy, setExportBusy] = useState(false)
  const { archiveToast, setArchiveToast } = useArchiveToast()
  const { palette: themePalette, style: themeStyle, setPalette, setStyle } = useTheme()
  // Resolved once here and passed down, so the clock and the agenda can never
  // disagree about what day it is. Mounting the hook twice would give two
  // independent copies of the state and a settings change would not reach the
  // clock until a reload.
  const { preference: tzPreference, timezone, setTimezone } = useTimezone()
  const [trashToast, setTrashToast] = useState(() => readBoolPref('medialog_trash_toast', true))
  const { previewUrl, openPreview, closePreview } = useFilePreview()
  const { toasts, addToast, dismissToast } = useToast()

  // Read from the path, because /settings is a real entry point: the GitHub
  // OAuth callback lands there, and handleGitHubCallback finishes by reloading —
  // which discarded the setView('settings') it had just done and dropped you on
  // Home with no sign the connection had worked.
  const [view, setView] = useState(() =>
    window.location.pathname.includes('/settings') ? 'settings' : 'home'
  )
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
  }), [view, focusedEntry, topics, inboxTopic, showFounder, assistantEnabled, setSelectedId, focusNextEntry, focusPrevEntry, editFocusedEntry, cycleFocusedStatus])

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
    // v2: sidebar defaults open; only respect a stored 'false' if user explicitly set it post-fix
    const stored = readPref('medialog_sidebar_open', null)
    const migrated = readPref('medialog_sidebar_migrated', null)
    if (migrated === null) {
      clearPref('medialog_sidebar_open')
      writePref('medialog_sidebar_migrated', '1')
      return true
    }
    return stored !== 'false'
  })

  function toggleSidebar() {
    const next = !sidebarOpen
    // Persist outside the updater: React may run an updater more than once
    // (StrictMode does so deliberately), and a storage write is not idempotent
    // in the way a pure updater has to be.
    writePref('medialog_sidebar_open', next)
    setSidebarOpen(next)
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
    // Read from the stash rather than the URL: by now the query may have been
    // stripped by supabase-js or lost to an AuthGate -> / -> /app redirect. The
    // URL is still checked as a fallback for the case where nothing interfered.
    const stashed = takeGitHubOAuthCode()
    const urlCode = new URLSearchParams(window.location.search).get('code')
    const code = stashed || (isGitHubBackupCallback ? urlCode : null)
    if (code) {
      handleGitHubCallback(code)
    }
    return () => {
      cancelled = true
      clearInterval(featureFlagTimer)
    }
  }, [])

  const autoBackupTimer = useRef(null)
  const autoBackupDead = useRef(false)
  const pendingBackup = useRef(false)
  const pendingEntryScroll = useRef(null)
  // The entry a citation/related-link jumped to, held so TopicView can render it
  // even when browse filtering would hide it (archived). Survives the scroll on
  // purpose — clearing it would make the entry vanish the moment you arrived.
  const [jumpEntryId, setJumpEntryId] = useState(null)
  useEffect(() => {
    pendingBackup.current = true
    if (autoBackupTimer.current) return
    autoBackupTimer.current = setTimeout(async () => {
      autoBackupTimer.current = null
      if (autoBackupDead.current) return
      if (!pendingBackup.current) return
      pendingBackup.current = false
      try {
        const { data: config } = await supabase
          .from('user_configs')
          .select('auto_backup, github_token')
          .maybeSingle()
        if (config?.auto_backup && config?.github_token) {
          const res = await runBackup(supabase, { message: 'MediaLog auto-backup' })
          if (!res.unchanged && !autoBackupDead.current) addToast('Auto-backup complete', 'success')
        }
      } catch (e) {
        // Never interrupt the user for a background backup, but record why it
        // failed — this path silently did nothing at all for months.
        //
        // Two things this handler must not do. It must not throw: it used to
        // destructure `data.user` inline, so if auth was the thing that broke,
        // the error handler died of a TypeError while handling the error and
        // the real cause was never recorded. `getUserOrNull` returns null when
        // signed out and still surfaces a genuine auth error, and the whole
        // body is wrapped so nothing here can escape as an unhandled rejection
        // from a background timer.
        //
        // And it must not lie about the data. `BackupRecordError` means the
        // commit REACHED GitHub and only the bookkeeping row failed — writing
        // that to `last_error` would tell the user their backup failed when
        // their data is in fact safe.
        try {
          if (e instanceof BackupRecordError) {
            if (!autoBackupDead.current) addToast(e.message, 'info')
            return
          }
          const user = await getUserOrNull(supabase)
          if (user) {
            await supabase.from('user_configs')
              .update({ last_error: String(e.message ?? e) })
              .eq('user_id', user.id)
          }
        } catch {
          // Nothing left to fall back on — the backup failed and so did
          // recording why. Swallowing here is deliberate: an unhandled
          // rejection from a detached timer is not something the user can act
          // on, and it must not take the app down.
        }
      }
    }, 60000)
  }, [entries, topics])

  // The scheduling effect above deliberately returns no cleanup: it reruns on
  // every entries/topics change, and cancelling there would cancel and
  // reschedule the 60 s debounce forever, so a backup would never fire. But an
  // uncancelled timer also outlives the component — it woke on a dead tree,
  // queried user_configs with a possibly signed-out client, and called addToast
  // into nothing. So the cancel lives in its own mount-scoped effect, which
  // runs exactly once, at unmount.
  useEffect(() => () => {
    autoBackupDead.current = true
    if (autoBackupTimer.current) {
      clearTimeout(autoBackupTimer.current)
      autoBackupTimer.current = null
    }
  }, [])

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
    // The redirect chain can land us on /app rather than /settings, so put the
    // user where the result is visible rather than assuming the path did.
    setView('settings')
    window.history.replaceState({}, document.title, window.location.pathname)
    const { error } = await supabase.functions.invoke('github-token', { body: { code } })
    if (error) alert(`GitHub Connection Failed: ${error.message}`)
    else window.location.reload()
  }

  async function handleToggleArchiveToast(val) {
    setArchiveToast(val)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('user_configs')
      .update({ archive_toast: val })
      .eq('user_id', user.id)
    // The database is the record and the local value is only a cache, so an
    // unchecked failure here reads as saved until the next load quietly reverts
    // it — the same silent-revert this session fixed in the career tabs.
    if (error) {
      setArchiveToast(!val)
      addToast(`Couldn’t save: ${error.message}`, 'error')
    }
  }

  async function handleSearchAll(q) {
    if (!q.trim()) { setGlobalSearchResults(null); return }
    track(supabase, 'search_run', { mode: 'keyword' })
    try {
      const results = await searchEntries(supabase, q.trim())
      setGlobalSearchResults(results)
    } catch (e) {
      // `searchEntries` runs a text query and a tag query; it now throws if
      // either half fails rather than quietly returning the half that worked.
      // Leaving the previous results on screen under a new query would be the
      // same lie, so clear them and say so.
      setGlobalSearchResults([])
      addToast(e.message || 'Search failed', 'error')
    }
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

  async function handleAddEntry({ url, note, title: prefetchedTitle, tags = [], dueAt = null, onTitleStatus, onEmbedStatus }) {
    let e
    try {
      e = await createEntry(supabase, { topicId: selectedId, url, note })
    } catch (err) {
      return { ok: false, error: err }
    }
    track(supabase, 'entry_created', { source: 'paste' })
    // Written after the insert rather than through createEntry: that function
    // owns the title-mirroring / `title_edited` invariant and nothing about a
    // deadline should have to be threaded through it. A failed date must not
    // lose the entry the user just typed, so it only costs a toast.
    if (dueAt) {
      try { await setDueDate(supabase, e.id, dueAt); e = { ...e, due_at: dueAt } }
      catch { addToast('Entry saved, but the due date did not stick', 'error') }
    }
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
            const updated = await updateEntry(supabase, e.id, patch, { autoTitle: true })
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
  async function handleCatchEntry({ url, note, title: prefetchedTitle, dueAt = null, onTitleStatus, onEmbedStatus }) {
    if (!inboxTopic) return { ok: false, error: new Error('no inbox') }
    let e
    try {
      e = await createEntry(supabase, { topicId: inboxTopic.id, url, note })
    } catch (err) {
      return { ok: false, error: err }
    }
    track(supabase, 'entry_created', { source: 'capture' })
    if (dueAt) {
      try { await setDueDate(supabase, e.id, dueAt); e = { ...e, due_at: dueAt } }
      catch { addToast('Entry saved, but the due date did not stick', 'error') }
    }
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
            const updated = await updateEntry(supabase, e.id, patch, { autoTitle: true })
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
      return false
    }
    applyDeleteEntry(id)
    if (trashToast && entry) {
      addToast('Moved to trash', 'info', {
        duration: 5000,
        actions: [{ label: 'Undo', onClick: () => handleUndoTrash(entry) }],
      })
    }
    // Reports success so callers that chain further state changes (the revisit
    // card, which also drops the entry from the queue) can stop on failure
    // instead of advancing past an entry that was never deleted.
    return true
  }

  async function handleStatusChange(entryId, status) {
    const entry = entries.find(e => e.id === entryId)
    const prevStatus = entry?.status || null
    let updated
    try {
      updated = await updateEntry(supabase, entryId, { status })
    } catch {
      addToast('Failed to update status', 'error')
      return false
    }
    applyUpdateEntry(entryId, updated)

    // The grid's second and last write event (manager-scope.md §6): finishing
    // something. Fire-and-forget in both directions — a square is a record of
    // the status change, never a precondition for it.
    if (status === 'done' && prevStatus !== 'done') {
      recordContribution(supabase, {
        topicId: entry?.topic_id ?? null,
        kind: 'done',
        note: entry?.title || null,
        tz: timezone,
      }).catch(() => {})
    } else if (prevStatus === 'done' && status !== 'done') {
      unrecordContribution(supabase, { kind: 'done', note: entry?.title || null, tz: timezone }).catch(() => {})
    }

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
    return true
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

  // `titleEdited` is false when the user only corrected the URL — the title
  // rides along in the patch unchanged and must not be marked as user-owned.
  async function handleTitleChange(entryId, title, url, titleEdited = true) {
    const patch = url !== undefined ? { title, url } : { title }
    if (titleEdited) patch.title_edited = true
    try {
      const updated = await updateEntry(supabase, entryId, patch)
      applyUpdateEntry(entryId, updated)
    } catch {
      addToast('Failed to save title', 'error')
    }
  }

  // Until this existed `due_at` was writable only by the MCP server, so the
  // Agenda was a permanently empty view for anyone not running Claude. `null`
  // clears the date — there is no separate delete; an entry stops being a task
  // by losing its deadline.
  //
  // The agenda list is patched here too: it is fetched separately from
  // `entries`, so updating only the card would leave a just-dated entry missing
  // from Agenda (or a just-cleared one still sitting in a bucket) until reload.
  async function handleDueDateChange(entryId, isoDate) {
    try {
      await setDueDate(supabase, entryId, isoDate)
    } catch {
      addToast('Failed to save due date', 'error')
      return
    }
    setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, due_at: isoDate } : e))
    setAgendaEntries((prev) => {
      const existing = prev.find((e) => e.id === entryId)
      if (!isoDate) return prev.filter((e) => e.id !== entryId)
      if (existing) return prev.map((e) => e.id === entryId ? { ...e, due_at: isoDate } : e)
      const source = entries.find((e) => e.id === entryId)
      return source ? [...prev, { ...source, due_at: isoDate }] : prev
    })
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
    try {
      const updated = await updateEntry(supabase, historyFor, { note })
      await createVersion(supabase, historyFor, note)
      applyUpdateEntry(historyFor, updated)
    } catch {
      addToast('Failed to restore version', 'error')
    }
    closeHistory()
  }

  function handleSortInbox() {
    setView('sort')
  }

  function handleSelectTopic(topic) {
    // Browsing a topic normally again — drop the archived exemption.
    setJumpEntryId(null)
    setSelectedId(topic.id)
    setGlobalSearchResults(null)
    setView('browse')
  }

  function handleSelectEntry(entry) {
    pendingEntryScroll.current = entry.id
    setJumpEntryId(entry.id)
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
      const updated = await updateEntry(supabase, e.id, patch, { autoTitle: true })
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

  async function handleMigrationImport(entries, _raw) {
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

  // Triage moved into TidyView, which writes to the DB itself. All App still
  // owes it is the two side effects the writes can't do: the activation metric
  // and keeping the nav inbox badge in step.
  function handleTriaged(entryId, { filed = false } = {}) {
    // The activation metric. One event per entry FILED (not merely trashed), so
    // `sum(count)` gives sorting volume while `exists` gives activation.
    if (filed) track(supabase, 'inbox_sorted', { count: 1 })
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

  // Both of these write first and only then touch local state. The ordering is
  // the point: the old code removed the topic from `topics` and toasted
  // success regardless of whether the database agreed, so a failed write left
  // the UI insisting the topic was in the trash while the row was untouched —
  // a wrong answer presented with confidence, and one that survives until the
  // next reload puts the topic back with no explanation.
  async function handleDeleteTopic(id) {
    try {
      await softDeleteTopic(supabase, id)
    } catch (e) {
      addToast(e.message || 'Could not move that topic to trash', 'error')
      return
    }
    applyDeleteTopic(id)
    if (selectedId === id) { setSelectedId(inboxTopic?.id ?? null); setView('browse') }
    addToast('Topic moved to trash', 'info')
  }

  async function handleRestoreTopic(id) {
    let restored
    try {
      await restoreDeletedTopic(supabase, id)
      const allTopics = await listTopics(supabase)
      restored = allTopics.find(t => t.id === id)
    } catch (e) {
      addToast(e.message || 'Could not restore that topic', 'error')
      return
    }
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

  async function loadAgenda() {
    setAgendaEntries(await listAgenda(supabase))
  }

  async function loadManager() {
    setManagerLoading(true)
    try {
      // Both in one hop, same as loadManagerData's own Promise.all — the grid
      // must not turn one navigation into two sequential round trips.
      // One wave. The Manager is now the outline AND the agenda, so it needs
      // the projects and the dated rows too — sequentially that would be five
      // round trips on a single navigation.
      const [data, contributions, projects, deadlines] = await Promise.all([
        loadManagerData(supabase),
        listContributions(supabase, { tz: timezone }),
        listProjects(supabase),
        listDeadlines(supabase, { tz: timezone }).catch(() => []),
      ])
      setManagerData({ ...data, contributions, projects, deadlines })
    } catch (e) {
      addToast(e.message || 'Could not load the Manager', 'error')
    } finally {
      setManagerLoading(false)
    }
  }

  // The three Manager mutations. Each writes through the db layer and patches
  // `states` locally rather than refetching — the derivation is pure, so the
  // cards recompute from the new row for free.
  function applyTopicState(row) {
    setManagerData((prev) => ({
      ...prev,
      states: [...prev.states.filter((s) => s.topic_id !== row.topic_id), row],
    }))
  }

  async function handleSetNextAction(topicId, text) {
    try {
      applyTopicState(await setNextAction(supabase, topicId, text))
    } catch (e) {
      addToast(e.message || 'Could not save', 'error')
    }
  }

  async function handleParkTopic(topicId, note) {
    try {
      applyTopicState(await parkTopic(supabase, topicId, note))
      addToast('Parked — it stays visible on the shelf', 'success')
    } catch (e) {
      addToast(e.message || 'Could not park', 'error')
    }
  }

  async function handleUnparkTopic(topicId) {
    try {
      applyTopicState(await unparkTopic(supabase, topicId))
    } catch (e) {
      addToast(e.message || 'Could not unpark', 'error')
    }
  }

  /**
   * Retire an "open now" program window from the agenda row itself.
   *
   * Optimistic: the row disappears immediately and is restored if the write
   * fails. Dismissing something is a gesture that must feel instant, or you
   * press it twice.
   */
  async function handleCloseWindow(rowKey) {
    const id = String(rowKey).replace(/^program:/, '')
    const before = managerData.deadlines
    setManagerData((prev) => ({
      ...prev,
      deadlines: prev.deadlines.filter((d) => d.key !== rowKey),
    }))
    try {
      await closeProgramWindow(supabase, id)
    } catch (e) {
      setManagerData((prev) => ({ ...prev, deadlines: before }))
      addToast(e.message || 'Could not close that window', 'error')
    }
  }

  /**
   * Draft a `next_action` for one topic. Returns the line; the Manager puts it
   * in the input as an UNSAVED draft (manager-scope.md §9 — suggest, never
   * decide). Nothing here writes to the database.
   *
   * Runs only on an explicit click, never on load: a suggestion nobody asked
   * for is a suggestion nobody reads, and it would spend a request per card
   * every time the Manager opened.
   */
  async function handleSuggestNextAction(topicId) {
    const topic = topics.find((t) => t.id === topicId)
    if (!topic) return null

    let topicEntries = []
    try {
      topicEntries = await listEntriesByTopic(supabase, topicId)
    } catch { /* the plan alone is enough context to try with */ }

    const { body } = parseFrontmatter(topic.master_doc || '')
    const { steps } = parseSteps(body)
    const context = { topic, entries: topicEntries, steps }

    // Checked before spending a request: an empty topic yields a confident,
    // generic line, which is exactly what teaches you to stop trusting this.
    if (!hasDraftContext(context)) {
      addToast('Not enough here yet to suggest from', 'info')
      return null
    }

    const line = cleanDraft(await callAI(supabase, buildDraftPrompt(context)))
    if (!line) addToast('No clear next action — write one yourself', 'info')
    return line
  }

  /**
   * Tick or untick one step of a topic's plan — the only place a master_doc
   * checkbox can be flipped (docs/manager-scope.md §2, §6).
   *
   * The doc write is what matters and is awaited. The contribution write is
   * fire-and-forget: the grid is a record of work, not the work, so a failed
   * square must never make a checkbox appear not to have saved.
   */
  async function handleToggleStep(topicId, lineIndex, { text, checked }) {
    const topic = topics.find((t) => t.id === topicId)
    if (!topic) return
    const next = toggleStep(topic.master_doc || '', lineIndex)
    if (next === topic.master_doc) return
    try {
      await updateTopicDoc(supabase, topicId, next)
      handleDocChange(topicId, next)
    } catch (e) {
      addToast(e.message || 'Could not save the plan', 'error')
      return
    }

    try {
      if (checked) {
        await recordContribution(supabase, { topicId, kind: 'step', note: text, tz: timezone })
        setManagerData((prev) => ({
          ...prev,
          contributions: [{ day: todayKey(new Date(), timezone), topic_id: topicId, kind: 'step', note: text }, ...prev.contributions],
        }))
      } else {
        await unrecordContribution(supabase, { kind: 'step', note: text, tz: timezone })
        const today = todayKey(new Date(), timezone)
        setManagerData((prev) => {
          // Drop ONE matching square, not every one: the same step text can
          // legitimately appear twice in a day if it was ticked, unticked and
          // ticked again, and clearing them all would under-count the day.
          const i = prev.contributions.findIndex(
            (c) => c.day === today && c.kind === 'step' && c.note === text,
          )
          if (i === -1) return prev
          return { ...prev, contributions: prev.contributions.toSpliced(i, 1) }
        })
      }
    } catch {
      // Deliberately silent — see above.
    }
  }

  // Done reminders leave the agenda on their own — `listAgenda` filters
  // status='done'. Dropping the row locally keeps the list in step without a
  // refetch, the same optimistic pattern the other views use.
  async function handleCompleteReminder(entry) {
    await updateEntry(supabase, entry.id, { status: 'done' })
    setAgendaEntries((prev) => prev.filter((e) => e.id !== entry.id))
    applyUpdateEntry(entry.id, { ...entry, status: 'done' })
  }

  // Snooze sets `surface_after`, which hides the entry until then WITHOUT
  // touching its deadline — SCHEDULED moves, DEADLINE does not. That is why
  // this reuses the existing snooze plumbing rather than editing `due_at`.
  async function handleSnoozeReminder(entry) {
    const tomorrow = new Date(Date.now() + 86400000).toISOString()
    await snoozeEntry(supabase, entry.id, tomorrow)
    setAgendaEntries((prev) => prev.filter((e) => e.id !== entry.id))
    applyUpdateEntry(entry.id, { ...entry, surface_after: tomorrow })
  }

  // Wrapped because Revisit awaits this before advancing: an unguarded reject
  // left the button looking dead, with no toast and no movement.
  async function handleSeen(entryId) {
    try {
      await markSurfaced(supabase, entryId)
    } catch {
      addToast('Could not skip this entry', 'error')
      return false
    }
    applySeen(entryId)
    return true
  }

  async function handleRateRevisit(entry, grade) {
    try {
      await rateRevisit(supabase, entry, grade)
    } catch {
      addToast('Could not save that rating', 'error')
      return false
    }
    applySeen(entry.id)
    return true
  }

  async function handleRetireRevisit(entry) {
    try {
      await retireEntry(supabase, entry.id)
    } catch {
      addToast('Could not update this entry', 'error')
      return false
    }
    applySeen(entry.id)
    addToast('Kept, but no longer resurfacing', 'success')
    return true
  }

  // Archive and trash are the two decisions you may want to make *about the
  // entry* while reviewing it. Both reuse the handlers the entry cards use, so
  // reviewing and browsing can never drift into different behaviour.
  // Both underlying handlers swallow their own errors and report a boolean, so
  // a failed write must not go on to drop the entry from the queue — that would
  // hide an entry that is still active, and the card would advance past a
  // decision that never landed.
  async function handleArchiveRevisit(entry) {
    const ok = await handleStatusChange(entry.id, 'done')
    if (!ok) return false
    applySeen(entry.id)
    return true
  }

  async function handleDeleteRevisit(entry) {
    const ok = await handleDelete(entry.id)
    if (!ok) return false
    applySeen(entry.id)
    return true
  }

  // Toggle, so the same control undoes the decision it made. Retiring from a
  // card does not remove the entry from the list — only from the resurfacing
  // queue and the digest nags.
  async function handleToggleRetire(entryId, retire) {
    try {
      if (retire) await retireEntry(supabase, entryId)
      else await unretireEntry(supabase, entryId)
    } catch {
      addToast(retire ? 'Could not update this entry' : 'Could not resume resurfacing', 'error')
      return
    }
    // applyUpdateEntry is (id, updated) and `updated` REPLACES the row, so it
    // needs the whole entry merged in. Passing a patch object put an object
    // where the id belonged, so `e.id === id` never matched and the toggle
    // silently did nothing on screen — the write landed but the card never
    // re-rendered, which also made un-retire unreachable without a reload.
    // Both retire and unretire clear surface_after, so mirror that too or the
    // local copy drifts from the row.
    const entry = entries.find((e) => e.id === entryId)
    if (entry) {
      applyUpdateEntry(entryId, {
        ...entry,
        retired_at: retire ? new Date().toISOString() : null,
        surface_after: null,
      })
    }
    addToast(retire ? 'Done with it — no longer resurfacing' : 'Resurfacing resumed', 'success')
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
            sideEffects={{ loadRevisit, loadTrash, loadAgenda, loadManager }}
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
              timezone={timezone}
              onGoToDigest={() => navigateTo('digest')}
              onGoToCareer={() => navigateTo('career')}
              showDeadlines={isModuleVisible('career')}
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
              // Gated on the existing `interview` module rather than a new one:
              // this is interview practice, and the registry has 24 modules
              // already. No new entry for a three-row card.
              showPractice={isModuleVisible('interview')}
              timezone={timezone}
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
              onDueDateChange={handleDueDateChange}
              onMove={handleMove}
              tagColors={tagColors}
              allTags={allTags}
              pendingArchiveIds={pendingArchiveIds}
              jumpEntryId={jumpEntryId}
              supabase={supabase}
              onCheckDuplicate={handleCheckDuplicate}
              onRetire={handleToggleRetire}
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
          {/* One triage surface. 'sort' is the nav/palette route the rest of the
              app links to; 'tidy' is kept as an alias so the existing `g y`
              bind and any saved state keep landing somewhere real. */}
          {(view === 'sort' || view === 'tidy') && (
            <TidyView
              supabase={supabase}
              topics={topics}
              inboxTopicId={inboxTopic?.id ?? null}
              onOpenEntry={handleSelectEntry}
              onTriaged={handleTriaged}
              addToast={addToast}
            />
          )}
          {view === 'interview' && isModuleVisible('interview') && (
            <InterviewView supabase={supabase} addToast={addToast} />
          )}
          {view === 'progress' && (
            <ProgressView
              supabase={supabase}
              topics={topics}
              initialTopicId={selectedId}
            />
          )}
          {view === 'revisit' && (
            <Revisit
              entries={revisitEntries}
              onSeen={handleSeen}
              onRate={handleRateRevisit}
              onRetire={handleRetireRevisit}
              onArchive={handleArchiveRevisit}
              onDelete={handleDeleteRevisit}
              recentActivity={recentActivity}
            />
          )}
          {view === 'manager' && isModuleVisible('manager') && (
            <ManagerView
              // Projects are filtered OUT of `topics` (they left the sidebar),
              // so the Manager has to be handed both halves or its own cards
              // would disappear.
              topics={[...managerData.projects, ...topics]}
              entries={managerData.entries}
              states={managerData.states}
              contributions={managerData.contributions}
              projects={managerData.projects}
              deadlines={managerData.deadlines}
              onCloseWindow={handleCloseWindow}
              timezone={timezone}
              loading={managerLoading}
              onResume={navigateToTopic}
              onSetNextAction={handleSetNextAction}
              onPark={handleParkTopic}
              onUnpark={handleUnparkTopic}
              onToggleStep={handleToggleStep}
              onSuggest={isModuleVisible('assistant') ? handleSuggestNextAction : null}
            />
          )}
          {view === 'agenda' && (
            <AgendaView
              entries={agendaEntries}
              timezone={timezone}
              onComplete={handleCompleteReminder}
              onSnooze={handleSnoozeReminder}
              onOpen={handleSelectEntry}
            />
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
              tzPreference={tzPreference}
              timezone={timezone}
              onSetTimezone={setTimezone}
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
              onOpenTopic={(id) => { setSelectedId(id); setView('browse') }}
              onOpenPatternTopic={(id) => { setSelectedId(id); setView('browse') }}
              onOpenSettings={(tab) => { setView('settings'); if (tab) writePref('medialog_settings_tab', tab) }}
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
            <p style={{ margin: '0 0 12px', fontSize: 'var(--text-base)' }}>
              Snooze <strong>{snoozeTarget.title || 'entry'}</strong> until:
            </p>
            <input
              type="date"
              min={new Date().toISOString().split('T')[0]}
              autoFocus
              style={{ fontSize: 'var(--text-base)', padding: '4px 8px' }}
              onChange={(e) => {
                // Not `+ 'T00:00:00Z'`: that is UTC midnight, which is still the
                // previous day locally west of Greenwich, so the entry
                // resurfaced hours before the day it was snoozed to.
                const until = startOfLocalDay(e.target.value, timezone)
                if (until) handleSnoozeFromPalette(snoozeTarget, until)
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
          onOpenSettings={(tab) => { setView('settings'); if (tab) writePref('medialog_settings_tab', tab) }}
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

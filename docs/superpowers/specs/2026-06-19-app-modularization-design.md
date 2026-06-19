# App.jsx Modularization Design

**Date:** 2026-06-19  
**Scope:** Split `src/App.jsx` (627 lines) into domain hooks; extract two inline modals into components. `src/styles.css` is out of scope.

---

## Problem

`src/App.jsx` (`Workspace` function) is a monolith: ~15 state variables, 5 effects, ~25 async handlers, and JSX all in one file. It is hard to navigate and every new feature adds more mass to an already large file.

---

## Constraints

- `App.jsx` remains the **only file that calls Supabase**. Hooks manage state only.
- No changes to existing component APIs, routing logic, or Supabase queries.
- `src/styles.css` is unchanged.
- All existing tests must continue to pass.

---

## Hook API Pattern

Each hook owns a state slice and exposes **apply-functions** — synchronous state mutators that App.jsx calls after a Supabase call resolves.

```js
// App.jsx pattern
async function handleDelete(id) {
  await softDeleteEntry(supabase, id)   // Supabase call stays here
  applyDeleteEntry(id)                  // hook mutates state
}
```

---

## Hooks (all new, in `src/hooks/`)

### `useTopics()`
```
state:   topics, selectedId, inboxCount
derived: selectedTopic, inboxTopic  (memoized)
apply:   setTopics(topics)
         setSelectedId(id)
         setInboxCount(n)
         applyAddTopic(topic)         → appends + sorts topics, sets selectedId
         applySelectTopic(id)         → sets selectedId
```

### `useEntries(selectedId)`
```
state:   entries, globalSearchResults
effect:  clears entries when selectedId changes (no Supabase call — App.jsx loads)
apply:   setEntries(entries)
         applyUpdateEntry(id, updated)  → replaces entry, preserves .tags
         applyDeleteEntry(id)           → filters entry out
         applyMoveEntry(id)             → filters entry out
         setGlobalSearchResults(results | null)
```

### `usePendingArchive(selectedId)`
```
state:   pendingArchiveIds  (Set)
effect:  clears set when selectedId changes
apply:   addPending(id)
         removePending(id)
```

### `useInbox()`
```
state:   inboxEntries
apply:   setInboxEntries(entries)
         applyAssign(id)       → filters entry out, caller decrements inboxCount
         applySortDelete(id)   → filters entry out, caller decrements inboxCount
```

### `useTrash()`
```
state:   trashEntries
apply:   setTrashEntries(entries)
         applyRestore(id)   → filters entry out
         applyClear()       → sets to []
```

### `useRevisit()`
```
state:   revisitEntries, recentActivity
apply:   setRevisitEntries(entries)
         setRecentActivity(activity)
         applySeen(id)   → filters entry out
```

### `useTags()`
```
state:   allTags
derived: tagColors  (memoized: { [name]: color })
apply:   setAllTags(tags)
         applyUpdateTagColor(name, color)   → updates tag in-place
```

### `useVersions()`
```
state:   historyFor (entryId | null), versions
apply:   openHistory(entryId, versions)   → sets both
         closeHistory()                   → sets historyFor to null
         applyRestoreVersion(id, updated) → calls applyUpdateEntry via useEntries;
                                            closes modal
```

Note: `useVersions` does not call `applyUpdateEntry` directly — App.jsx does, since it already holds the result from `updateEntry`.

### `useExport()`
```
state:   exportModal  (null | { estimatedKB, entryCount, loading })
apply:   openExportLoading()          → { loading: true }
         setExportResult(kb, count)   → { estimatedKB, entryCount, loading: false }
         closeExportModal()           → null
```

### `useArchiveToast()`
```
state:   archiveToast  (bool, default true)
effect:  loads value from user_configs on mount — NO, App.jsx loads this and calls setArchiveToast
apply:   setArchiveToast(val)
```

---

## New Components

### `src/components/ExportModal.jsx`
**Props:** `exportModal`, `topics`, `onConfirm`, `onClose`  
Stateless. Renders the loading state / size estimate / entry count and Export + Cancel buttons. App.jsx passes `handleExportConfirm` as `onConfirm`.

### `src/components/VersionHistoryModal.jsx`
**Props:** `versions`, `onRestore`, `onClose`  
Stateless. Wraps `<VersionHistory>` inside `<Modal>`. App.jsx passes `handleRestoreVersion` as `onRestore`.

---

## App.jsx After Extraction (~250 lines)

```
Workspace()
  // 9 domain hooks + useToast + useFilePreview
  // sidebar state (3 lines, stays inline — too small to extract)
  // derived: candidateIndex (useMemo, stays inline)
  // handleDocChange (1-liner, stays inline)
  // GitHub callback handler (inline — one-off init logic)
  // auto-backup effect (inline — useRef + useEffect, self-contained)
  // archive-toast load effect (inline — single fetch on mount)
  // entries-load effect (inline — fires when selectedId changes)
  // pendingArchive-clear effect (delegated to usePendingArchive)
  // ~25 async handlers (all Supabase calls + apply-function calls)
  // JSX: sidebar, view router, <ExportModal>, <VersionHistoryModal>,
  //       <Toast>, <FilePreviewModal>
```

---

## File Structure

```
src/
  App.jsx                       (~250 lines, orchestrator only)
  styles.css                    (unchanged)
  hooks/
    useFilePreview.js           (existing)
    useToast.js                 (existing)
    useSession.js               (existing)
    useTopics.js                (new)
    useEntries.js               (new)
    usePendingArchive.js        (new)
    useInbox.js                 (new)
    useTrash.js                 (new)
    useRevisit.js               (new)
    useTags.js                  (new)
    useVersions.js              (new)
    useExport.js                (new)
    useArchiveToast.js          (new)
  components/
    ExportModal.jsx             (new)
    VersionHistoryModal.jsx     (new)
    ... (all existing, unchanged)
```

---

## Success Criteria

- App.jsx is ≤ 260 lines
- All 188 existing tests pass
- No Supabase calls appear in any hook file
- Each hook file is ≤ 60 lines
- `ExportModal` and `VersionHistoryModal` are stateless components

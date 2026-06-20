# App.jsx Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `src/App.jsx` (627 lines) into 9 domain hooks + 2 new modal components, reducing App.jsx to ~250 lines of pure orchestration.

**Architecture:** Each hook owns a state slice and exposes apply-functions (synchronous mutators). App.jsx remains the sole Supabase caller — it calls Supabase, receives results, then calls hook apply-functions to update state. Two inline modals (export, version history) become stateless components.

**Tech Stack:** React 18, Vite 5, Vitest, `@testing-library/react` (`renderHook` + `act`)

## Global Constraints

- No Supabase calls in any hook file — App.jsx is the sole Supabase caller
- All 188 existing tests must pass after every task
- Each new hook file must be ≤ 60 lines
- Named exports for all hooks (e.g. `export function useTopics()`)
- Test files mirror hook paths: `src/hooks/useTopics.js` → `src/hooks/useTopics.test.js`
- Run tests with: `npm test`
- Run single file: `npx vitest run src/hooks/useTopics.test.js`

---

### Task 1: `useTopics`

**Files:**
- Create: `src/hooks/useTopics.js`
- Create: `src/hooks/useTopics.test.js`

**Interfaces:**
- Produces: `useTopics()` → `{ topics, setTopics, selectedId, setSelectedId, inboxCount, setInboxCount, selectedTopic, inboxTopic, applyAddTopic, applySelectTopic }`
  - `applyAddTopic(topic: object)` — appends topic, re-sorts by name, sets selectedId to topic.id
  - `applySelectTopic(id: string)` — sets selectedId
  - `selectedTopic` — memoized `topics.find(t => t.id === selectedId) || null`
  - `inboxTopic` — memoized `topics.find(t => t.name === 'Inbox')`

- [ ] **Step 1: Write the failing tests**

```js
// src/hooks/useTopics.test.js
import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useTopics } from './useTopics.js'

test('starts with empty topics and null selectedId', () => {
  const { result } = renderHook(() => useTopics())
  expect(result.current.topics).toEqual([])
  expect(result.current.selectedId).toBeNull()
  expect(result.current.inboxCount).toBe(0)
})

test('selectedTopic is null when no selectedId', () => {
  const { result } = renderHook(() => useTopics())
  expect(result.current.selectedTopic).toBeNull()
})

test('inboxTopic finds topic named Inbox', () => {
  const { result } = renderHook(() => useTopics())
  act(() => { result.current.setTopics([{ id: '1', name: 'Inbox' }, { id: '2', name: 'Books' }]) })
  expect(result.current.inboxTopic).toEqual({ id: '1', name: 'Inbox' })
})

test('applyAddTopic appends, sorts by name, and selects the new topic', () => {
  const { result } = renderHook(() => useTopics())
  act(() => { result.current.setTopics([{ id: '1', name: 'Zebra' }]) })
  act(() => { result.current.applyAddTopic({ id: '2', name: 'Apple' }) })
  expect(result.current.topics[0].name).toBe('Apple')
  expect(result.current.topics[1].name).toBe('Zebra')
  expect(result.current.selectedId).toBe('2')
})

test('applySelectTopic sets selectedId and updates selectedTopic', () => {
  const { result } = renderHook(() => useTopics())
  act(() => { result.current.setTopics([{ id: '1', name: 'Books' }]) })
  act(() => { result.current.applySelectTopic('1') })
  expect(result.current.selectedId).toBe('1')
  expect(result.current.selectedTopic).toEqual({ id: '1', name: 'Books' })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/hooks/useTopics.test.js
```
Expected: FAIL — "useTopics is not a function" or module not found.

- [ ] **Step 3: Implement `useTopics`**

```js
// src/hooks/useTopics.js
import { useState, useMemo } from 'react'

export function useTopics() {
  const [topics, setTopics] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [inboxCount, setInboxCount] = useState(0)

  const selectedTopic = useMemo(() => topics.find(t => t.id === selectedId) || null, [topics, selectedId])
  const inboxTopic = useMemo(() => topics.find(t => t.name === 'Inbox'), [topics])

  function applyAddTopic(topic) {
    setTopics(prev => [...prev, topic].sort((a, b) => a.name.localeCompare(b.name)))
    setSelectedId(topic.id)
  }

  function applySelectTopic(id) {
    setSelectedId(id)
  }

  return { topics, setTopics, selectedId, setSelectedId, inboxCount, setInboxCount, selectedTopic, inboxTopic, applyAddTopic, applySelectTopic }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/hooks/useTopics.test.js
```
Expected: 5 tests PASS.

- [ ] **Step 5: Run full suite to confirm no regressions**

```
npm test
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```
git add src/hooks/useTopics.js src/hooks/useTopics.test.js
git commit -m "feat: add useTopics hook"
```

---

### Task 2: `useEntries`

**Files:**
- Create: `src/hooks/useEntries.js`
- Create: `src/hooks/useEntries.test.js`

**Interfaces:**
- Produces: `useEntries()` → `{ entries, setEntries, globalSearchResults, setGlobalSearchResults, applyUpdateEntry, applyDeleteEntry, applyMoveEntry }`
  - `applyUpdateEntry(id: string, updated: object)` — replaces entry in list, **preserves existing `.tags`**
  - `applyDeleteEntry(id: string)` — filters entry out
  - `applyMoveEntry(id: string)` — filters entry out (same as delete from current list)

- [ ] **Step 1: Write the failing tests**

```js
// src/hooks/useEntries.test.js
import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useEntries } from './useEntries.js'

const ENTRIES = [
  { id: '1', title: 'A', tags: ['x'], status: 'backlog' },
  { id: '2', title: 'B', tags: ['y'], status: 'active' },
]

test('starts with empty entries and null search results', () => {
  const { result } = renderHook(() => useEntries())
  expect(result.current.entries).toEqual([])
  expect(result.current.globalSearchResults).toBeNull()
})

test('applyUpdateEntry replaces entry and preserves existing tags', () => {
  const { result } = renderHook(() => useEntries())
  act(() => { result.current.setEntries(ENTRIES) })
  act(() => { result.current.applyUpdateEntry('1', { id: '1', title: 'A-updated', tags: [], status: 'done' }) })
  const updated = result.current.entries.find(e => e.id === '1')
  expect(updated.title).toBe('A-updated')
  expect(updated.tags).toEqual(['x']) // preserved from original, not from updated
})

test('applyDeleteEntry removes entry by id', () => {
  const { result } = renderHook(() => useEntries())
  act(() => { result.current.setEntries(ENTRIES) })
  act(() => { result.current.applyDeleteEntry('1') })
  expect(result.current.entries).toHaveLength(1)
  expect(result.current.entries[0].id).toBe('2')
})

test('applyMoveEntry removes entry from list', () => {
  const { result } = renderHook(() => useEntries())
  act(() => { result.current.setEntries(ENTRIES) })
  act(() => { result.current.applyMoveEntry('2') })
  expect(result.current.entries).toHaveLength(1)
  expect(result.current.entries[0].id).toBe('1')
})

test('setGlobalSearchResults stores results', () => {
  const { result } = renderHook(() => useEntries())
  act(() => { result.current.setGlobalSearchResults([{ id: '3', title: 'C' }]) })
  expect(result.current.globalSearchResults).toHaveLength(1)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/hooks/useEntries.test.js
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `useEntries`**

```js
// src/hooks/useEntries.js
import { useState } from 'react'

export function useEntries() {
  const [entries, setEntries] = useState([])
  const [globalSearchResults, setGlobalSearchResults] = useState(null)

  function applyUpdateEntry(id, updated) {
    setEntries(prev => prev.map(e => e.id === id ? { ...updated, tags: e.tags } : e))
  }

  function applyDeleteEntry(id) {
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  function applyMoveEntry(id) {
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  return { entries, setEntries, globalSearchResults, setGlobalSearchResults, applyUpdateEntry, applyDeleteEntry, applyMoveEntry }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/hooks/useEntries.test.js
```
Expected: 5 tests PASS.

- [ ] **Step 5: Run full suite**

```
npm test
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```
git add src/hooks/useEntries.js src/hooks/useEntries.test.js
git commit -m "feat: add useEntries hook"
```

---

### Task 3: `usePendingArchive`

**Files:**
- Create: `src/hooks/usePendingArchive.js`
- Create: `src/hooks/usePendingArchive.test.js`

**Interfaces:**
- Produces: `usePendingArchive(selectedId: string | null)` → `{ pendingArchiveIds, addPending, removePending }`
  - `pendingArchiveIds` — `Set<string>`
  - `addPending(id: string)` — adds id to set
  - `removePending(id: string)` — removes id from set
  - Effect: clears the set whenever `selectedId` changes (topic navigation clears pending)

- [ ] **Step 1: Write the failing tests**

```js
// src/hooks/usePendingArchive.test.js
import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { usePendingArchive } from './usePendingArchive.js'

test('starts with empty set', () => {
  const { result } = renderHook(() => usePendingArchive(null))
  expect(result.current.pendingArchiveIds.size).toBe(0)
})

test('addPending adds id to set', () => {
  const { result } = renderHook(() => usePendingArchive('topic-1'))
  act(() => { result.current.addPending('entry-1') })
  expect(result.current.pendingArchiveIds.has('entry-1')).toBe(true)
})

test('removePending removes id from set', () => {
  const { result } = renderHook(() => usePendingArchive('topic-1'))
  act(() => { result.current.addPending('entry-1') })
  act(() => { result.current.removePending('entry-1') })
  expect(result.current.pendingArchiveIds.has('entry-1')).toBe(false)
})

test('clears set when selectedId changes', () => {
  let selectedId = 'topic-1'
  const { result, rerender } = renderHook(() => usePendingArchive(selectedId))
  act(() => { result.current.addPending('entry-1') })
  expect(result.current.pendingArchiveIds.size).toBe(1)
  selectedId = 'topic-2'
  rerender()
  expect(result.current.pendingArchiveIds.size).toBe(0)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/hooks/usePendingArchive.test.js
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `usePendingArchive`**

```js
// src/hooks/usePendingArchive.js
import { useState, useEffect } from 'react'

export function usePendingArchive(selectedId) {
  const [pendingArchiveIds, setPendingArchiveIds] = useState(new Set())

  useEffect(() => {
    setPendingArchiveIds(new Set())
  }, [selectedId])

  function addPending(id) {
    setPendingArchiveIds(prev => new Set([...prev, id]))
  }

  function removePending(id) {
    setPendingArchiveIds(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  return { pendingArchiveIds, addPending, removePending }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/hooks/usePendingArchive.test.js
```
Expected: 4 tests PASS.

- [ ] **Step 5: Run full suite**

```
npm test
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```
git add src/hooks/usePendingArchive.js src/hooks/usePendingArchive.test.js
git commit -m "feat: add usePendingArchive hook"
```

---

### Task 4: `useInbox`, `useTrash`, `useRevisit`

These three hooks share the same apply-function pattern (filter by id). They are grouped because a reviewer approving the pattern approves all three.

**Files:**
- Create: `src/hooks/useInbox.js`
- Create: `src/hooks/useInbox.test.js`
- Create: `src/hooks/useTrash.js`
- Create: `src/hooks/useTrash.test.js`
- Create: `src/hooks/useRevisit.js`
- Create: `src/hooks/useRevisit.test.js`

**Interfaces:**
- `useInbox()` → `{ inboxEntries, setInboxEntries, applyAssign, applySortDelete }`
  - `applyAssign(id)` — removes entry from inboxEntries
  - `applySortDelete(id)` — removes entry from inboxEntries
- `useTrash()` → `{ trashEntries, setTrashEntries, applyRestore, applyClear }`
  - `applyRestore(id)` — removes entry from trashEntries
  - `applyClear()` — sets trashEntries to []
- `useRevisit()` → `{ revisitEntries, setRevisitEntries, recentActivity, setRecentActivity, applySeen }`
  - `applySeen(id)` — removes entry from revisitEntries

- [ ] **Step 1: Write the failing tests**

```js
// src/hooks/useInbox.test.js
import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useInbox } from './useInbox.js'

const ENTRIES = [{ id: '1', title: 'A' }, { id: '2', title: 'B' }]

test('starts empty', () => {
  const { result } = renderHook(() => useInbox())
  expect(result.current.inboxEntries).toEqual([])
})

test('applyAssign removes entry', () => {
  const { result } = renderHook(() => useInbox())
  act(() => { result.current.setInboxEntries(ENTRIES) })
  act(() => { result.current.applyAssign('1') })
  expect(result.current.inboxEntries).toHaveLength(1)
  expect(result.current.inboxEntries[0].id).toBe('2')
})

test('applySortDelete removes entry', () => {
  const { result } = renderHook(() => useInbox())
  act(() => { result.current.setInboxEntries(ENTRIES) })
  act(() => { result.current.applySortDelete('2') })
  expect(result.current.inboxEntries).toHaveLength(1)
  expect(result.current.inboxEntries[0].id).toBe('1')
})
```

```js
// src/hooks/useTrash.test.js
import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useTrash } from './useTrash.js'

const ENTRIES = [{ id: '1', title: 'A' }, { id: '2', title: 'B' }]

test('starts empty', () => {
  const { result } = renderHook(() => useTrash())
  expect(result.current.trashEntries).toEqual([])
})

test('applyRestore removes entry', () => {
  const { result } = renderHook(() => useTrash())
  act(() => { result.current.setTrashEntries(ENTRIES) })
  act(() => { result.current.applyRestore('1') })
  expect(result.current.trashEntries).toHaveLength(1)
  expect(result.current.trashEntries[0].id).toBe('2')
})

test('applyClear empties the list', () => {
  const { result } = renderHook(() => useTrash())
  act(() => { result.current.setTrashEntries(ENTRIES) })
  act(() => { result.current.applyClear() })
  expect(result.current.trashEntries).toEqual([])
})
```

```js
// src/hooks/useRevisit.test.js
import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useRevisit } from './useRevisit.js'

const ENTRIES = [{ id: '1', title: 'A' }, { id: '2', title: 'B' }]

test('starts empty', () => {
  const { result } = renderHook(() => useRevisit())
  expect(result.current.revisitEntries).toEqual([])
  expect(result.current.recentActivity).toEqual([])
})

test('applySeen removes entry from revisitEntries', () => {
  const { result } = renderHook(() => useRevisit())
  act(() => { result.current.setRevisitEntries(ENTRIES) })
  act(() => { result.current.applySeen('1') })
  expect(result.current.revisitEntries).toHaveLength(1)
  expect(result.current.revisitEntries[0].id).toBe('2')
})

test('setRecentActivity stores activity', () => {
  const { result } = renderHook(() => useRevisit())
  act(() => { result.current.setRecentActivity([{ id: 'r1' }]) })
  expect(result.current.recentActivity).toHaveLength(1)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/hooks/useInbox.test.js src/hooks/useTrash.test.js src/hooks/useRevisit.test.js
```
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the three hooks**

```js
// src/hooks/useInbox.js
import { useState } from 'react'

export function useInbox() {
  const [inboxEntries, setInboxEntries] = useState([])

  function applyAssign(id) {
    setInboxEntries(prev => prev.filter(e => e.id !== id))
  }

  function applySortDelete(id) {
    setInboxEntries(prev => prev.filter(e => e.id !== id))
  }

  return { inboxEntries, setInboxEntries, applyAssign, applySortDelete }
}
```

```js
// src/hooks/useTrash.js
import { useState } from 'react'

export function useTrash() {
  const [trashEntries, setTrashEntries] = useState([])

  function applyRestore(id) {
    setTrashEntries(prev => prev.filter(e => e.id !== id))
  }

  function applyClear() {
    setTrashEntries([])
  }

  return { trashEntries, setTrashEntries, applyRestore, applyClear }
}
```

```js
// src/hooks/useRevisit.js
import { useState } from 'react'

export function useRevisit() {
  const [revisitEntries, setRevisitEntries] = useState([])
  const [recentActivity, setRecentActivity] = useState([])

  function applySeen(id) {
    setRevisitEntries(prev => prev.filter(e => e.id !== id))
  }

  return { revisitEntries, setRevisitEntries, recentActivity, setRecentActivity, applySeen }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/hooks/useInbox.test.js src/hooks/useTrash.test.js src/hooks/useRevisit.test.js
```
Expected: 9 tests PASS.

- [ ] **Step 5: Run full suite**

```
npm test
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```
git add src/hooks/useInbox.js src/hooks/useInbox.test.js src/hooks/useTrash.js src/hooks/useTrash.test.js src/hooks/useRevisit.js src/hooks/useRevisit.test.js
git commit -m "feat: add useInbox, useTrash, useRevisit hooks"
```

---

### Task 5: `useTags`

**Files:**
- Create: `src/hooks/useTags.js`
- Create: `src/hooks/useTags.test.js`

**Interfaces:**
- Produces: `useTags()` → `{ allTags, setAllTags, tagColors, applyUpdateTagColor }`
  - `tagColors` — memoized `{ [name]: color }` map (only tags with a non-null color)
  - `applyUpdateTagColor(name: string, color: string | null)` — updates tag in-place; sets `color` to `color || null`

- [ ] **Step 1: Write the failing tests**

```js
// src/hooks/useTags.test.js
import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useTags } from './useTags.js'

const TAGS = [
  { id: '1', name: 'fiction', color: '#ff0000' },
  { id: '2', name: 'tech', color: null },
]

test('starts with empty tags and empty tagColors', () => {
  const { result } = renderHook(() => useTags())
  expect(result.current.allTags).toEqual([])
  expect(result.current.tagColors).toEqual({})
})

test('tagColors only includes tags with a color', () => {
  const { result } = renderHook(() => useTags())
  act(() => { result.current.setAllTags(TAGS) })
  expect(result.current.tagColors).toEqual({ fiction: '#ff0000' })
})

test('applyUpdateTagColor updates color for named tag', () => {
  const { result } = renderHook(() => useTags())
  act(() => { result.current.setAllTags(TAGS) })
  act(() => { result.current.applyUpdateTagColor('tech', '#00ff00') })
  expect(result.current.allTags.find(t => t.name === 'tech').color).toBe('#00ff00')
  expect(result.current.tagColors['tech']).toBe('#00ff00')
})

test('applyUpdateTagColor with empty string sets color to null', () => {
  const { result } = renderHook(() => useTags())
  act(() => { result.current.setAllTags(TAGS) })
  act(() => { result.current.applyUpdateTagColor('fiction', '') })
  expect(result.current.allTags.find(t => t.name === 'fiction').color).toBeNull()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/hooks/useTags.test.js
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `useTags`**

```js
// src/hooks/useTags.js
import { useState, useMemo } from 'react'

export function useTags() {
  const [allTags, setAllTags] = useState([])

  const tagColors = useMemo(
    () => Object.fromEntries(allTags.filter(t => t.color).map(t => [t.name, t.color])),
    [allTags]
  )

  function applyUpdateTagColor(name, color) {
    setAllTags(prev => prev.map(t => t.name === name ? { ...t, color: color || null } : t))
  }

  return { allTags, setAllTags, tagColors, applyUpdateTagColor }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/hooks/useTags.test.js
```
Expected: 4 tests PASS.

- [ ] **Step 5: Run full suite**

```
npm test
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```
git add src/hooks/useTags.js src/hooks/useTags.test.js
git commit -m "feat: add useTags hook"
```

---

### Task 6: `useVersions`, `useExport`, `useArchiveToast`

These are simple state holders with no derived state or effects. Grouped because each is < 15 lines.

**Files:**
- Create: `src/hooks/useVersions.js`
- Create: `src/hooks/useVersions.test.js`
- Create: `src/hooks/useExport.js`
- Create: `src/hooks/useExport.test.js`
- Create: `src/hooks/useArchiveToast.js`
- Create: `src/hooks/useArchiveToast.test.js`

**Interfaces:**
- `useVersions()` → `{ historyFor, versions, openHistory, closeHistory }`
  - `openHistory(entryId: string, versionList: object[])` — sets historyFor + versions
  - `closeHistory()` — sets historyFor to null
- `useExport()` → `{ exportModal, openExportLoading, setExportResult, closeExportModal }`
  - `exportModal`: `null | { estimatedKB: number | null, entryCount: number | null, loading: boolean }`
  - `openExportLoading()` — sets `{ estimatedKB: null, entryCount: null, loading: true }`
  - `setExportResult(estimatedKB: number, entryCount: number)` — sets `{ estimatedKB, entryCount, loading: false }`
  - `closeExportModal()` — sets to null
- `useArchiveToast()` → `{ archiveToast, setArchiveToast }`
  - `archiveToast` defaults to `true`

- [ ] **Step 1: Write the failing tests**

```js
// src/hooks/useVersions.test.js
import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useVersions } from './useVersions.js'

test('starts with null historyFor and empty versions', () => {
  const { result } = renderHook(() => useVersions())
  expect(result.current.historyFor).toBeNull()
  expect(result.current.versions).toEqual([])
})

test('openHistory sets historyFor and versions', () => {
  const { result } = renderHook(() => useVersions())
  act(() => { result.current.openHistory('entry-1', [{ id: 'v1', note: 'hello' }]) })
  expect(result.current.historyFor).toBe('entry-1')
  expect(result.current.versions).toHaveLength(1)
})

test('closeHistory sets historyFor to null', () => {
  const { result } = renderHook(() => useVersions())
  act(() => { result.current.openHistory('entry-1', []) })
  act(() => { result.current.closeHistory() })
  expect(result.current.historyFor).toBeNull()
})
```

```js
// src/hooks/useExport.test.js
import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useExport } from './useExport.js'

test('starts with null exportModal', () => {
  const { result } = renderHook(() => useExport())
  expect(result.current.exportModal).toBeNull()
})

test('openExportLoading sets loading state', () => {
  const { result } = renderHook(() => useExport())
  act(() => { result.current.openExportLoading() })
  expect(result.current.exportModal).toEqual({ estimatedKB: null, entryCount: null, loading: true })
})

test('setExportResult sets result with loading false', () => {
  const { result } = renderHook(() => useExport())
  act(() => { result.current.openExportLoading() })
  act(() => { result.current.setExportResult(42, 100) })
  expect(result.current.exportModal).toEqual({ estimatedKB: 42, entryCount: 100, loading: false })
})

test('closeExportModal resets to null', () => {
  const { result } = renderHook(() => useExport())
  act(() => { result.current.openExportLoading() })
  act(() => { result.current.closeExportModal() })
  expect(result.current.exportModal).toBeNull()
})
```

```js
// src/hooks/useArchiveToast.test.js
import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useArchiveToast } from './useArchiveToast.js'

test('defaults to true', () => {
  const { result } = renderHook(() => useArchiveToast())
  expect(result.current.archiveToast).toBe(true)
})

test('setArchiveToast updates value', () => {
  const { result } = renderHook(() => useArchiveToast())
  act(() => { result.current.setArchiveToast(false) })
  expect(result.current.archiveToast).toBe(false)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/hooks/useVersions.test.js src/hooks/useExport.test.js src/hooks/useArchiveToast.test.js
```
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the three hooks**

```js
// src/hooks/useVersions.js
import { useState } from 'react'

export function useVersions() {
  const [historyFor, setHistoryFor] = useState(null)
  const [versions, setVersions] = useState([])

  function openHistory(entryId, versionList) {
    setHistoryFor(entryId)
    setVersions(versionList)
  }

  function closeHistory() {
    setHistoryFor(null)
  }

  return { historyFor, versions, openHistory, closeHistory }
}
```

```js
// src/hooks/useExport.js
import { useState } from 'react'

export function useExport() {
  const [exportModal, setExportModal] = useState(null)

  function openExportLoading() {
    setExportModal({ estimatedKB: null, entryCount: null, loading: true })
  }

  function setExportResult(estimatedKB, entryCount) {
    setExportModal({ estimatedKB, entryCount, loading: false })
  }

  function closeExportModal() {
    setExportModal(null)
  }

  return { exportModal, openExportLoading, setExportResult, closeExportModal }
}
```

```js
// src/hooks/useArchiveToast.js
import { useState } from 'react'

export function useArchiveToast() {
  const [archiveToast, setArchiveToast] = useState(true)
  return { archiveToast, setArchiveToast }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/hooks/useVersions.test.js src/hooks/useExport.test.js src/hooks/useArchiveToast.test.js
```
Expected: 9 tests PASS.

- [ ] **Step 5: Run full suite**

```
npm test
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```
git add src/hooks/useVersions.js src/hooks/useVersions.test.js src/hooks/useExport.js src/hooks/useExport.test.js src/hooks/useArchiveToast.js src/hooks/useArchiveToast.test.js
git commit -m "feat: add useVersions, useExport, useArchiveToast hooks"
```

---

### Task 7: `ExportModal` component

**Files:**
- Create: `src/components/ExportModal.jsx`
- Create: `src/components/ExportModal.test.jsx`

**Interfaces:**
- Consumes: `Modal` from `./Modal.jsx`
- Props: `{ exportModal: { estimatedKB: number|null, entryCount: number|null, loading: boolean }, topics: object[], onConfirm: () => void, onClose: () => void }`
- Produces: stateless component, renders export confirmation UI

- [ ] **Step 1: Write the failing tests**

```jsx
// src/components/ExportModal.test.jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import ExportModal from './ExportModal.jsx'

const TOPICS = [{ id: '1', name: 'Books' }, { id: '2', name: 'Films' }]

test('shows loading message when loading is true', () => {
  render(
    <ExportModal
      exportModal={{ estimatedKB: null, entryCount: null, loading: true }}
      topics={TOPICS}
      onConfirm={vi.fn()}
      onClose={vi.fn()}
    />
  )
  expect(screen.getByText(/calculating export size/i)).toBeTruthy()
})

test('shows entry count and topic count when loaded', () => {
  render(
    <ExportModal
      exportModal={{ estimatedKB: 50, entryCount: 42, loading: false }}
      topics={TOPICS}
      onConfirm={vi.fn()}
      onClose={vi.fn()}
    />
  )
  expect(screen.getByText(/42 entries/i)).toBeTruthy()
  expect(screen.getByText(/2 topics/i)).toBeTruthy()
})

test('shows size in KB when under 1024', () => {
  render(
    <ExportModal
      exportModal={{ estimatedKB: 50, entryCount: 10, loading: false }}
      topics={TOPICS}
      onConfirm={vi.fn()}
      onClose={vi.fn()}
    />
  )
  expect(screen.getByText(/50 KB/)).toBeTruthy()
})

test('shows size in MB when 1024 or more', () => {
  render(
    <ExportModal
      exportModal={{ estimatedKB: 2048, entryCount: 10, loading: false }}
      topics={TOPICS}
      onConfirm={vi.fn()}
      onClose={vi.fn()}
    />
  )
  expect(screen.getByText(/2\.0 MB/)).toBeTruthy()
})

test('Export button calls onConfirm', () => {
  const onConfirm = vi.fn()
  render(
    <ExportModal
      exportModal={{ estimatedKB: 10, entryCount: 5, loading: false }}
      topics={TOPICS}
      onConfirm={onConfirm}
      onClose={vi.fn()}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: /^export$/i }))
  expect(onConfirm).toHaveBeenCalledOnce()
})

test('Cancel button calls onClose', () => {
  const onClose = vi.fn()
  render(
    <ExportModal
      exportModal={{ estimatedKB: 10, entryCount: 5, loading: false }}
      topics={TOPICS}
      onConfirm={vi.fn()}
      onClose={onClose}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
  expect(onClose).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/components/ExportModal.test.jsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ExportModal`**

```jsx
// src/components/ExportModal.jsx
import Modal from './Modal.jsx'

export default function ExportModal({ exportModal, topics, onConfirm, onClose }) {
  return (
    <Modal onClose={onClose} label="Export library" maxWidth="400px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
        {exportModal.loading ? (
          <p className="muted" style={{ fontSize: 13 }}>Calculating export size…</p>
        ) : (
          <>
            <p style={{ fontSize: 14, margin: 0 }}>
              Export <strong>{exportModal.entryCount ?? '—'} entries</strong> across <strong>{topics.length} topics</strong> as a zip of Markdown files.
            </p>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              Estimated size: <strong>~{exportModal.estimatedKB != null
                ? exportModal.estimatedKB >= 1024
                  ? `${(exportModal.estimatedKB / 1024).toFixed(1)} MB`
                  : `${exportModal.estimatedKB} KB`
                : '—'}</strong> (compressed)
            </p>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Note: file attachments (images, PDFs) are stored in Supabase and are not included in this export.
            </p>
          </>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-small btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-small" onClick={onConfirm} disabled={exportModal.loading}>
            {exportModal.loading ? 'Calculating…' : 'Export'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/components/ExportModal.test.jsx
```
Expected: 6 tests PASS.

- [ ] **Step 5: Run full suite**

```
npm test
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```
git add src/components/ExportModal.jsx src/components/ExportModal.test.jsx
git commit -m "feat: extract ExportModal component"
```

---

### Task 8: `VersionHistoryModal` component

**Files:**
- Create: `src/components/VersionHistoryModal.jsx`
- Create: `src/components/VersionHistoryModal.test.jsx`

**Interfaces:**
- Consumes: `Modal` from `./Modal.jsx`, `VersionHistory` from `./VersionHistory.jsx`
- Props: `{ versions: object[], onRestore: (note: string) => void, onClose: () => void }`
- Produces: stateless component

- [ ] **Step 1: Write the failing tests**

```jsx
// src/components/VersionHistoryModal.test.jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import VersionHistoryModal from './VersionHistoryModal.jsx'

test('renders version history label', () => {
  render(
    <VersionHistoryModal
      versions={[]}
      onRestore={vi.fn()}
      onClose={vi.fn()}
    />
  )
  expect(screen.getByText('Version history')).toBeTruthy()
})

test('Close button calls onClose', () => {
  const onClose = vi.fn()
  render(
    <VersionHistoryModal
      versions={[]}
      onRestore={vi.fn()}
      onClose={onClose}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: /close/i }))
  expect(onClose).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/components/VersionHistoryModal.test.jsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `VersionHistoryModal`**

```jsx
// src/components/VersionHistoryModal.jsx
import Modal from './Modal.jsx'
import VersionHistory from './VersionHistory.jsx'

export default function VersionHistoryModal({ versions, onRestore, onClose }) {
  return (
    <Modal onClose={onClose} label="Version history" maxWidth="560px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '70vh', overflow: 'auto' }}>
        <p className="section-label">Version history</p>
        <VersionHistory versions={versions} onRestore={onRestore} />
        <button onClick={onClose}>Close</button>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/components/VersionHistoryModal.test.jsx
```
Expected: 2 tests PASS.

- [ ] **Step 5: Run full suite**

```
npm test
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```
git add src/components/VersionHistoryModal.jsx src/components/VersionHistoryModal.test.jsx
git commit -m "feat: extract VersionHistoryModal component"
```

---

### Task 9: Refactor `App.jsx`

Replace all inline state and modals with the hooks and components created in Tasks 1–8. No logic changes — only restructuring.

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: all 9 hooks from `src/hooks/`, `ExportModal` and `VersionHistoryModal` from `src/components/`
- The rendered output must be identical to the original — same DOM structure, same props to all child components

- [ ] **Step 1: Verify the full test suite passes before touching App.jsx**

```
npm test
```
Expected: all tests pass. Do not proceed if any fail.

- [ ] **Step 2: Replace `src/App.jsx` with the refactored version**

```jsx
// src/App.jsx
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { LayoutGrid, Upload, Inbox, RotateCcw, BarChart2, Settings2, Trash2 as TrashIcon, Download, Menu, Home } from 'lucide-react'
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
import HomeView from './components/HomeView.jsx'
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
  const { previewUrl, openPreview, closePreview } = useFilePreview()
  const { toasts, addToast, dismissToast } = useToast()

  const [view, setView] = useState('home')
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
      listEntriesByTopic(supabase, selectedId).then(setEntries)
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

  async function handleAddTopic(name) {
    const t = await createTopic(supabase, name)
    applyAddTopic(t)
  }

  async function handleAddEntry({ url, note }) {
    const e = await createEntry(supabase, { topicId: selectedId, url, note })
    setEntries((prev) => [{ ...e, tags: [] }, ...prev])
    if (url) {
      const title = await fetchTitle(supabase, url)
      if (title) {
        const updated = await updateEntry(supabase, e.id, { title })
        applyUpdateEntry(e.id, updated)
      }
    }
  }

  async function handleDelete(id) {
    await softDeleteEntry(supabase, id)
    applyDeleteEntry(id)
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
          {sidebarOpen ? '‹' : '›'}
        </button>
      </aside>

      <main className="main">
        <div key={view === 'browse' ? `browse-${selectedId}` : view} className="view-enter">
          {view === 'home' && (
            <HomeView
              topics={topics}
              inboxCount={inboxCount}
              onSelectTopic={handleSelectTopic}
              onSortInbox={handleSortInbox}
              supabase={supabase}
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
            />
          )}
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
```

- [ ] **Step 3: Run the full test suite**

```
npm test
```
Expected: all tests pass (188 original + new hook/component tests).

- [ ] **Step 4: Verify App.jsx line count**

```
wc -l src/App.jsx
```
Expected: ≤ 260 lines.

- [ ] **Step 5: Verify no Supabase calls in any hook file**

```
grep -r "supabase" src/hooks/
```
Expected: no output.

- [ ] **Step 6: Commit**

```
git add src/App.jsx
git commit -m "refactor: wire App.jsx to domain hooks and extracted modal components"
```

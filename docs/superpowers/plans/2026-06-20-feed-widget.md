# Feed Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact "Latest" widget to the right-column panel showing the 8 most recent unread items from the user's subscribed feeds, with dismiss and save-to-MediaLog actions.

**Architecture:** A single new `FeedWidget` component queries `feed_items` (joined with `feeds` for the source name) via the `supabase` prop. It renders a compact list identical in style to OpportunitiesWidget. Dismiss marks `dismissed_at`; save marks `saved_at` and creates a MediaLog entry via an `onSave` callback. Added to `WidgetPanel` above the divider before `MarketNewsWidget`. No new DB tables, no new edge functions — fully reuses existing `feed_items` + `feeds` infrastructure.

**Tech Stack:** React 18, Vite 5, `@supabase/supabase-js` v2, Vitest + @testing-library/react, custom CSS in `src/styles.css`

## Global Constraints

- No new npm packages
- All CSS goes in `src/styles.css` (single file)
- All Supabase calls via the `supabase` prop — never import supabaseClient directly in new components
- All existing tests must pass after every task (`npm test -- --run`)
- Widget only appears if the user has at least one feed subscription — shows nothing (null) when `feeds` table is empty
- Follow existing widget CSS conventions: `kw-` prefix for widget panel classes, `padding: 14px 18px` per section

## Existing Interfaces (do NOT modify these files unless noted)

```js
// src/lib/db/feeds.js — already exists, use these functions:
listFeedItems(supabase, feedId)  // feedId=null returns all feeds
// returns: [{ id, feed_id, title, url, summary, published_at, fetched_at, expires_at, saved_at, dismissed_at, feeds: { name, category } }]

dismissFeedItem(supabase, id)    // sets dismissed_at = now()
markFeedItemSaved(supabase, id)  // sets saved_at = now()
listFeeds(supabase)              // returns [{ id, url, name, category }]
```

## DB Schema (already applied — read only)

```
feed_items: id, user_id, feed_id, title, url, summary, published_at, fetched_at, expires_at, saved_at, dismissed_at
feeds:      id, user_id, url, name, category, last_fetched_at
```

---

## Task 1: CSS — feed widget styles

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Append to `src/styles.css`**

```css
/* ── Feed Widget ─────────────────────────────────────────────────────────────── */
.fw-widget { display: flex; flex-direction: column; }
.fw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.fw-refresh-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 13px;
  padding: 0 2px;
  line-height: 1;
}
.fw-refresh-btn:hover { color: var(--text); }
.fw-rows { display: flex; flex-direction: column; }
.fw-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  font-size: var(--text-sm);
}
.fw-row:last-child { border-bottom: none; }
.fw-source-chip {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--surface-2);
  color: var(--muted);
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fw-title {
  flex: 1;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--text-sm);
  text-decoration: none;
}
.fw-title:hover { color: var(--accent); }
.fw-age { color: var(--muted); font-size: 11px; white-space: nowrap; }
.fw-save-btn, .fw-dismiss-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 2px;
  font-size: 13px;
  color: var(--muted);
}
.fw-save-btn:hover { color: #F59E0B; }
.fw-dismiss-btn:hover { color: var(--danger); }
.fw-see-all {
  font-size: var(--text-xs);
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px 0 0;
  text-align: left;
}
.fw-see-all:hover { color: var(--text); }
```

- [ ] **Step 2: Run tests**

```bash
npm test -- --run
```
Expected: same pass/fail as before.

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat: feed widget CSS"
```

---

## Task 2: `FeedWidget` component + test

**Files:**
- Create: `src/components/widgets/FeedWidget.jsx`
- Create: `src/components/widgets/FeedWidget.test.jsx`

**Interfaces:**
- Consumes: `supabase` prop, `onSave(item)` callback prop (called when user saves an item; parent handles creating a MediaLog entry)
- Produces: nothing consumed by other components

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/widgets/FeedWidget.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import FeedWidget from './FeedWidget.jsx'

function makeItem(overrides = {}) {
  return {
    id: 'i1',
    feed_id: 'f1',
    title: 'Test Article',
    url: 'https://example.com/article',
    summary: null,
    published_at: new Date(Date.now() - 7200000).toISOString(),
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    saved_at: null,
    dismissed_at: null,
    feeds: { name: 'Test Blog', category: null },
    ...overrides,
  }
}

function mockSupabase({ feeds = [{ id: 'f1' }], items = [] } = {}) {
  const updateFn = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  return {
    from: vi.fn((table) => {
      if (table === 'feeds') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: feeds, error: null })),
            })),
          })),
        }
      }
      // feed_items
      return {
        select: vi.fn(() => ({
          is: vi.fn(() => ({
            is: vi.fn(() => ({
              gt: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => Promise.resolve({ data: items, error: null })),
                })),
              })),
            })),
          })),
        })),
        update: updateFn,
      }
    }),
    _updateFn: updateFn,
  }
}

test('renders nothing when no feeds subscribed', async () => {
  const { container } = render(<FeedWidget supabase={mockSupabase({ feeds: [] })} onSave={vi.fn()} />)
  await waitFor(() => {})
  expect(container.firstChild).toBeNull()
})

test('renders feed items when feeds exist', async () => {
  const sb = mockSupabase({ feeds: [{ id: 'f1' }], items: [makeItem()] })
  render(<FeedWidget supabase={sb} onSave={vi.fn()} />)
  expect(await screen.findByText('Test Article')).toBeInTheDocument()
  expect(screen.getByText('Test Blog')).toBeInTheDocument()
})

test('dismiss removes item from list', async () => {
  const sb = mockSupabase({ feeds: [{ id: 'f1' }], items: [makeItem()] })
  render(<FeedWidget supabase={sb} onSave={vi.fn()} />)
  await screen.findByText('Test Article')
  await userEvent.click(screen.getByTitle('Dismiss'))
  expect(screen.queryByText('Test Article')).not.toBeInTheDocument()
  expect(sb._updateFn).toHaveBeenCalled()
})

test('save calls onSave callback and removes item', async () => {
  const onSave = vi.fn()
  const sb = mockSupabase({ feeds: [{ id: 'f1' }], items: [makeItem()] })
  render(<FeedWidget supabase={sb} onSave={onSave} />)
  await screen.findByText('Test Article')
  await userEvent.click(screen.getByTitle('Save to MediaLog'))
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Test Article' }))
  expect(sb._updateFn).toHaveBeenCalled()
})

test('shows empty state when feeds exist but no items', async () => {
  const sb = mockSupabase({ feeds: [{ id: 'f1' }], items: [] })
  render(<FeedWidget supabase={sb} onSave={vi.fn()} />)
  expect(await screen.findByText(/no new items/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/widgets/FeedWidget.test.jsx
```
Expected: FAIL — `FeedWidget` not found.

- [ ] **Step 3: Implement `src/components/widgets/FeedWidget.jsx`**

```jsx
import { useEffect, useState, useCallback } from 'react'
import { listFeeds, listFeedItems, dismissFeedItem, markFeedItemSaved } from '../../lib/db/feeds.js'

function formatAge(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.floor(diff / 60000)}m`
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function FeedWidget({ supabase, onSave, onGoToFeed }) {
  const [items, setItems] = useState([])
  const [hasFeeds, setHasFeeds] = useState(null) // null = loading
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const feeds = await listFeeds(supabase)
    if (!feeds.length) { setHasFeeds(false); return }
    setHasFeeds(true)
    const all = await listFeedItems(supabase, null)
    setItems(all.slice(0, 8))
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function refresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  async function dismiss(item) {
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    await dismissFeedItem(supabase, item.id)
  }

  async function save(item) {
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    await markFeedItemSaved(supabase, item.id)
    onSave?.(item)
  }

  // Still loading
  if (hasFeeds === null) return null
  // User has no feeds — don't render the widget at all
  if (!hasFeeds) return null

  return (
    <div className="fw-widget">
      <div className="fw-header">
        <span className="kw-label">latest</span>
        <button className="fw-refresh-btn" onClick={refresh} title="Refresh">
          {refreshing ? '…' : '↻'}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="kw-empty">No new items · <button className="fw-see-all" onClick={onGoToFeed}>open feed ↗</button></p>
      ) : (
        <>
          <div className="fw-rows">
            {items.map((item) => (
              <div key={item.id} className="fw-row">
                <span className="fw-source-chip" title={item.feeds?.name}>{item.feeds?.name ?? 'feed'}</span>
                <a
                  className="fw-title"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  title={item.title}
                >
                  {item.title}
                </a>
                <span className="fw-age">{formatAge(item.published_at || item.fetched_at)}</span>
                <button className="fw-save-btn" onClick={() => save(item)} title="Save to MediaLog">★</button>
                <button className="fw-dismiss-btn" onClick={() => dismiss(item)} title="Dismiss">×</button>
              </div>
            ))}
          </div>
          {onGoToFeed && (
            <button className="fw-see-all" onClick={onGoToFeed}>see all in feed ↗</button>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/components/widgets/FeedWidget.test.jsx
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/widgets/FeedWidget.jsx src/components/widgets/FeedWidget.test.jsx
git commit -m "feat: feed widget — latest items from subscribed feeds with save/dismiss"
```

---

## Task 3: Wire FeedWidget into WidgetPanel + App

**Files:**
- Modify: `src/components/WidgetPanel.jsx`
- Modify: `src/components/HomeView.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- `WidgetPanel` gains `onSaveFeedItem(item)` and `onGoToFeed()` props
- `HomeView` passes them through from App
- `App` provides `handleSaveFeedItem` (reuses existing `handleSaveFromFeed`) and `handleGoToFeed` (sets view to 'feed')

- [ ] **Step 1: Read current files**

Read `src/components/WidgetPanel.jsx`, `src/components/HomeView.jsx` before editing.

- [ ] **Step 2: Update `WidgetPanel.jsx`**

Add import at top:
```jsx
import FeedWidget from './widgets/FeedWidget.jsx'
```

Update prop signature and add FeedWidget before the final divider + MarketNewsWidget:
```jsx
export default function WidgetPanel({ supabase, onTrack, onSaveFeedItem, onGoToFeed }) {
  return (
    <div className="widget-panel">
      <DeadlineAlertBanner supabase={supabase} />
      <ClockWidget />
      <WeatherWidget />
      <div className="kw-divider" />
      <SearchWidget />
      <div className="kw-divider" />
      <p className="kw-label">quick links</p>
      <QuickLinksWidget />
      <div className="kw-divider" />
      <FeedWidget supabase={supabase} onSave={onSaveFeedItem} onGoToFeed={onGoToFeed} />
      <div className="kw-divider" />
      <OpportunitiesWidget supabase={supabase} onTrack={onTrack} />
      <div className="kw-divider" />
      <MarketNewsWidget supabase={supabase} />
    </div>
  )
}
```

- [ ] **Step 3: Update `HomeView.jsx`**

Add `onSaveFeedItem` and `onGoToFeed` to props and pass to WidgetPanel:
```jsx
export default function HomeView({ topics, inboxCount, onSelectTopic, onSortInbox, onTopicIconChange, supabase, onTrack, onSaveFeedItem, onGoToFeed }) {
  const nonInbox = topics.filter((t) => t.name !== 'Inbox')
  return (
    <div className="home-view">
      <div className="home-left">
        <InboxCard count={inboxCount} onSortInbox={onSortInbox} />
        <p className="section-label home-topics-label">TOPICS</p>
        <TopicsGrid topics={nonInbox} onSelectTopic={onSelectTopic} onTopicIconChange={onTopicIconChange} supabase={supabase} />
      </div>
      <div className="home-right">
        <WidgetPanel supabase={supabase} onTrack={onTrack} onSaveFeedItem={onSaveFeedItem} onGoToFeed={onGoToFeed} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update `App.jsx`**

In `App.jsx`, find the HomeView render block and add the two new props:
```jsx
{view === 'home' && (
  <HomeView
    topics={topics}
    inboxCount={inboxCount}
    onSelectTopic={handleSelectTopic}
    onSortInbox={handleSortInbox}
    onTopicIconChange={handleTopicIconChange}
    supabase={supabase}
    onTrack={handleTrack}
    onSaveFeedItem={(item) => handleSaveFromFeed(item, inboxTopic?.id ?? topics[0]?.id)}
    onGoToFeed={() => setView('feed')}
  />
)}
```

`handleSaveFromFeed` already exists in App — reuse it directly. `inboxTopic` is available via `useTopics()`.

- [ ] **Step 5: Update `WidgetPanel.test.jsx` mock**

The WidgetPanel test's mock supabase needs to handle the `feeds` table query. Read `src/components/WidgetPanel.test.jsx` and update the mock:

```jsx
const mockSupabase = {
  functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: new Error('skip') }) },
  from: vi.fn((table) => {
    if (table === 'feeds') {
      return {
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      }
    }
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
        order: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve({ data: [], error: null })) })),
        is: vi.fn(() => ({
          is: vi.fn(() => ({
            gt: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
          })),
        })),
      })),
    }
  }),
}
```

- [ ] **Step 6: Run full test suite**

```bash
npm test -- --run
```
Expected: same pass/fail as before.

- [ ] **Step 7: Commit**

```bash
git add src/components/WidgetPanel.jsx src/components/WidgetPanel.test.jsx src/components/HomeView.jsx src/App.jsx
git commit -m "feat: wire feed widget into dashboard with save and go-to-feed actions"
```

---

## Done Criteria

- `npm test -- --run` passes all suites
- Widget panel shows "latest" section only when user has at least one feed subscription
- Each row shows: source chip (feed name), article title (truncated, links out), age, ★ save, × dismiss
- Saving an item creates a MediaLog entry in the Inbox and removes the item from the widget
- Dismissing removes from widget only (item stays in feed_items as dismissed)
- "see all in feed ↗" button navigates to the Feed view
- Widget shows empty state text when feeds exist but no items are available
- Refresh button re-queries feed_items

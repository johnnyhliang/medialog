# MediaLog Dashboard — Design Spec

**Date:** 2026-06-19
**Status:** Approved

---

## Goal

Replace the "no topic selected" blank state with a personal morning dashboard: topic grid on the left, utility widgets on the right. Makes MediaLog the natural place to open first rather than a browser full of tabs.

---

## Layout

Two-column layout inside the existing `<main>` area. Renders when `view === 'home'` (new nav item, default on load).

```
┌────────────────────────────────┬──────────────────────┐
│  ┌─────────────────────────┐   │  Thu Jun 19 · 10:42  │
│  │ 📥 Inbox  3 unsorted  → │   │                      │
│  └─────────────────────────┘   │  [Search............]│
│                                │  [G] [DDG] [Kagi]   │
│  TOPICS                        │                      │
│  ┌───────┐ ┌───────┐ ┌───────┐│  Gmail · GCal · Brew │
│  │  AI   │ │ Books │ │ Work  ││                      │
│  │  12   │ │  4    │ │  8    ││  MARKET              │
│  └───────┘ └───────┘ └───────┘│  VOO   +0.4%  $541  │
│  ┌───────┐ ┌───────┐          │  NVDA  +2.1%  $875  │
│  │  CS   │ │  ...  │          │  AMZN  +0.8%  $192  │
│  └───────┘ └───────┘          │  AVGO  -0.3%  $168  │
│                                │  MA    -0.1%  $488  │
│                                │  V     +0.3%  $275  │
│                                │  SPGI  +0.8%  $491  │
│                                │                      │
│                                │  MOVERS TODAY        │
│                                │  ↑ NVDA  +8.2%      │
│                                │  ↑ SMCI  +6.1%      │
│                                │  ↓ INTC  -4.3%      │
│                                │                      │
│                                │  TRENDING (WSB)      │
│                                │  ① NVDA  1,204 ↑89% │
│                                │  ② GME    847  ↑12% │
│                                │  ③ TSLA   621  ↓3%  │
│                                │                      │
│                                │  HEADLINES           │
│                                │  · Fed holds rates…  │
│                                │  · Broadcom beats…   │
│                                │  · Oil falls on…     │
└────────────────────────────────┴──────────────────────┘
```

On mobile (≤640px): columns stack vertically, inbox card first, topics grid, then widget panel.

---

## Components

### `HomeView.jsx`
Root component. Two-column flex layout. Left = inbox card + `<TopicsGrid>`, right = `<WidgetPanel>`. Receives `topics`, `inboxCount`, `onSelectTopic`, `onSortInbox` props from App.

### Inbox Card
Full-width card above the topics grid on the left column.

- Always visible regardless of inbox count
- Shows: Inbox icon (`Inbox` from lucide-react) + topic name + entry count
- If count > 0: count badge styled with accent color + "Sort now →" button that calls `onSortInbox()` (navigates to sort view)
- If count === 0: muted "All clear" state with a checkmark icon
- `inboxCount` derived in App from `inboxEntries.length` (already loaded when sort view is used) — on home load, App runs a lightweight count query: `select count(*) from entries where topic_id = inboxTopicId and deleted_at is null`

### Inbox pinned in sidebar
- The Inbox topic always renders first in `TopicList`, above the alphabetical list, separated by a thin divider
- Inbox entry gets an `Inbox` lucide icon before the name
- Implemented in `TopicList.jsx`: split `topics` into `[inboxTopic, ...rest]`, render inbox item separately at top

### `TopicsGrid.jsx`
- CSS `auto-fill` grid, `minmax(160px, 1fr)`
- Each topic card: name, entry count, last-edited age
- Excludes Inbox (shown separately above)
- Sorted alphabetically
- Click → `onSelectTopic(topic)` → sets `selectedId` + `view = 'browse'` in App
- Empty state: "No topics yet — create one in the sidebar"

### `WidgetPanel.jsx`
Right column. Renders a hardcoded array of widget components top-to-bottom. Adding a new widget = one import + one JSX line.

### `ClockWidget.jsx`
- `useEffect` + `setInterval(1000)` updating a `Date` state
- Displays: `Thu Jun 19 · 10:42 AM` — no seconds
- Clears interval on unmount

### `SearchWidget.jsx`
- Controlled text input, Enter → `window.open(url, '_blank')`
- Three hardcoded engines:
  ```js
  const ENGINES = [
    { label: 'G',   url: q => `https://www.google.com/search?q=${encodeURIComponent(q)}&udm=14` },
    { label: 'DDG', url: q => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
    { label: 'K',   url: q => `https://kagi.com/search?q=${encodeURIComponent(q)}` },
  ]
  ```
- Selected engine persisted in `localStorage` key `medialog_search_engine`
- Active engine pill highlighted with accent color

### `QuickLinksWidget.jsx`
- Three hardcoded links:
  ```js
  const LINKS = [
    { label: 'Gmail',    href: 'https://mail.google.com',         icon: 'Mail' },
    { label: 'Calendar', href: 'https://calendar.google.com',      icon: 'Calendar' },
    { label: 'Brew',     href: 'https://www.morningbrew.com',      icon: 'Coffee' },
  ]
  ```
- Icon + label chips in a flex row, open new tab

### `MarketNewsWidget.jsx`
Single component firing one edge function call, rendering four sections: Market, Movers, Trending, Headlines.

**Market section:**
- Hardcoded tickers:
  ```js
  const TICKERS = ['VOO', 'NVDA', 'AMZN', 'AVGO', 'MA', 'V', 'SPGI']
  ```
- Displays: ticker | price | daily change % (green/red)

**Movers Today section:**
- Top 3 day gainers + top 3 day losers from Yahoo Finance predefined screener
- Compact two-column layout: `↑ NVDA +8.2%` / `↓ INTC -4.3%`
- Endpoint: `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_gainers&count=5` and `scrIds=day_losers`

**Trending section (WSB/Reddit):**
- Top 5 from ApeWisdom `filter/all-reddit`
- Shows: rank | ticker | mentions | 24h delta (↑/↓ %)

**Headlines section:**
- Top 5 from Reuters RSS `feeds.reuters.com/reuters/businessNews`
- Parsed server-side; title + link returned

**Polling:** on mount + every 5 min. "Updated Xm ago" timestamp. Per-section graceful error ("unavailable") so one failing source doesn't break others.

---

## `market` Supabase Edge Function (`supabase/functions/market/index.ts`)

Accepts POST `{ tickers: string[] }`. Returns:
```ts
{
  quotes:    Array<{ ticker: string, price: number, change: number, changePercent: number }>,
  gainers:   Array<{ ticker: string, changePercent: number }>,
  losers:    Array<{ ticker: string, changePercent: number }>,
  trending:  Array<{ ticker: string, mentions: number, mentionsDelta: number }>,
  headlines: Array<{ title: string, url: string }>
}
```

**Quotes** — `https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=1d` (no key)

**Movers** — `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_gainers&count=5` and `scrIds=day_losers` (no key)

**Trending** — `https://apewisdom.io/api/v1.0/filter/all-reddit/page/1` (no key). Delta = `(mentions - mentions_24h_ago) / mentions_24h_ago * 100`.

**Headlines** — `https://feeds.reuters.com/reuters/businessNews` RSS XML, regex parse `<title>` and `<link>` from `<item>` blocks, return top 5.

**No secrets required.**

**CORS headers** on all responses.

---

## Navigation

- New "Home" nav item, first in sidebar nav, `Home` lucide icon
- `view` gains `'home'` in App state
- Default view on load: `'home'`
- Clicking topic card → `selectedId` + `view = 'browse'`
- Clicking "Sort now →" on inbox card → `view = 'sort'` + `loadInbox()`

---

## Data Flow

```
App.jsx
  └── HomeView (view === 'home')
        ├── InboxCard        ← inboxCount (lightweight count query), onSortInbox
        ├── TopicsGrid       ← topics[] (already loaded), onSelectTopic
        └── WidgetPanel
              ├── ClockWidget         (self-contained)
              ├── SearchWidget        (self-contained, localStorage)
              ├── QuickLinksWidget    (self-contained, hardcoded)
              └── MarketNewsWidget    ← supabase prop

TopicList.jsx (sidebar)
  ├── InboxItem (pinned top, Inbox icon, always first)
  ├── [divider]
  └── rest of topics alphabetically
```

---

## New Files

```
src/components/HomeView.jsx
src/components/TopicsGrid.jsx
src/components/InboxCard.jsx
src/components/WidgetPanel.jsx
src/components/widgets/ClockWidget.jsx
src/components/widgets/SearchWidget.jsx
src/components/widgets/QuickLinksWidget.jsx
src/components/widgets/MarketNewsWidget.jsx
supabase/functions/market/index.ts
```

## Modified Files

```
src/App.jsx          — 'home' view, default to 'home', inbox count query on home load,
                       pass props to HomeView, onSortInbox handler
src/components/TopicList.jsx  — pin Inbox to top with icon + divider
src/styles.css       — HomeView layout, InboxCard, TopicsGrid, WidgetPanel, widget styles
```

---

## Secrets Required

None. All data sources are public endpoints.

---

## Future Widget Ideas (not in this spec)

- Custom quick links editor with icon picker and variable-width chips
- TickTick task management widget (OAuth, full CRUD)
- Canvas (UMich) upcoming assignments
- Google Calendar real data (OAuth)
- Browser extension: new tab override pointing to this dashboard
- Weather widget

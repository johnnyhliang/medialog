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
│  TOPICS                        │  Thu Jun 19 · 10:42  │
│  ┌───────┐ ┌───────┐ ┌───────┐│                      │
│  │  AI   │ │ Books │ │ Work  ││  [Search............]│
│  │  12   │ │  4    │ │  8    ││  [G] [DDG] [Kagi]   │
│  └───────┘ └───────┘ └───────┘│                      │
│  ┌───────┐ ┌───────┐          │  Gmail  · GCal       │
│  │  CS   │ │  ...  │          │                      │
│  └───────┘ └───────┘          │  MARKET              │
│                                │  VOO   +0.4%  $541  │
│                                │  NVDA  +2.1%  $875  │
│                                │  AMZN  +0.8%  $192  │
│                                │  AVGO  -0.3%  $168  │
│                                │  MA    -0.1%  $488  │
│                                │  V     +0.3%  $275  │
│                                │  SPGI  +0.8%  $491  │
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

On mobile (≤640px): columns stack vertically, topics grid first.

---

## Components

### `HomeView.jsx`
Root component. Two-column flex layout. Left = `<TopicsGrid>`, right = `<WidgetPanel>`. Receives `topics` prop from App.

### `TopicsGrid.jsx`
- CSS `auto-fill` grid, `minmax(160px, 1fr)`
- Each topic card: name, entry count, last-edited age
- Sorted alphabetically (no topic-level pinning concept yet)
- Click → calls `onSelectTopic(topic)` which sets `selectedTopic` in App and switches to `view = 'browse'`
- Empty state: "No topics yet — create one in the sidebar"

### `WidgetPanel.jsx`
Right column. Renders a hardcoded array of widget components top-to-bottom with consistent gap. Adding a widget = one import + one JSX line.

### `ClockWidget.jsx`
- `useEffect` + `setInterval(1000)` updating a `Date` state
- Displays: `Thu Jun 19 · 10:42 AM` — no seconds (cleaner)
- Clears interval on unmount

### `SearchWidget.jsx`
- Controlled text input, `onKeyDown` Enter → `window.open(url, '_blank')`
- Three engine options hardcoded:
  ```js
  const ENGINES = [
    { label: 'G',   name: 'Google',     url: q => `https://www.google.com/search?q=${encodeURIComponent(q)}&udm=14` },
    { label: 'DDG', name: 'DuckDuckGo', url: q => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
    { label: 'K',   name: 'Kagi',       url: q => `https://kagi.com/search?q=${encodeURIComponent(q)}` },
  ]
  ```
- Selected engine persisted in `localStorage` key `medialog_search_engine`
- Active engine pill highlighted with accent color

### `QuickLinksWidget.jsx`
- Hardcoded:
  ```js
  const LINKS = [
    { label: 'Gmail',    href: 'https://mail.google.com',    icon: 'Mail' },
    { label: 'Calendar', href: 'https://calendar.google.com', icon: 'Calendar' },
  ]
  ```
- Icon + label chips, open new tab, lucide-react icons

### `MarketNewsWidget.jsx`
Single component that fires one edge function call and renders three sections: Market, Trending, Headlines.

**Market section:**
- Hardcoded tickers:
  ```js
  const TICKERS = ['VOO', 'NVDA', 'AMZN', 'AVGO', 'MA', 'V', 'SPGI']
  ```
- Displays: ticker | price | daily change % (green positive, red negative)

**Trending section (WSB/Reddit):**
- Top 5 tickers by mention count from ApeWisdom, filtered to r/wallstreetbets + r/stocks
- Shows: rank | ticker | mention count | 24h change in mentions (↑/↓ %)

**Headlines section:**
- Top 5 headlines from Reuters RSS parsed server-side
- Each headline: bullet + truncated title (max 80 chars) as external link

**Polling:** fetches on mount, refreshes every 5 minutes. Shows "Updated Xm ago" timestamp. Loading = skeleton rows. Error = graceful "unavailable" message per section (one failing doesn't break others).

---

## `market` Supabase Edge Function (`supabase/functions/market/index.ts`)

Accepts POST with `{ tickers: string[] }`. Returns:
```ts
{
  quotes: Array<{ ticker: string, price: number, change: number, changePercent: number }>,
  trending: Array<{ ticker: string, mentions: number, mentionsDelta: number }>,
  headlines: Array<{ title: string, url: string, source: string }>
}
```

**Quotes** — Yahoo Finance unofficial endpoint (no key required):
`https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=1d`
Fetch each ticker sequentially; omit any that fail without failing the whole response.

**Trending** — ApeWisdom (no key required):
`https://apewisdom.io/api/v1.0/filter/all-reddit/page/1`
Returns ranked tickers with `mentions` and `mentions_24h_ago`. Compute delta % from those two fields. Take top 5 results.

**Headlines** — Reuters RSS (no key required):
`https://feeds.reuters.com/reuters/businessNews`
Fetch XML, parse `<item>` elements, extract `<title>` and `<link>`. Return top 5. Pure text parsing, no external library needed in Deno (string split/regex on the XML).

**No secrets required** — all three sources are public endpoints.

**CORS headers** on all responses for browser `invoke()` calls.

---

## Navigation

- New "Home" nav item, first position in sidebar, `Home` icon (lucide-react)
- `view` state gains `'home'` option in App.jsx
- Default view on load changes from `'browse'` to `'home'`
- Clicking a topic card → sets `selectedId` + `setView('browse')`

---

## Data Flow

```
App.jsx
  └── HomeView (view === 'home')
        ├── TopicsGrid       ← topics[] prop (already loaded in App)
        └── WidgetPanel
              ├── ClockWidget         (self-contained)
              ├── SearchWidget        (self-contained, localStorage)
              ├── QuickLinksWidget    (self-contained, hardcoded)
              └── MarketNewsWidget    ← supabase prop for functions.invoke
```

---

## New Files

```
src/components/HomeView.jsx
src/components/TopicsGrid.jsx
src/components/WidgetPanel.jsx
src/components/widgets/ClockWidget.jsx
src/components/widgets/SearchWidget.jsx
src/components/widgets/QuickLinksWidget.jsx
src/components/widgets/MarketNewsWidget.jsx
supabase/functions/market/index.ts
```

## Modified Files

```
src/App.jsx       — add 'home' view, default to 'home', pass topics + onSelectTopic to HomeView
src/styles.css    — HomeView layout, TopicsGrid cards, WidgetPanel, per-widget styles
```

---

## Secrets Required

None. All data sources (Yahoo Finance, ApeWisdom, Reuters RSS) are public endpoints.

---

## Future Widget Ideas (not in this spec)

- Custom quick links editor with icon picker and variable-width chips
- Canvas (UMich) upcoming assignments widget
- TickTick task list integration
- Google Calendar real data (OAuth)
- Browser extension: new tab override pointing to this dashboard
- Weather widget
- Micro-cap screener / mini Bloomberg

# MediaLog Dashboard — Design Spec

**Date:** 2026-06-19
**Status:** Approved

---

## Goal

Replace the "no topic selected" blank state with a personal morning dashboard: topic grid on the left, utility widgets on the right. Makes MediaLog the natural place to open first rather than a browser full of tabs.

---

## Layout

Two-column layout inside the existing `<main>` area. Renders when no topic is selected (Home nav item, default on load).

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
│                                │  VOO  +0.4%  $541   │
│                                │  MSFT +1.2%  $421   │
│                                │  MA   -0.1%  $488   │
│                                │  V    +0.3%  $275   │
│                                │  SPGI +0.8%  $491   │
│                                │                      │
│                                │  NEWS                │
│                                │  · Fed holds rates…  │
│                                │  · SPGI upgrades…    │
│                                │  · Markets open…     │
└────────────────────────────────┴──────────────────────┘
```

On mobile (≤640px): columns stack vertically, topics grid first.

---

## Components

### `HomeView.jsx`
Root component. Two-column flex layout. Left = `<TopicsGrid>`, right = `<WidgetPanel>`. Receives `topics` prop from App.

### `TopicsGrid.jsx`
- CSS `auto-fill` grid, `minmax(160px, 1fr)`
- Each topic card: name, entry count, last-edited age (from `entries.updated_at` max per topic — already available from the topics list)
- Pinned topics (no concept of topic pinning yet — sort alphabetically for now)
- Status tint: use existing `--surface-2` card style, no status tint (topics aren't statused)
- Click → calls `onSelectTopic(topic)` which sets `selectedTopic` in App and switches to browse view
- Empty state: "No topics yet — create one in the sidebar"

### `WidgetPanel.jsx`
Right column. Renders a hardcoded array of widget components top-to-bottom with consistent gap. Adding a widget = one import + one JSX line.

```jsx
// Structure — not final code, illustrative
const WIDGETS = [ClockWidget, SearchWidget, QuickLinksWidget, MarketWidget, NewsWidget]
```

### `ClockWidget.jsx`
- `useEffect` + `setInterval(1000)` updating a `Date` state
- Displays: `Thu Jun 19 · 10:42 AM`
- No seconds (cleaner)
- Clears interval on unmount

### `SearchWidget.jsx`
- Controlled text input, `onKeyDown` Enter → `window.open(url, '_blank')`
- Three engine options, stored in component as a constant array:
  ```js
  const ENGINES = [
    { label: 'G',   name: 'Google',     url: q => `https://www.google.com/search?q=${encodeURIComponent(q)}&udm=14` },
    { label: 'DDG', name: 'DuckDuckGo', url: q => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
    { label: 'K',   name: 'Kagi',       url: q => `https://kagi.com/search?q=${encodeURIComponent(q)}` },
  ]
  ```
- Selected engine stored in `localStorage` key `medialog_search_engine` (persists preference)
- Engine toggle: small pill buttons next to input, active engine highlighted with accent color

### `QuickLinksWidget.jsx`
- Hardcoded links:
  ```js
  const LINKS = [
    { label: 'Gmail',    href: 'https://mail.google.com',          icon: 'Mail' },
    { label: 'Calendar', href: 'https://calendar.google.com',       icon: 'Calendar' },
  ]
  ```
- Renders as a row of icon + label chips, opening in new tab
- Icons from lucide-react

### `MarketWidget.jsx`
- Hardcoded tickers in component file:
  ```js
  const TICKERS = ['VOO', 'MSFT', 'AAPL', 'MA', 'V', 'SPGI']
  ```
- Calls `supabase.functions.invoke('market', { body: { tickers: TICKERS } })` on mount and every 5 minutes
- Shows: ticker | price | daily change % (green if positive, red if negative)
- Loading state: skeleton rows. Error state: "Market data unavailable"
- Last-updated timestamp shown below the list ("Updated 3m ago")

### `NewsWidget.jsx`
- Called in same `market` edge function invocation — returns `{ quotes, news }` to avoid two round-trips
- Shows top 5 headlines: bullet + truncated title (max 80 chars) linking to article URL in new tab
- Loading/error states same pattern as MarketWidget

### `market` Supabase Edge Function (`supabase/functions/market/index.ts`)
- Accepts `{ tickers: string[] }` POST body
- **Quotes:** Yahoo Finance unofficial endpoint: `https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=1d` — no API key required, rate-limit friendly for personal use (6 tickers = 6 sequential fetches, cached 5 min server-side via response headers)
- **News:** NewsAPI.org `https://newsapi.org/v2/top-headlines?category=business&pageSize=5&apiKey={NEWS_API_KEY}` — requires `NEWS_API_KEY` secret set in Supabase dashboard
- Returns: `{ quotes: [{ ticker, price, change, changePercent }], news: [{ title, url }] }`
- CORS headers for browser calls
- Error handling: if Yahoo fails for a ticker, that ticker is omitted (not a fatal error); if NewsAPI fails, `news` returns `[]`

---

## Navigation

- New "Home" nav item added to sidebar, first position, `Home` icon (lucide)
- `view === 'home'` added to App's view state
- Default view on load: `'home'` (currently defaults to browse with no topic selected — change to `'home'`)
- Clicking a topic card in TopicsGrid sets `selectedTopic` and `view = 'browse'`

---

## Data Flow

```
App.jsx
  └── HomeView (view === 'home')
        ├── TopicsGrid  ← receives topics[] prop (already loaded in App)
        └── WidgetPanel
              ├── ClockWidget      (no props — self-contained)
              ├── SearchWidget     (no props — self-contained)
              ├── QuickLinksWidget (no props — hardcoded)
              ├── MarketWidget     ← receives supabase client prop
              └── NewsWidget       ← receives data from MarketWidget via shared fetch (or co-located in one widget)
```

`MarketWidget` and `NewsWidget` can be co-located as `MarketNewsWidget` since they share a single edge function call — one fetch, two display sections.

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
src/App.jsx          — add 'home' view, default to 'home', pass topics to HomeView
src/styles.css       — HomeView layout, TopicsGrid, WidgetPanel, widget styles
```

---

## Secrets Required

- `NEWS_API_KEY` — set in Supabase dashboard → Edge Function secrets. Free tier at newsapi.org (100 req/day, plenty for personal use).

---

## Future Widget Ideas (not in this spec)

- Custom quick links editor with icon picker and variable-width chips
- Canvas (UMich) upcoming assignments
- TickTick task list integration
- Google Calendar real data (OAuth)
- Browser extension: new tab override pointing to this dashboard
- Weather widget
- Daily writing prompt / journal entry quick-add

---

## What This Is Not

- No drag-to-reorder widgets (hardcoded layout)
- No widget config UI (edit the source file)
- No real-time market data (5-min poll is sufficient)
- No Canvas/TickTick/Calendar API integration (quick links only for now)

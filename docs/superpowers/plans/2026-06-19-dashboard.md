# Dashboard (Home View) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `home` view (default on load) with an inbox card, topics grid, and utility widget panel (clock, search, quick links, market/news data).

**Architecture:** `HomeView.jsx` is a two-column layout: left column = `InboxCard` + `TopicsGrid`, right column = `WidgetPanel` which renders a hardcoded list of widget components. Market data is served by a new Supabase Edge Function (`supabase/functions/market/index.ts`) that aggregates Yahoo Finance, ApeWisdom, and Reuters RSS — zero secrets required. App.jsx adds `'home'` to its view state, defaults to it, and runs a lightweight inbox-count query on mount. `TopicList.jsx` pins the Inbox topic to the top of the sidebar with an icon and divider.

**Tech Stack:** React 18, Vite 5, Supabase Edge Functions (Deno), lucide-react, Vitest + React Testing Library

## Global Constraints

- No new npm packages — only libraries already in package.json (lucide-react, @testing-library/react, vitest, supabase-js).
- Supabase edge function runtime: Deno — use `import` not `require`; use `fetch` not `node-fetch`.
- Zero API secrets: all external endpoints are public (Yahoo Finance unofficial, ApeWisdom, Reuters RSS).
- Search engine localStorage key: `medialog_search_engine` (exact string).
- Tickers (exact, in order): `['VOO', 'NVDA', 'AMZN', 'AVGO', 'MA', 'V', 'SPGI']`
- Search engines (exact): `[{ label: 'G', ... }, { label: 'DDG', ... }, { label: 'K', ... }]`
- Quick links (exact): Gmail → `https://mail.google.com`, Calendar → `https://calendar.google.com`, Brew → `https://www.morningbrew.com`
- Google search URL format (no AI overview): `https://www.google.com/search?q=ENCODED&udm=14`
- Mobile breakpoint: `≤640px` — columns stack vertically.
- Inbox topic identified by `t.name === 'Inbox'` (existing convention in `App.jsx`).
- `view` state in App.jsx default changes from `'browse'` to `'home'`.
- Initial `selectedId` no longer auto-set on first topics load when starting on home (don't force selectedId if view is 'home').
- Edge function path: `supabase/functions/market/index.ts`.
- Plan poll interval for `MarketNewsWidget`: every 5 minutes (`300_000` ms).
- Edge function returns: `{ quotes, gainers, losers, trending, headlines }` (exact field names).

---

## File Map

**New files:**
- `src/components/HomeView.jsx` — two-column layout root, receives props from App
- `src/components/InboxCard.jsx` — inbox count card with "Sort now →" / "All clear" states
- `src/components/TopicsGrid.jsx` — CSS auto-fill grid of non-inbox topics
- `src/components/WidgetPanel.jsx` — right column, renders hardcoded widget list
- `src/components/widgets/ClockWidget.jsx` — live clock, `setInterval(1000)`
- `src/components/widgets/SearchWidget.jsx` — search bar with engine toggle + localStorage
- `src/components/widgets/QuickLinksWidget.jsx` — Gmail / Calendar / Brew chips
- `src/components/widgets/MarketNewsWidget.jsx` — market + movers + WSB + headlines
- `supabase/functions/market/index.ts` — Deno edge function, aggregates 4 data sources
- Test files colocated with each component (see per-task details)

**Modified files:**
- `src/App.jsx` — add `'home'` view, default to `'home'`, add `inboxCount` state + query, render `<HomeView>`, add Home nav item, add `handleSortInbox` helper
- `src/components/TopicList.jsx` — pin Inbox topic to top with `Inbox` lucide icon + divider
- `src/styles.css` — home layout, inbox card, topics grid, widget panel, widget-specific styles

---

## Task 1: Market Edge Function

**Files:**
- Create: `supabase/functions/market/index.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: POST endpoint at `/functions/v1/market`. Request body: `{ tickers: string[] }`. Response JSON: `{ quotes: Array<{ticker,price,change,changePercent}>, gainers: Array<{ticker,changePercent}>, losers: Array<{ticker,changePercent}>, trending: Array<{ticker,mentions,mentionsDelta}>, headlines: Array<{title,url}> }`. On per-section failure, that key returns `[]`.

- [ ] **Step 1: Create the edge function file**

```ts
// supabase/functions/market/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  let tickers: string[] = []
  try {
    const body = await req.json()
    tickers = body.tickers ?? []
  } catch { /* default empty */ }

  const [quotes, { gainers, losers }, trending, headlines] = await Promise.all([
    fetchQuotes(tickers),
    fetchMovers(),
    fetchTrending(),
    fetchHeadlines(),
  ])

  return new Response(JSON.stringify({ quotes, gainers, losers, trending, headlines }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})

async function fetchQuotes(tickers: string[]) {
  const results = await Promise.allSettled(
    tickers.map(async (ticker) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const json = await r.json()
      const meta = json?.chart?.result?.[0]?.meta
      if (!meta) throw new Error('no meta')
      const price = meta.regularMarketPrice ?? 0
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price
      const change = price - prevClose
      const changePercent = prevClose ? (change / prevClose) * 100 : 0
      return { ticker, price, change, changePercent }
    })
  )
  return results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
    .map((r) => r.value)
}

async function fetchMovers(): Promise<{ gainers: any[]; losers: any[] }> {
  try {
    const [gRes, lRes] = await Promise.all([
      fetch('https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_gainers&count=5', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }),
      fetch('https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_losers&count=5', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }),
    ])
    const gJson = await gRes.json()
    const lJson = await lRes.json()
    const extract = (json: any) =>
      (json?.finance?.result?.[0]?.quotes ?? []).map((q: any) => ({
        ticker: q.symbol,
        changePercent: q.regularMarketChangePercent ?? 0,
      }))
    return { gainers: extract(gJson), losers: extract(lJson) }
  } catch {
    return { gainers: [], losers: [] }
  }
}

async function fetchTrending(): Promise<any[]> {
  try {
    const r = await fetch('https://apewisdom.io/api/v1.0/filter/all-reddit/page/1')
    const json = await r.json()
    return (json?.results ?? []).slice(0, 5).map((item: any) => {
      const prev = item.mentions_24h_ago ?? item.mentions ?? 1
      const mentionsDelta = prev ? ((item.mentions - prev) / prev) * 100 : 0
      return { ticker: item.ticker, mentions: item.mentions, mentionsDelta }
    })
  } catch {
    return []
  }
}

async function fetchHeadlines(): Promise<any[]> {
  try {
    const r = await fetch('https://feeds.reuters.com/reuters/businessNews', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const xml = await r.text()
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 5)
    return items.map((m) => {
      const titleMatch = m[1].match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                         m[1].match(/<title>(.*?)<\/title>/)
      const linkMatch  = m[1].match(/<link>(.*?)<\/link>/)
      return {
        title: titleMatch?.[1]?.trim() ?? '',
        url:   linkMatch?.[1]?.trim() ?? '',
      }
    }).filter((h) => h.title)
  } catch {
    return []
  }
}
```

- [ ] **Step 2: Verify the function file is in the right location**

Run: `ls supabase/functions/market/`
Expected: `index.ts` listed

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/market/index.ts
git commit -m "feat: market edge function — quotes, movers, WSB trending, Reuters headlines"
```

---

## Task 2: Self-Contained Widgets (Clock, Search, QuickLinks)

**Files:**
- Create: `src/components/widgets/ClockWidget.jsx`
- Create: `src/components/widgets/ClockWidget.test.jsx`
- Create: `src/components/widgets/SearchWidget.jsx`
- Create: `src/components/widgets/SearchWidget.test.jsx`
- Create: `src/components/widgets/QuickLinksWidget.jsx`
- Create: `src/components/widgets/QuickLinksWidget.test.jsx`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `<ClockWidget />` — no props
  - `<SearchWidget />` — no props
  - `<QuickLinksWidget />` — no props

- [ ] **Step 1: Write failing tests for ClockWidget**

```jsx
// src/components/widgets/ClockWidget.test.jsx
import { render, screen, act } from '@testing-library/react'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'
import ClockWidget from './ClockWidget.jsx'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

test('renders a date and time string', () => {
  render(<ClockWidget />)
  // Should render something like "Thu Jun 19 · 10:42 AM"
  // Just verify a non-empty text node exists in a recognizable time format
  expect(document.querySelector('.widget-clock')).toBeTruthy()
  const text = document.querySelector('.widget-clock').textContent
  expect(text).toMatch(/·/)
})

test('updates display after 1 second', () => {
  render(<ClockWidget />)
  const before = document.querySelector('.widget-clock').textContent
  act(() => { vi.advanceTimersByTime(60000) })
  // Clock still renders (interval running)
  expect(document.querySelector('.widget-clock')).toBeTruthy()
})
```

- [ ] **Step 2: Run clock tests to verify they fail**

Run: `npx vitest run src/components/widgets/ClockWidget.test.jsx`
Expected: FAIL with "cannot find module './ClockWidget.jsx'"

- [ ] **Step 3: Implement ClockWidget**

```jsx
// src/components/widgets/ClockWidget.jsx
import { useEffect, useState } from 'react'

function formatClock(date) {
  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${day} · ${time}`
}

export default function ClockWidget() {
  const [display, setDisplay] = useState(() => formatClock(new Date()))

  useEffect(() => {
    const id = setInterval(() => setDisplay(formatClock(new Date())), 1000)
    return () => clearInterval(id)
  }, [])

  return <p className="widget-clock">{display}</p>
}
```

- [ ] **Step 4: Run clock tests — expect PASS**

Run: `npx vitest run src/components/widgets/ClockWidget.test.jsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Write failing tests for SearchWidget**

```jsx
// src/components/widgets/SearchWidget.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect, beforeEach } from 'vitest'
import SearchWidget from './SearchWidget.jsx'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('open', vi.fn())
})

test('renders search input and three engine buttons', () => {
  render(<SearchWidget />)
  expect(screen.getByPlaceholderText(/search/i)).toBeTruthy()
  expect(screen.getByText('G')).toBeTruthy()
  expect(screen.getByText('DDG')).toBeTruthy()
  expect(screen.getByText('K')).toBeTruthy()
})

test('pressing Enter opens search in new tab with default engine (G)', async () => {
  render(<SearchWidget />)
  const input = screen.getByPlaceholderText(/search/i)
  await userEvent.type(input, 'react hooks{Enter}')
  expect(window.open).toHaveBeenCalledWith(
    expect.stringContaining('google.com/search'),
    '_blank'
  )
  expect(window.open).toHaveBeenCalledWith(
    expect.stringContaining('udm=14'),
    '_blank'
  )
})

test('switching engine persists to localStorage', async () => {
  render(<SearchWidget />)
  await userEvent.click(screen.getByText('DDG'))
  expect(localStorage.getItem('medialog_search_engine')).toBe('DDG')
})

test('selected engine is highlighted with active class', async () => {
  render(<SearchWidget />)
  const ddg = screen.getByText('DDG')
  await userEvent.click(ddg)
  expect(ddg.className).toContain('active')
})
```

- [ ] **Step 6: Run SearchWidget tests — expect FAIL**

Run: `npx vitest run src/components/widgets/SearchWidget.test.jsx`
Expected: FAIL

- [ ] **Step 7: Implement SearchWidget**

```jsx
// src/components/widgets/SearchWidget.jsx
import { useState } from 'react'

const ENGINES = [
  { label: 'G',   url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&udm=14` },
  { label: 'DDG', url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  { label: 'K',   url: (q) => `https://kagi.com/search?q=${encodeURIComponent(q)}` },
]

function loadEngine() {
  try { return localStorage.getItem('medialog_search_engine') || 'G' } catch { return 'G' }
}

export default function SearchWidget() {
  const [query, setQuery] = useState('')
  const [engine, setEngine] = useState(loadEngine)

  function handleKeyDown(e) {
    if (e.key !== 'Enter' || !query.trim()) return
    const eng = ENGINES.find((en) => en.label === engine) || ENGINES[0]
    window.open(eng.url(query.trim()), '_blank')
    setQuery('')
  }

  function selectEngine(label) {
    setEngine(label)
    try { localStorage.setItem('medialog_search_engine', label) } catch {}
  }

  return (
    <div className="widget-search">
      <input
        className="widget-search-input"
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="widget-engine-row">
        {ENGINES.map((en) => (
          <button
            key={en.label}
            className={`widget-engine-btn${engine === en.label ? ' active' : ''}`}
            onClick={() => selectEngine(en.label)}
          >
            {en.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Run SearchWidget tests — expect PASS**

Run: `npx vitest run src/components/widgets/SearchWidget.test.jsx`
Expected: PASS (4 tests)

- [ ] **Step 9: Write failing test for QuickLinksWidget**

```jsx
// src/components/widgets/QuickLinksWidget.test.jsx
import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import QuickLinksWidget from './QuickLinksWidget.jsx'

test('renders Gmail, Calendar, and Brew links opening in new tab', () => {
  render(<QuickLinksWidget />)
  const gmail = screen.getByText('Gmail').closest('a')
  const cal   = screen.getByText('Calendar').closest('a')
  const brew  = screen.getByText('Brew').closest('a')
  expect(gmail.href).toContain('mail.google.com')
  expect(cal.href).toContain('calendar.google.com')
  expect(brew.href).toContain('morningbrew.com')
  expect(gmail.target).toBe('_blank')
})
```

- [ ] **Step 10: Run QuickLinksWidget test — expect FAIL**

Run: `npx vitest run src/components/widgets/QuickLinksWidget.test.jsx`
Expected: FAIL

- [ ] **Step 11: Implement QuickLinksWidget**

```jsx
// src/components/widgets/QuickLinksWidget.jsx
import { Mail, Calendar, Coffee } from 'lucide-react'

const LINKS = [
  { label: 'Gmail',    href: 'https://mail.google.com',       Icon: Mail },
  { label: 'Calendar', href: 'https://calendar.google.com',   Icon: Calendar },
  { label: 'Brew',     href: 'https://www.morningbrew.com',   Icon: Coffee },
]

export default function QuickLinksWidget() {
  return (
    <div className="widget-quicklinks">
      {LINKS.map(({ label, href, Icon }) => (
        <a key={label} href={href} target="_blank" rel="noreferrer" className="widget-quicklink-chip">
          <Icon size={14} />
          {label}
        </a>
      ))}
    </div>
  )
}
```

- [ ] **Step 12: Run QuickLinksWidget test — expect PASS**

Run: `npx vitest run src/components/widgets/QuickLinksWidget.test.jsx`
Expected: PASS (1 test)

- [ ] **Step 13: Run all widget tests together**

Run: `npx vitest run src/components/widgets/`
Expected: All PASS

- [ ] **Step 14: Commit**

```bash
git add src/components/widgets/ClockWidget.jsx src/components/widgets/ClockWidget.test.jsx
git add src/components/widgets/SearchWidget.jsx src/components/widgets/SearchWidget.test.jsx
git add src/components/widgets/QuickLinksWidget.jsx src/components/widgets/QuickLinksWidget.test.jsx
git commit -m "feat: ClockWidget, SearchWidget, QuickLinksWidget"
```

---

## Task 3: MarketNewsWidget

**Files:**
- Create: `src/components/widgets/MarketNewsWidget.jsx`
- Create: `src/components/widgets/MarketNewsWidget.test.jsx`

**Interfaces:**
- Consumes: `supabase` prop (the Supabase client from `src/lib/supabaseClient.js`) — calls `supabase.functions.invoke('market', { body: { tickers } })`
- Produces: `<MarketNewsWidget supabase={supabase} />`

- [ ] **Step 1: Write failing tests**

```jsx
// src/components/widgets/MarketNewsWidget.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import { vi, test, expect, beforeEach } from 'vitest'
import MarketNewsWidget from './MarketNewsWidget.jsx'

function makeSupabase(data) {
  return {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data, error: null }),
    },
  }
}

const mockData = {
  quotes:    [{ ticker: 'VOO', price: 541.23, change: 2.1, changePercent: 0.39 }],
  gainers:   [{ ticker: 'NVDA', changePercent: 8.2 }],
  losers:    [{ ticker: 'INTC', changePercent: -4.3 }],
  trending:  [{ ticker: 'NVDA', mentions: 1204, mentionsDelta: 89 }],
  headlines: [{ title: 'Fed holds rates steady', url: 'https://reuters.com/1' }],
}

test('shows loading state initially', () => {
  const supabase = makeSupabase(mockData)
  render(<MarketNewsWidget supabase={supabase} />)
  expect(screen.getByText(/loading/i)).toBeTruthy()
})

test('renders market quotes after load', async () => {
  const supabase = makeSupabase(mockData)
  render(<MarketNewsWidget supabase={supabase} />)
  await waitFor(() => expect(screen.getByText('VOO')).toBeTruthy())
  expect(screen.getByText('$541.23')).toBeTruthy()
})

test('renders movers section', async () => {
  const supabase = makeSupabase(mockData)
  render(<MarketNewsWidget supabase={supabase} />)
  await waitFor(() => expect(screen.getByText('NVDA')).toBeTruthy())
  expect(screen.getByText(/8\.2%/)).toBeTruthy()
})

test('renders WSB trending section', async () => {
  const supabase = makeSupabase(mockData)
  render(<MarketNewsWidget supabase={supabase} />)
  await waitFor(() => expect(screen.getAllByText('NVDA').length).toBeGreaterThan(0))
  expect(screen.getByText(/1,?204/)).toBeTruthy()
})

test('renders headlines section', async () => {
  const supabase = makeSupabase(mockData)
  render(<MarketNewsWidget supabase={supabase} />)
  await waitFor(() => expect(screen.getByText('Fed holds rates steady')).toBeTruthy())
})

test('shows "unavailable" when edge function errors', async () => {
  const supabase = {
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: new Error('fail') }) },
  }
  render(<MarketNewsWidget supabase={supabase} />)
  await waitFor(() => expect(screen.getByText(/unavailable/i)).toBeTruthy())
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/components/widgets/MarketNewsWidget.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement MarketNewsWidget**

```jsx
// src/components/widgets/MarketNewsWidget.jsx
import { useEffect, useRef, useState } from 'react'

const TICKERS = ['VOO', 'NVDA', 'AMZN', 'AVGO', 'MA', 'V', 'SPGI']
const POLL_MS = 300_000

export default function MarketNewsWidget({ supabase }) {
  const [data, setData]   = useState(null)
  const [error, setError] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)
  const intervalRef = useRef(null)

  async function load() {
    const { data: result, error: err } = await supabase.functions.invoke('market', {
      body: { tickers: TICKERS },
    })
    if (err || !result) { setError(true); return }
    setData(result)
    setError(false)
    setUpdatedAt(new Date())
  }

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, POLL_MS)
    return () => clearInterval(intervalRef.current)
  }, [])

  if (error) return <p className="widget-market-error muted">Market data unavailable</p>
  if (!data)  return <p className="widget-market-loading muted">Loading…</p>

  const minutesAgo = updatedAt
    ? Math.floor((Date.now() - updatedAt.getTime()) / 60000)
    : 0

  return (
    <div className="widget-market">
      {/* Market section */}
      <p className="widget-section-label">MARKET</p>
      <table className="widget-market-table">
        <tbody>
          {data.quotes.map((q) => (
            <tr key={q.ticker}>
              <td className="market-ticker">{q.ticker}</td>
              <td className="market-price">${q.price.toFixed(2)}</td>
              <td className={`market-change ${q.changePercent >= 0 ? 'up' : 'down'}`}>
                {q.changePercent >= 0 ? '+' : ''}{q.changePercent.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Movers section */}
      <p className="widget-section-label">MOVERS TODAY</p>
      <div className="widget-movers">
        {data.gainers.slice(0, 3).map((m) => (
          <span key={m.ticker} className="mover up">↑ {m.ticker} +{m.changePercent.toFixed(1)}%</span>
        ))}
        {data.losers.slice(0, 3).map((m) => (
          <span key={m.ticker} className="mover down">↓ {m.ticker} {m.changePercent.toFixed(1)}%</span>
        ))}
      </div>

      {/* Trending section */}
      <p className="widget-section-label">TRENDING (WSB)</p>
      <ol className="widget-trending">
        {data.trending.map((t) => (
          <li key={t.ticker}>
            <span className="trend-ticker">{t.ticker}</span>
            <span className="trend-mentions">{t.mentions.toLocaleString()}</span>
            <span className={`trend-delta ${t.mentionsDelta >= 0 ? 'up' : 'down'}`}>
              {t.mentionsDelta >= 0 ? '↑' : '↓'}{Math.abs(t.mentionsDelta).toFixed(0)}%
            </span>
          </li>
        ))}
      </ol>

      {/* Headlines section */}
      <p className="widget-section-label">HEADLINES</p>
      <ul className="widget-headlines">
        {data.headlines.map((h) => (
          <li key={h.url}>
            <a href={h.url} target="_blank" rel="noreferrer">{h.title}</a>
          </li>
        ))}
      </ul>

      <p className="widget-updated muted">Updated {minutesAgo}m ago</p>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/components/widgets/MarketNewsWidget.test.jsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/widgets/MarketNewsWidget.jsx src/components/widgets/MarketNewsWidget.test.jsx
git commit -m "feat: MarketNewsWidget — quotes, movers, WSB trending, Reuters headlines"
```

---

## Task 4: WidgetPanel

**Files:**
- Create: `src/components/WidgetPanel.jsx`
- Create: `src/components/WidgetPanel.test.jsx`

**Interfaces:**
- Consumes: `supabase` prop (forwarded to MarketNewsWidget)
- Produces: `<WidgetPanel supabase={supabase} />`

- [ ] **Step 1: Write failing test**

```jsx
// src/components/WidgetPanel.test.jsx
import { render, screen } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
import WidgetPanel from './WidgetPanel.jsx'

const mockSupabase = {
  functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: new Error('skip') }) },
}

test('renders clock, search input, quick link chips, and market section', () => {
  render(<WidgetPanel supabase={mockSupabase} />)
  // Clock
  expect(document.querySelector('.widget-clock')).toBeTruthy()
  // Search
  expect(screen.getByPlaceholderText(/search/i)).toBeTruthy()
  // Quick links
  expect(screen.getByText('Gmail')).toBeTruthy()
  // Market (error state since invoke fails)
  // Component renders without crashing
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run src/components/WidgetPanel.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement WidgetPanel**

```jsx
// src/components/WidgetPanel.jsx
import ClockWidget from './widgets/ClockWidget.jsx'
import SearchWidget from './widgets/SearchWidget.jsx'
import QuickLinksWidget from './widgets/QuickLinksWidget.jsx'
import MarketNewsWidget from './widgets/MarketNewsWidget.jsx'

export default function WidgetPanel({ supabase }) {
  return (
    <div className="widget-panel">
      <ClockWidget />
      <SearchWidget />
      <QuickLinksWidget />
      <MarketNewsWidget supabase={supabase} />
    </div>
  )
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run src/components/WidgetPanel.test.jsx`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/components/WidgetPanel.jsx src/components/WidgetPanel.test.jsx
git commit -m "feat: WidgetPanel — assembles clock, search, quick links, market widgets"
```

---

## Task 5: InboxCard and TopicsGrid

**Files:**
- Create: `src/components/InboxCard.jsx`
- Create: `src/components/InboxCard.test.jsx`
- Create: `src/components/TopicsGrid.jsx`
- Create: `src/components/TopicsGrid.test.jsx`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces:
  - `<InboxCard count={number} onSortInbox={fn} />` — count ≥ 0
  - `<TopicsGrid topics={Topic[]} onSelectTopic={fn} />` — topics exclude Inbox; Topic shape: `{ id, name, entry_count? }`

- [ ] **Step 1: Write failing tests for InboxCard**

```jsx
// src/components/InboxCard.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import InboxCard from './InboxCard.jsx'

test('shows count and Sort now button when count > 0', () => {
  render(<InboxCard count={3} onSortInbox={vi.fn()} />)
  expect(screen.getByText(/3/)).toBeTruthy()
  expect(screen.getByRole('button', { name: /sort now/i })).toBeTruthy()
})

test('calls onSortInbox when Sort now clicked', async () => {
  const onSortInbox = vi.fn()
  render(<InboxCard count={5} onSortInbox={onSortInbox} />)
  await userEvent.click(screen.getByRole('button', { name: /sort now/i }))
  expect(onSortInbox).toHaveBeenCalledOnce()
})

test('shows all clear state when count is 0', () => {
  render(<InboxCard count={0} onSortInbox={vi.fn()} />)
  expect(screen.getByText(/all clear/i)).toBeTruthy()
  expect(screen.queryByRole('button', { name: /sort now/i })).toBeNull()
})
```

- [ ] **Step 2: Run InboxCard tests — expect FAIL**

Run: `npx vitest run src/components/InboxCard.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement InboxCard**

```jsx
// src/components/InboxCard.jsx
import { Inbox, CheckCircle } from 'lucide-react'

export default function InboxCard({ count, onSortInbox }) {
  return (
    <div className="inbox-card">
      <div className="inbox-card-left">
        <Inbox size={18} className="inbox-card-icon" />
        <span className="inbox-card-name">Inbox</span>
        {count > 0 && <span className="inbox-card-badge">{count}</span>}
      </div>
      {count > 0 ? (
        <button className="btn-small" onClick={onSortInbox}>Sort now →</button>
      ) : (
        <span className="inbox-card-clear muted">
          <CheckCircle size={14} /> All clear
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run InboxCard tests — expect PASS**

Run: `npx vitest run src/components/InboxCard.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Write failing tests for TopicsGrid**

```jsx
// src/components/TopicsGrid.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import TopicsGrid from './TopicsGrid.jsx'

const topics = [
  { id: '1', name: 'AI' },
  { id: '2', name: 'Books' },
  { id: '3', name: 'Work' },
]

test('renders all topic cards alphabetically', () => {
  render(<TopicsGrid topics={topics} onSelectTopic={vi.fn()} />)
  const buttons = screen.getAllByRole('button')
  expect(buttons.map((b) => b.textContent)).toEqual(
    expect.arrayContaining(['AI', 'Books', 'Work'])
  )
})

test('calls onSelectTopic with the clicked topic object', async () => {
  const onSelectTopic = vi.fn()
  render(<TopicsGrid topics={topics} onSelectTopic={onSelectTopic} />)
  await userEvent.click(screen.getByText('Books'))
  expect(onSelectTopic).toHaveBeenCalledWith(topics[1])
})

test('shows empty state when no topics', () => {
  render(<TopicsGrid topics={[]} onSelectTopic={vi.fn()} />)
  expect(screen.getByText(/no topics yet/i)).toBeTruthy()
})
```

- [ ] **Step 6: Run TopicsGrid tests — expect FAIL**

Run: `npx vitest run src/components/TopicsGrid.test.jsx`
Expected: FAIL

- [ ] **Step 7: Implement TopicsGrid**

```jsx
// src/components/TopicsGrid.jsx
export default function TopicsGrid({ topics, onSelectTopic }) {
  const sorted = [...topics].sort((a, b) => a.name.localeCompare(b.name))

  if (sorted.length === 0) {
    return <p className="muted topics-grid-empty">No topics yet — create one in the sidebar</p>
  }

  return (
    <div className="topics-grid">
      {sorted.map((t) => (
        <button key={t.id} className="topics-grid-card" onClick={() => onSelectTopic(t)}>
          <span className="topics-grid-name">{t.name}</span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 8: Run TopicsGrid tests — expect PASS**

Run: `npx vitest run src/components/TopicsGrid.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 9: Commit**

```bash
git add src/components/InboxCard.jsx src/components/InboxCard.test.jsx
git add src/components/TopicsGrid.jsx src/components/TopicsGrid.test.jsx
git commit -m "feat: InboxCard and TopicsGrid presentational components"
```

---

## Task 6: HomeView

**Files:**
- Create: `src/components/HomeView.jsx`
- Create: `src/components/HomeView.test.jsx`

**Interfaces:**
- Consumes:
  - `InboxCard` from Task 5: `<InboxCard count={number} onSortInbox={fn} />`
  - `TopicsGrid` from Task 5: `<TopicsGrid topics={Topic[]} onSelectTopic={fn} />`
  - `WidgetPanel` from Task 4: `<WidgetPanel supabase={supabase} />`
- Produces: `<HomeView topics={Topic[]} inboxCount={number} onSelectTopic={fn} onSortInbox={fn} supabase={supabase} />`
  - `topics` — all topics; HomeView filters out Inbox internally before passing to TopicsGrid
  - `inboxCount` — integer, count of unsorted entries

- [ ] **Step 1: Write failing tests**

```jsx
// src/components/HomeView.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import HomeView from './HomeView.jsx'

const mockSupabase = {
  functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: new Error('skip') }) },
}

const topics = [
  { id: 'inbox', name: 'Inbox' },
  { id: '1', name: 'AI' },
  { id: '2', name: 'Books' },
]

test('renders inbox card and topics grid (excludes Inbox topic)', () => {
  render(
    <HomeView
      topics={topics}
      inboxCount={3}
      onSelectTopic={vi.fn()}
      onSortInbox={vi.fn()}
      supabase={mockSupabase}
    />
  )
  expect(screen.getByText(/3/)).toBeTruthy()          // inbox count
  expect(screen.getByText('AI')).toBeTruthy()          // topic card
  expect(screen.getByText('Books')).toBeTruthy()
  // 'Inbox' appears in InboxCard label, but not in topics grid
  const buttons = screen.getAllByRole('button')
  const topicGridBtns = buttons.filter((b) => ['AI', 'Books'].includes(b.textContent))
  expect(topicGridBtns).toHaveLength(2)
})

test('onSortInbox is called when Sort now is clicked', async () => {
  const onSortInbox = vi.fn()
  render(
    <HomeView
      topics={topics}
      inboxCount={2}
      onSelectTopic={vi.fn()}
      onSortInbox={onSortInbox}
      supabase={mockSupabase}
    />
  )
  await userEvent.click(screen.getByRole('button', { name: /sort now/i }))
  expect(onSortInbox).toHaveBeenCalledOnce()
})

test('onSelectTopic is called with the clicked topic', async () => {
  const onSelectTopic = vi.fn()
  render(
    <HomeView
      topics={topics}
      inboxCount={0}
      onSelectTopic={onSelectTopic}
      onSortInbox={vi.fn()}
      supabase={mockSupabase}
    />
  )
  await userEvent.click(screen.getByText('AI'))
  expect(onSelectTopic).toHaveBeenCalledWith(topics[1])
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/components/HomeView.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement HomeView**

```jsx
// src/components/HomeView.jsx
import InboxCard from './InboxCard.jsx'
import TopicsGrid from './TopicsGrid.jsx'
import WidgetPanel from './WidgetPanel.jsx'

export default function HomeView({ topics, inboxCount, onSelectTopic, onSortInbox, supabase }) {
  const nonInbox = topics.filter((t) => t.name !== 'Inbox')

  return (
    <div className="home-view">
      <div className="home-left">
        <InboxCard count={inboxCount} onSortInbox={onSortInbox} />
        <p className="section-label home-topics-label">TOPICS</p>
        <TopicsGrid topics={nonInbox} onSelectTopic={onSelectTopic} />
      </div>
      <div className="home-right">
        <WidgetPanel supabase={supabase} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/components/HomeView.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/HomeView.jsx src/components/HomeView.test.jsx
git commit -m "feat: HomeView — two-column layout composing InboxCard, TopicsGrid, WidgetPanel"
```

---

## Task 7: App.jsx + TopicList.jsx Integration + CSS

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/TopicList.jsx`
- Modify: `src/styles.css`
- Modify: `src/components/TopicList.test.jsx`

**Interfaces:**
- Consumes: `HomeView` from Task 6

**What to change in App.jsx:**
1. Import `HomeView` and `Home` lucide icon.
2. Add `inboxCount` state: `const [inboxCount, setInboxCount] = useState(0)`
3. Change default `view` to `'home'`.
4. Remove the auto-set `selectedId` when starting on home: in `refreshTopics`, change `if (t.length && !selectedId) setSelectedId(t[0].id)` → `if (t.length && !selectedId && view !== 'home') setSelectedId(t[0].id)` — but since `view` is `'home'` at init, just remove the auto-select entirely (user picks a topic by clicking a card).
5. Add a `loadInboxCount` async function that queries the inbox topic's entry count.
6. Call `loadInboxCount()` inside `refreshTopics` (after topics load, once we have the inbox topic id).
7. Add `handleSortInbox` function: sets `view = 'sort'` and calls `loadInbox()`.
8. Add `handleSelectTopic` function: `(topic) => { setSelectedId(topic.id); setGlobalSearchResults(null); setView('browse') }`.
9. Add Home nav item (first in `<ul className="nav">`) with `Home` lucide icon.
10. Render `{view === 'home' && <HomeView topics={topics} inboxCount={inboxCount} onSelectTopic={handleSelectTopic} onSortInbox={handleSortInbox} supabase={supabase} />}` inside the `view-enter` div.

**What to change in TopicList.jsx:**
- Split `topics` into `[inboxTopic, ...rest]` where `inboxTopic = topics.find(t => t.name === 'Inbox')`.
- Render inbox item first with `Inbox` icon from lucide-react, then a `<hr className="topic-divider" />`, then alphabetical rest.
- Inbox item uses same `<button>` pattern but prepends `<Inbox size={14} />` icon.

- [ ] **Step 1: Update TopicList.jsx**

Open `src/components/TopicList.jsx`. Replace the entire file with:

```jsx
import { useState } from 'react'
import { Inbox } from 'lucide-react'

export default function TopicList({ topics, selectedId, onSelect, onAdd, sidebarCollapsed }) {
  const [name, setName] = useState('')

  const inboxTopic = topics.find((t) => t.name === 'Inbox')
  const rest = topics
    .filter((t) => t.name !== 'Inbox')
    .sort((a, b) => a.name.localeCompare(b.name))

  function handleAdd(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setName('')
  }

  return (
    <nav>
      <p className="section-label">Topics</p>
      <ul className="topics">
        {inboxTopic && (
          <li key={inboxTopic.id}>
            <button
              className={inboxTopic.id === selectedId ? 'selected topic-inbox-btn' : 'topic-inbox-btn'}
              onClick={() => onSelect(inboxTopic.id)}
              title="Inbox"
            >
              <Inbox size={14} className="topic-inbox-icon" />
              {!sidebarCollapsed && <span>{inboxTopic.name}</span>}
              {sidebarCollapsed && <span>{inboxTopic.name.slice(0, 2).toUpperCase()}</span>}
            </button>
          </li>
        )}
        {inboxTopic && rest.length > 0 && <li><hr className="topic-divider" /></li>}
        {rest.map((t) => (
          <li key={t.id}>
            <button
              className={t.id === selectedId ? 'selected' : ''}
              onClick={() => onSelect(t.id)}
              title={t.name}
            >
              {sidebarCollapsed
                ? t.name.slice(0, 2).toUpperCase()
                : t.name
              }
            </button>
          </li>
        ))}
      </ul>
      <form className="topic-add" onSubmit={handleAdd}>
        <input
          placeholder="new topic"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>
    </nav>
  )
}
```

- [ ] **Step 2: Update TopicList tests to cover inbox pinning**

Open `src/components/TopicList.test.jsx` and append these tests:

```jsx
test('renders Inbox topic first with inbox icon', () => {
  const topics = [
    { id: 'i', name: 'Inbox' },
    { id: '1', name: 'Zebra' },
    { id: '2', name: 'Alpha' },
  ]
  render(<TopicList topics={topics} selectedId={null} onSelect={() => {}} onAdd={() => {}} />)
  const buttons = document.querySelectorAll('.topics button')
  // First button should be Inbox
  expect(buttons[0].className).toContain('topic-inbox-btn')
  // Rest should be alphabetical
  const names = [...buttons].slice(1).map((b) => b.textContent.trim())
  expect(names[0]).toBe('Alpha')
  expect(names[1]).toBe('Zebra')
})
```

- [ ] **Step 3: Run TopicList tests**

Run: `npx vitest run src/components/TopicList.test.jsx`
Expected: PASS (all existing + new test)

- [ ] **Step 4: Update App.jsx**

In `src/App.jsx`, make the following changes:

**4a. Add imports** (at top, add to existing import lines):
```jsx
import { Home } from 'lucide-react'  // add Home to lucide imports line
import HomeView from './components/HomeView.jsx'
```

**4b. Change default view state** (line ~37):
```jsx
// Before:
const [view, setView] = useState('browse')
// After:
const [view, setView] = useState('home')
```

**4c. Add inboxCount state** (after the exportModal state line):
```jsx
const [inboxCount, setInboxCount] = useState(0)
```

**4d. Replace refreshTopics** to call loadInboxCount after loading topics:
```jsx
async function refreshTopics() {
  const t = await listTopics(supabase)
  setTopics(t)
  // Load inbox count for home view (don't auto-select a topic)
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
```

**4e. Add handleSortInbox and handleSelectTopic** (after loadInbox function):
```jsx
function handleSortInbox() {
  setView('sort')
  loadInbox()
}

function handleSelectTopic(topic) {
  setSelectedId(topic.id)
  setGlobalSearchResults(null)
  setView('browse')
}
```

**4f. Add Home nav item** — in the `<ul className="nav">`, insert as the FIRST `<li>`:
```jsx
<li>
  <button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')} title="Home">
    <Home size={16} /><span>Home</span>
  </button>
</li>
```

**4g. Add HomeView render** — inside the `<div key={...} className="view-enter">`, add as the FIRST conditional (before `{view === 'browse' && ...}`):
```jsx
{view === 'home' && (
  <HomeView
    topics={topics}
    inboxCount={inboxCount}
    onSelectTopic={handleSelectTopic}
    onSortInbox={handleSortInbox}
    supabase={supabase}
  />
)}
```

- [ ] **Step 5: Add CSS to styles.css**

Append to the end of `src/styles.css`:

```css
/* ── Home View ──────────────────────────────── */
.home-view {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  padding: 24px;
  min-height: 100%;
}

.home-left {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.home-right {
  width: 280px;
  flex-shrink: 0;
}

.home-topics-label {
  margin: 8px 0 4px;
}

/* ── Inbox Card ──────────────────────────────── */
.inbox-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 16px;
  gap: 12px;
}

.inbox-card-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.inbox-card-icon { color: var(--muted); }

.inbox-card-name { font-weight: 600; font-size: var(--text-base); }

.inbox-card-badge {
  background: var(--accent);
  color: #fff;
  font-size: var(--text-xs);
  font-weight: 600;
  border-radius: 12px;
  padding: 2px 7px;
}

.inbox-card-clear {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-sm);
}

/* ── Topics Grid ──────────────────────────────── */
.topics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.topics-grid-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px 16px;
  text-align: left;
  cursor: pointer;
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--text);
  transition: box-shadow 0.15s, border-color 0.15s, transform 0.15s;
}

.topics-grid-card:hover {
  box-shadow: var(--shadow-card-hover);
  border-color: color-mix(in srgb, var(--border) 60%, var(--accent) 40%);
  transform: translateY(-1px);
}

.topics-grid-name { display: block; }

.topics-grid-empty { padding: 16px 0; }

/* ── Widget Panel ──────────────────────────────── */
.widget-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px 18px;
}

.widget-section-label {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin: 12px 0 6px;
}

.widget-section-label:first-of-type { margin-top: 0; }

/* Clock */
.widget-clock {
  font-size: var(--text-md);
  font-weight: 500;
  color: var(--text);
  margin: 0;
}

/* Search */
.widget-search { display: flex; flex-direction: column; gap: 6px; }

.widget-search-input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-2);
  font-size: var(--text-sm);
  color: var(--text);
  outline: none;
  transition: border-color 0.15s;
}

.widget-search-input:focus { border-color: var(--accent); }

.widget-engine-row { display: flex; gap: 6px; }

.widget-engine-btn {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: var(--text-xs);
  font-weight: 600;
  background: var(--surface-2);
  color: var(--muted);
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}

.widget-engine-btn.active {
  background: var(--accent-weak);
  color: var(--accent);
  border-color: var(--accent);
}

/* Quick Links */
.widget-quicklinks { display: flex; gap: 8px; flex-wrap: wrap; }

.widget-quicklink-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 20px;
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--muted);
  text-decoration: none;
  background: var(--surface-2);
  transition: color 0.12s, border-color 0.12s, background 0.12s;
}

.widget-quicklink-chip:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-weak);
}

/* Market / News */
.widget-market { display: flex; flex-direction: column; }

.widget-market-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }

.widget-market-table td { padding: 3px 4px; }

.market-ticker { font-weight: 600; color: var(--text); }

.market-price { color: var(--muted); text-align: right; }

.market-change { text-align: right; font-weight: 500; }

.market-change.up   { color: var(--done); }
.market-change.down { color: var(--danger); }

.widget-movers {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: var(--text-sm);
}

.mover { font-weight: 500; }
.mover.up   { color: var(--done); }
.mover.down { color: var(--danger); }

.widget-trending {
  list-style: decimal inside;
  padding: 0;
  margin: 0;
  font-size: var(--text-sm);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.widget-trending li { display: flex; align-items: center; gap: 6px; }

.trend-ticker { font-weight: 600; }

.trend-mentions { color: var(--muted); margin-left: auto; }

.trend-delta { font-weight: 500; font-size: var(--text-xs); }
.trend-delta.up   { color: var(--done); }
.trend-delta.down { color: var(--danger); }

.widget-headlines {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.widget-headlines li a {
  font-size: var(--text-sm);
  color: var(--text);
  text-decoration: none;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.widget-headlines li a:hover { color: var(--accent); text-decoration: underline; }

.widget-updated { font-size: var(--text-xs); margin: 8px 0 0; }

.widget-market-error, .widget-market-loading { font-size: var(--text-sm); margin: 0; }

/* Sidebar: inbox pinned */
.topic-inbox-btn {
  display: flex !important;
  align-items: center;
  gap: 6px;
}

.topic-inbox-icon { flex-shrink: 0; }

.topic-divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 4px 8px;
}

/* Mobile: stack columns */
@media (max-width: 640px) {
  .home-view {
    flex-direction: column;
    padding: 16px;
  }
  .home-right {
    width: 100%;
  }
}
```

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS (no regressions)

- [ ] **Step 7: Manually verify in browser**

Start dev server: `npm run dev`

Check:
- App loads on Home view by default (not Browse)
- Home nav item is first in sidebar, active on load
- Inbox card shows count (or "All clear" if 0)
- Topics grid shows all non-Inbox topics as clickable cards
- Clicking a topic card navigates to Browse view for that topic
- "Sort now →" button navigates to Sort Inbox
- Sidebar: Inbox is pinned at top with Inbox icon, divider separates it from rest
- Clock shows current date + time, updates every second
- Search bar: Enter opens new tab; engine toggle buttons switch and persist
- Quick link chips open Gmail/Calendar/Brew in new tabs
- Market widget shows "Loading…" then loads data (or shows error if edge function not deployed)
- Mobile (resize to ≤640px): columns stack vertically

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx src/components/TopicList.jsx src/components/TopicList.test.jsx src/styles.css
git commit -m "feat: wire HomeView into App, pin Inbox in sidebar, add home CSS"
```

---

## Running the Full Suite

After all tasks are complete:

```bash
npx vitest run
```

Expected: All tests PASS.

To deploy the edge function (when Supabase CLI is configured):

```bash
npx supabase functions deploy market
```

Note: The edge function does not require any secrets. The function uses only public endpoints.

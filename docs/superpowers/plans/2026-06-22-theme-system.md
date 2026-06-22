# Theme System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two-axis theming (color palette × visual style mode) applied via CSS custom properties and HTML data attributes, persisted in localStorage with background sync to user_configs.

**Architecture:** `data-theme` and `data-style` attributes on `<html>` drive all visual changes via CSS attribute selectors. A `useTheme` hook (same pattern as other hooks in `src/hooks/`) reads from localStorage synchronously on mount (zero flash), then reconciles with `user_configs` after auth. The Appearance tab in SettingsView renders palette swatches and style mode cards.

**Tech Stack:** CSS custom properties, localStorage, Supabase JS client, React hooks, Vitest

## Global Constraints

- Plain JS/JSX — no TypeScript
- No new npm packages
- Hooks import `supabase` directly from `'../lib/supabaseClient.js'` — not passed as props (existing pattern)
- `npm run build` must pass after every task
- `npm test` must pass after every task
- Commit each task separately with a concise message
- No comments explaining what code does — only non-obvious WHY
- Valid palette ids: `'warm'`, `'catppuccin-mocha'`, `'tokyo-night'`, `'nord'`, `'rose-pine'`
- Valid style ids: `'default'`, `'brutalist'`, `'glass'`
- localStorage key: `'ml_theme'` → `{ palette: string, style: string }`
- `user_configs` column: `theme jsonb default '{"palette":"warm","style":"default"}'`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/0027_user_theme.sql` | Create | Add `theme` jsonb column to user_configs |
| `src/hooks/useTheme.js` | Create | localStorage + DB sync, `<html>` attribute mutation |
| `src/hooks/useTheme.test.js` | Create | Unit tests for hook logic |
| `src/styles.css` | Modify | Add 4 dark palette blocks + 2 style mode blocks |
| `src/App.jsx` | Modify | Call `useTheme()`, pass `setPalette`/`setStyle` to SettingsView |
| `src/components/SettingsView.jsx` | Modify | Add Appearance tab (first tab), swatch UI |

---

## Task 1: useTheme hook + DB migration

**Files:**
- Create: `supabase/migrations/0027_user_theme.sql`
- Create: `src/hooks/useTheme.js`
- Create: `src/hooks/useTheme.test.js`

**Interfaces:**
- Produces: `useTheme()` → `{ palette: string, style: string, setPalette: (id: string) => void, setStyle: (id: string) => void }`

- [ ] **Step 1: Create the migration**

`supabase/migrations/0027_user_theme.sql`:
```sql
alter table user_configs
  add column if not exists theme jsonb default '{"palette":"warm","style":"default"}';
```

- [ ] **Step 2: Write the failing tests**

`src/hooks/useTheme.test.js`:
```js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from './useTheme.js'

const makeSupabase = (dbTheme = null) => ({
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: dbTheme ? { id: 'u1' } : null },
    }),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: dbTheme ? { theme: dbTheme } : null,
    }),
  }),
})

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  delete document.documentElement.dataset.style
})

describe('useTheme', () => {
  it('defaults to warm/default when localStorage is empty', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.palette).toBe('warm')
    expect(result.current.style).toBe('default')
    expect(document.documentElement.dataset.theme).toBe('warm')
    expect(document.documentElement.dataset.style).toBe('default')
  })

  it('reads from localStorage on mount', () => {
    localStorage.setItem('ml_theme', JSON.stringify({ palette: 'nord', style: 'brutalist' }))
    const { result } = renderHook(() => useTheme())
    expect(result.current.palette).toBe('nord')
    expect(result.current.style).toBe('brutalist')
    expect(document.documentElement.dataset.theme).toBe('nord')
    expect(document.documentElement.dataset.style).toBe('brutalist')
  })

  it('ignores corrupt localStorage and falls back to default', () => {
    localStorage.setItem('ml_theme', 'not-json')
    const { result } = renderHook(() => useTheme())
    expect(result.current.palette).toBe('warm')
  })

  it('ignores invalid palette/style values in localStorage', () => {
    localStorage.setItem('ml_theme', JSON.stringify({ palette: 'evil', style: 'hax' }))
    const { result } = renderHook(() => useTheme())
    expect(result.current.palette).toBe('warm')
    expect(result.current.style).toBe('default')
  })

  it('setPalette updates state, html attribute, and localStorage', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setPalette('catppuccin-mocha'))
    expect(result.current.palette).toBe('catppuccin-mocha')
    expect(document.documentElement.dataset.theme).toBe('catppuccin-mocha')
    expect(JSON.parse(localStorage.getItem('ml_theme')).palette).toBe('catppuccin-mocha')
  })

  it('setStyle updates state, html attribute, and localStorage', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setStyle('glass'))
    expect(result.current.style).toBe('glass')
    expect(document.documentElement.dataset.style).toBe('glass')
    expect(JSON.parse(localStorage.getItem('ml_theme')).style).toBe('glass')
  })

  it('setPalette ignores invalid palette ids', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setPalette('invalid'))
    expect(result.current.palette).toBe('warm')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```
npx vitest run src/hooks/useTheme.test.js
```
Expected: FAIL — `useTheme` not found

- [ ] **Step 4: Implement the hook**

`src/hooks/useTheme.js`:
```js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const STORAGE_KEY = 'ml_theme'
const VALID_PALETTES = ['warm', 'catppuccin-mocha', 'tokyo-night', 'nord', 'rose-pine']
const VALID_STYLES = ['default', 'brutalist', 'glass']
const DEFAULT = { palette: 'warm', style: 'default' }

function readLocal() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (VALID_PALETTES.includes(parsed?.palette) && VALID_STYLES.includes(parsed?.style))
      return parsed
  } catch {}
  return null
}

function applyToHtml(palette, style) {
  document.documentElement.dataset.theme = palette
  document.documentElement.dataset.style = style
}

function writeLocal(palette, style) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ palette, style }))
}

async function syncToDb(palette, style) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('user_configs')
      .update({ theme: { palette, style } })
      .eq('user_id', user.id)
  } catch {}
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    const t = readLocal() ?? DEFAULT
    applyToHtml(t.palette, t.style)
    return t
  })

  useEffect(() => {
    async function syncFromDb() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('user_configs')
        .select('theme')
        .eq('user_id', user.id)
        .maybeSingle()
      const db = data?.theme
      if (!db || !VALID_PALETTES.includes(db.palette) || !VALID_STYLES.includes(db.style)) return
      const local = readLocal()
      if (local?.palette !== db.palette || local?.style !== db.style) {
        applyToHtml(db.palette, db.style)
        writeLocal(db.palette, db.style)
        setThemeState({ palette: db.palette, style: db.style })
      }
    }
    syncFromDb()
  }, [])

  function setPalette(p) {
    if (!VALID_PALETTES.includes(p)) return
    const next = { palette: p, style: theme.style }
    applyToHtml(next.palette, next.style)
    writeLocal(next.palette, next.style)
    setThemeState(next)
    syncToDb(next.palette, next.style)
  }

  function setStyle(s) {
    if (!VALID_STYLES.includes(s)) return
    const next = { palette: theme.palette, style: s }
    applyToHtml(next.palette, next.style)
    writeLocal(next.palette, next.style)
    setThemeState(next)
    syncToDb(next.palette, next.style)
  }

  return { palette: theme.palette, style: theme.style, setPalette, setStyle }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```
npx vitest run src/hooks/useTheme.test.js
```
Expected: 7/7 PASS

- [ ] **Step 6: Build check**

```
npm run build
```
Expected: exit 0

- [ ] **Step 7: Commit**

```
git add supabase/migrations/0027_user_theme.sql src/hooks/useTheme.js src/hooks/useTheme.test.js
git commit -m "feat: useTheme hook — localStorage + user_configs sync, html attribute theming"
```

---

## Task 2: CSS theme definitions

Add 4 dark palette blocks and 2 style mode blocks to `src/styles.css`. Append them after the existing `:root` block (around line 42, after the closing `}` of `:root`).

**Files:**
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: existing `:root` CSS variables (--bg, --surface, --surface-2, --surface-3, --border, --text, --muted, --accent, --accent-weak, --done, --active, --backlog, --danger, --sidebar-bg, --radius, --shadow-*)
- Produces: `[data-theme="*"]` and `[data-style="*"]` CSS blocks consumed by the browser when attributes are set on `<html>`

- [ ] **Step 1: Add palette overrides after the `:root` block in `src/styles.css`**

Find the end of the `:root { ... }` block (around line 42) and insert immediately after:

```css
/* ── Palette: Catppuccin Mocha ──────────────────────────────────────────────── */
[data-theme="catppuccin-mocha"] {
  --bg:          #1e1e2e;
  --surface:     #313244;
  --surface-2:   #292a3d;
  --surface-3:   #45475a;
  --border:      #45475a;
  --text:        #cdd6f4;
  --muted:       #a6adc8;
  --accent:      #cba6f7;
  --accent-weak: rgba(203,166,247,0.12);
  --done:        #a6e3a1;
  --active:      #fab387;
  --backlog:     #a6adc8;
  --danger:      #f38ba8;
  --sidebar-bg:  #181825;
}

/* ── Palette: Tokyo Night ───────────────────────────────────────────────────── */
[data-theme="tokyo-night"] {
  --bg:          #1a1b26;
  --surface:     #24283b;
  --surface-2:   #1f2335;
  --surface-3:   #292e42;
  --border:      #292e42;
  --text:        #c0caf5;
  --muted:       #565f89;
  --accent:      #7aa2f7;
  --accent-weak: rgba(122,162,247,0.12);
  --done:        #9ece6a;
  --active:      #ff9e64;
  --backlog:     #565f89;
  --danger:      #f7768e;
  --sidebar-bg:  #16161e;
}

/* ── Palette: Nord ──────────────────────────────────────────────────────────── */
[data-theme="nord"] {
  --bg:          #2e3440;
  --surface:     #3b4252;
  --surface-2:   #343a49;
  --surface-3:   #434c5e;
  --border:      #434c5e;
  --text:        #eceff4;
  --muted:       #7b88a1;
  --accent:      #88c0d0;
  --accent-weak: rgba(136,192,208,0.12);
  --done:        #a3be8c;
  --active:      #d08770;
  --backlog:     #7b88a1;
  --danger:      #bf616a;
  --sidebar-bg:  #292d3a;
}

/* ── Palette: Rosé Pine ─────────────────────────────────────────────────────── */
[data-theme="rose-pine"] {
  --bg:          #191724;
  --surface:     #1f1d2e;
  --surface-2:   #1c1a2a;
  --surface-3:   #26233a;
  --border:      #403d52;
  --text:        #e0def4;
  --muted:       #908caa;
  --accent:      #eb6f92;
  --accent-weak: rgba(235,111,146,0.12);
  --done:        #31748f;
  --active:      #f6c177;
  --backlog:     #908caa;
  --danger:      #eb6f92;
  --sidebar-bg:  #120f1d;
}

/* ── Style: Neobrutalism ────────────────────────────────────────────────────── */
[data-style="brutalist"] {
  --radius:           2px;
  --shadow-card:      none;
  --shadow-card-hover:none;
  --shadow-modal:     4px 4px 0 rgba(0,0,0,0.5);
  --shadow-popover:   3px 3px 0 rgba(0,0,0,0.4);
}
[data-style="brutalist"] .card,
[data-style="brutalist"] .entry-card { border-width: 2px; }
[data-style="brutalist"] input,
[data-style="brutalist"] textarea,
[data-style="brutalist"] select,
[data-style="brutalist"] button      { border-radius: 2px; border-width: 2px; }
[data-style="brutalist"] h1,
[data-style="brutalist"] h2,
[data-style="brutalist"] h3          { font-weight: 800; letter-spacing: -0.5px; }

/* ── Style: Glassmorphism (effective on dark palettes only) ─────────────────── */
[data-style="glass"] .card,
[data-style="glass"] .entry-card {
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
  border-color: transparent;
}
[data-style="glass"] .sidebar {
  background: rgba(0,0,0,0.25);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-right-color: rgba(255,255,255,0.06);
}
[data-style="glass"] input,
[data-style="glass"] textarea,
[data-style="glass"] select {
  background: rgba(255,255,255,0.05);
  border-color: rgba(255,255,255,0.10);
}
[data-style="glass"] button {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.12);
}
[data-style="glass"] button:hover {
  background: rgba(255,255,255,0.14);
}
```

- [ ] **Step 2: Build check**

```
npm run build
```
Expected: exit 0 (CSS is valid)

- [ ] **Step 3: Smoke-test manually**

Run `npm run dev`. Open DevTools console and run:
```js
document.documentElement.dataset.theme = 'catppuccin-mocha'
document.documentElement.dataset.style = 'glass'
```
Expected: app goes dark immediately. Try each palette id. Try `brutalist` style. Try resetting:
```js
document.documentElement.dataset.theme = 'warm'
document.documentElement.dataset.style = 'default'
```

- [ ] **Step 4: Commit**

```
git add src/styles.css
git commit -m "feat: CSS palette and style mode definitions — 4 dark palettes + brutalist + glass"
```

---

## Task 3: Appearance tab + wire useTheme into App.jsx

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/SettingsView.jsx`

**Interfaces:**
- Consumes: `useTheme()` from `'./hooks/useTheme.js'`
- SettingsView receives new props: `themePalette: string`, `themeStyle: string`, `onSetPalette: (id) => void`, `onSetStyle: (id) => void`

- [ ] **Step 1: Wire useTheme into App.jsx**

In `src/App.jsx`, add import after the existing hook imports:
```js
import { useTheme } from './hooks/useTheme.js'
```

Inside the `App` component function, add after the existing hook calls:
```js
const { palette: themePalette, style: themeStyle, setPalette, setStyle } = useTheme()
```

Find the `<SettingsView` JSX (around line 917) and add four props:
```jsx
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
  themePalette={themePalette}
  themeStyle={themeStyle}
  onSetPalette={setPalette}
  onSetStyle={setStyle}
/>
```

- [ ] **Step 2: Add Appearance tab to SettingsView**

In `src/components/SettingsView.jsx`, update the function signature to accept the new props:
```jsx
export default function SettingsView({
  topics, onRefreshData, addToast, allTags, onUpdateTagColor,
  archiveToast, onToggleArchiveToast, trashToast, onToggleTrashToast,
  themePalette, themeStyle, onSetPalette, onSetStyle
}) {
```

In the `TABS` array, add `appearance` as the **first** entry:
```js
const TABS = [
  { id: 'appearance',  label: 'Appearance' },
  { id: 'github',      label: 'GitHub' },
  // ... rest unchanged
]
```

Also change the initial `tab` state to `'appearance'`:
```js
const [tab, setTab] = useState('appearance')
```

- [ ] **Step 3: Add the Appearance tab content**

After the opening `<div className="settings-view">` and before `{tab === 'github' && ...}`, add:

```jsx
{tab === 'appearance' && (
  <section>
    <h2>Appearance</h2>
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      <div>
        <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 13 }}>Color Palette</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { id: 'warm',            name: 'Warm Parchment', bg: '#F8F5EE', accent: '#3D5A4A' },
            { id: 'catppuccin-mocha',name: 'Catppuccin Mocha', bg: '#1e1e2e', accent: '#cba6f7' },
            { id: 'tokyo-night',     name: 'Tokyo Night',    bg: '#1a1b26', accent: '#7aa2f7' },
            { id: 'nord',            name: 'Nord',           bg: '#2e3440', accent: '#88c0d0' },
            { id: 'rose-pine',       name: 'Rosé Pine',      bg: '#191724', accent: '#eb6f92' },
          ].map(({ id, name, bg, accent }) => (
            <button
              key={id}
              title={name}
              onClick={() => onSetPalette(id)}
              style={{
                width: 44, height: 44, borderRadius: '50%', padding: 0, cursor: 'pointer',
                border: themePalette === id ? `3px solid ${accent}` : '2px solid transparent',
                outline: themePalette === id ? `2px solid ${accent}` : 'none',
                outlineOffset: 2,
                background: `conic-gradient(${bg} 0deg 180deg, ${accent} 180deg 360deg)`,
                flexShrink: 0,
              }}
            />
          ))}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)' }}>
          {[
            { id: 'warm', name: 'Warm Parchment' },
            { id: 'catppuccin-mocha', name: 'Catppuccin Mocha' },
            { id: 'tokyo-night', name: 'Tokyo Night' },
            { id: 'nord', name: 'Nord' },
            { id: 'rose-pine', name: 'Rosé Pine' },
          ].find(p => p.id === themePalette)?.name ?? themePalette}
        </p>
      </div>

      <div>
        <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 13 }}>Style</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            {
              id: 'default', name: 'Default',
              preview: (
                <div style={{ width: 64, height: 40, borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', boxShadow: '0 2px 6px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 40, height: 6, borderRadius: 3, background: 'var(--muted)', opacity: 0.5 }} />
                </div>
              ),
            },
            {
              id: 'brutalist', name: 'Neobrutalism',
              preview: (
                <div style={{ width: 64, height: 40, borderRadius: 2, background: 'var(--surface-2)', border: '2px solid var(--text)', boxShadow: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 40, height: 6, borderRadius: 0, background: 'var(--text)', opacity: 0.7 }} />
                </div>
              ),
            },
            {
              id: 'glass', name: 'Glassmorphism',
              preview: (
                <div style={{ width: 64, height: 40, borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 100%)' }} />
                  <div style={{ width: 40, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.3)' }} />
                </div>
              ),
            },
          ].map(({ id, name, preview }) => (
            <button
              key={id}
              title={name}
              onClick={() => onSetStyle(id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                border: themeStyle === id ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: themeStyle === id ? 'var(--accent-weak)' : 'var(--surface)',
                fontSize: 11, color: 'var(--text)', fontWeight: themeStyle === id ? 600 : 400,
              }}
            >
              {preview}
              {name}
            </button>
          ))}
        </div>
        {themeStyle === 'glass' && themePalette === 'warm' && (
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--muted)' }}>
            Glassmorphism is most visible on dark palettes.
          </p>
        )}
      </div>

    </div>
  </section>
)}
```

- [ ] **Step 4: Build check**

```
npm run build
```
Expected: exit 0

- [ ] **Step 5: Run full test suite**

```
npm test
```
Expected: all existing tests still pass (no regressions)

- [ ] **Step 6: Manual smoke test**

Run `npm run dev`. Navigate to Settings → Appearance (should be the first tab). Click each palette swatch — app should restyle instantly. Click each style mode card — borders/shadows should change. Reload the page — theme should persist (read from localStorage). Verify Warm Parchment still looks exactly as it does today when selected.

- [ ] **Step 7: Commit**

```
git add src/App.jsx src/components/SettingsView.jsx
git commit -m "feat: Appearance settings tab — palette swatches and style mode cards"
```

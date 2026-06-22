# Theme System Design

**Goal:** Two-axis theming — color palette × visual style mode — applied via CSS custom properties and HTML attributes, persisted in localStorage with background sync to user_configs.

**Architecture:** `data-theme` and `data-style` attributes on `<html>` drive all visual changes via CSS. No JS re-renders. localStorage provides zero-flash load; `user_configs` syncs across devices.

**Tech Stack:** CSS custom properties, localStorage, Supabase JS (background upsert), React (Settings UI), Supabase migration (one new jsonb column).

---

## Palettes

Five palettes, each a complete redefinition of the CSS custom property set.

| id | Display Name | Character |
|---|---|---|
| `warm` | Warm Parchment *(default)* | Current off-white cream — `#F8F5EE` bg, `#3D5A4A` accent |
| `catppuccin-mocha` | Catppuccin Mocha | Dark `#1e1e2e` bg, `#cba6f7` mauve accent |
| `tokyo-night` | Tokyo Night | Dark `#1a1b26` bg, `#7aa2f7` blue accent |
| `nord` | Nord | Dark `#2e3440` bg, `#88c0d0` frost accent |
| `rose-pine` | Rosé Pine | Dark `#191724` bg, `#eb6f92` rose accent |

`warm` is exactly the current `:root` block — unchanged.

Dark palettes share a common inverted text/surface scheme; only accent colors differ.

## Style Modes

Three modes that modify structural properties only — never color values.

| id | Display Name | What changes |
|---|---|---|
| `default` | Default | Current behavior: `--radius: 10px`, soft shadows, 1px subtle borders |
| `brutalist` | Neobrutalism | `--radius: 2px`, shadows removed, borders `2px solid` at full opacity, headings font-weight 800 |
| `glass` | Glassmorphism | Surfaces use `rgba` + `backdrop-filter: blur(12px)`, inner glow `box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08)`, reduced solid backgrounds |

**Glass constraint:** Glassmorphism is a no-op on the `warm` palette (light backgrounds make blur invisible). When `data-theme="warm"` and `data-style="glass"`, the CSS simply renders as Default. No JS guard needed — the cascade handles it.

## CSS Implementation

Attributes on `<html>`:
```html
<html data-theme="catppuccin-mocha" data-style="glass">
```

Structure in `styles.css`:

```css
/* Base (warm, default style) */
:root { --bg: #F8F5EE; --accent: #3D5A4A; --radius: 10px; ... }

/* Palette overrides */
[data-theme="catppuccin-mocha"] { --bg: #1e1e2e; --accent: #cba6f7; ... }
[data-theme="tokyo-night"]      { --bg: #1a1b26; --accent: #7aa2f7; ... }
[data-theme="nord"]             { --bg: #2e3440; --accent: #88c0d0; ... }
[data-theme="rose-pine"]        { --bg: #191724; --accent: #eb6f92; ... }

/* Style mode overrides */
[data-style="brutalist"] { --radius: 2px; --shadow-card: none; ... }
[data-style="glass"]     { /* surface rgba + backdrop-filter rules */ }
```

Palette and style selectors are independent — specificity is equal, order in file determines which wins for any shared property (palettes before modes; modes override structural props only so there's no conflict).

## Persistence

**localStorage key:** `ml_theme` → `{ "palette": "warm", "style": "default" }`

**DB column:** `user_configs.theme` — `jsonb`, default `'{"palette":"warm","style":"default"}'`

**Migration:** `supabase/migrations/0027_user_theme.sql`
```sql
alter table user_configs add column if not exists theme jsonb default '{"palette":"warm","style":"default"}';
```

**Load sequence (in `App.jsx` or a `useTheme` hook, runs before first render):**
1. Read `ml_theme` from localStorage → apply `data-theme` + `data-style` to `<html>` immediately
2. After auth resolves, fetch `user_configs.theme` from Supabase
3. If DB value differs from localStorage (different device): apply DB value, update localStorage
4. On no localStorage entry: use `{ palette: 'warm', style: 'default' }`, write to localStorage

**On change:**
1. Apply `data-theme` / `data-style` to `<html>` instantly
2. Write to localStorage
3. Fire-and-forget upsert to `user_configs.theme` (no await, no toast)

## Settings UI

New **Appearance** tab added as the first tab in SettingsView's TABS array (id: `'appearance'`, label: `'Appearance'`).

Two swatch rows inside a `.card`:

**Palette swatches** — one circular swatch per palette. Each swatch is a 40px circle split diagonally: top-left = `--bg` color of that palette, bottom-right = `--accent` color. Active palette has a 2px ring in `--accent`. Clicking applies immediately.

**Style mode swatches** — three labeled rectangular cards (~80×50px each) with a representative sketch drawn in pure CSS:
- Default: rounded rectangle with soft shadow
- Neobrutalism: sharp-cornered rectangle with thick border, no shadow
- Glass: rounded rectangle with reduced opacity and blur indicator

Active style has a ring. Clicking applies immediately.

No separate preview pane — the whole app re-renders live on click, so the preview is the app itself.

## Exact CSS Variables to Define Per Dark Palette

Each dark palette must define all variables currently in `:root`:

```
--bg, --surface, --surface-2, --surface-3, --border,
--text, --muted, --accent, --accent-weak,
--done, --active, --backlog, --danger,
--sidebar-bg
```

Shadow variables (`--shadow-card`, `--shadow-modal`, etc.) stay the same across palettes — they're overridden by style modes, not palettes.

## Brutalist Mode — Specific Rules

```css
[data-style="brutalist"] {
  --radius: 2px;
  --shadow-card: none;
  --shadow-card-hover: none;
  --shadow-modal: none;
  --shadow-popover: none;
}
[data-style="brutalist"] .card            { border-width: 2px; }
[data-style="brutalist"] input,
[data-style="brutalist"] textarea,
[data-style="brutalist"] button           { border-width: 2px; border-radius: 2px; }
[data-style="brutalist"] h1,
[data-style="brutalist"] h2,
[data-style="brutalist"] h3              { font-weight: 800; letter-spacing: -0.5px; }
```

## Glass Mode — Specific Rules

Only meaningful on dark palettes. On `warm` palette these rules produce no visible effect (light bg makes blur invisible — intentional, no JS guard needed).

```css
[data-style="glass"] .card {
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
[data-style="glass"] textarea {
  background: rgba(255,255,255,0.05);
  border-color: rgba(255,255,255,0.1);
}
```

## Out of Scope (this spec)

- Theme customizer / theme manager UI (requires new tables + migrations — deferred)
- Per-topic or per-entry theme overrides
- Automatic dark/light switching based on OS preference (can be added later as a palette option)
- More than 5 palettes (add via CSS only when ready)
- Command palette theme switching

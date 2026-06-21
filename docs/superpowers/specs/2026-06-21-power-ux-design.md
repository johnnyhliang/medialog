# MediaLog — Power UX: Command Palette, Keyboard Nav, Recent Searches, Snooze

**Date:** 2026-06-21
**Status:** Approved design — ready for implementation
**Inspired by:** `2026-06-19-tuxedo-analysis.md`

---

## Goal

Shift MediaLog from "app you click through" to "tool you command" — without adding visual complexity or breaking the mobile experience. The personality target is quiet precision (Linear/Raycast) + calm utility (Bear/Obsidian). The furthest it goes toward hacker aesthetic is the command palette itself.

---

## Architecture: Command Registry as Foundation

All keyboard interactions flow through a single command registry. This keeps keybind editing, palette search, and keyboard nav unified rather than scattered across components.

### `src/lib/commands.js`

Exports a function `getCommands(context)` that returns the full command array. `context` contains `{ setView, focusedEntry, cycleStatus, ... }` — whatever handlers need.

Each command:
```js
{
  id: 'nav.inbox',          // stable identifier
  label: 'Go to Inbox',     // shown in palette + settings
  category: 'Navigation',   // groups results in palette and settings
  defaultKey: 'g i',        // default keybind (chord or single key)
  handler: (context) => {}  // what happens on execution
}
```

**Categories:** Navigation, Entry, App

**Command list (initial set):**

| id | label | defaultKey |
|----|-------|------------|
| `app.palette` | Open command palette | `ctrl+k` |
| `nav.inbox` | Go to Inbox | `g i` |
| `nav.explore` | Go to Explore | `g e` |
| `nav.home` | Go to Home | `g h` |
| `nav.trash` | Go to Trash | `g t` |
| `entry.next` | Focus next entry | `j` |
| `entry.prev` | Focus previous entry | `k` |
| `entry.edit` | Edit focused entry | `e` |
| `entry.cycleStatus` | Cycle entry status | `x` |
| `entry.openUrl` | Open entry URL | `o` |
| `entry.snooze` | Snooze focused entry | — |

### `src/lib/keybindings.js`

- Reads user overrides from localStorage key `medialog_keybinds` (`{ commandId → key }`)
- Exports `resolveBindings(commands)` — merges defaults with overrides, returns `{ key → command }` map
- Exports `saveBinding(commandId, key)` and `resetBinding(commandId)`

### Global listener (`App.jsx`)

One `useEffect` at app root:
- Skips if `document.activeElement` is `input`, `textarea`, or has `[data-codemirror]`
- Skips if `navigator.maxTouchPoints > 0` (mobile)
- Two-key chord handling: on first key press, set `pendingKey` ref and a 500ms timeout. If second key arrives in time and forms a valid chord, execute. Otherwise clear.
- Looks up keypress in resolved bindings map and calls `handler(context)`

---

## Command Palette

### `src/components/CommandPalette.jsx`

Rendered at app root level in `App.jsx`, conditionally shown via `paletteOpen` state.

**Visual:** Fixed overlay (not full-screen modal). Centered horizontally, positioned ~25% from top. A contained input + results box, ~500px wide. Background dimmed slightly. No heavy animation — opacity fade in only, instant close.

**Input:** Autofocused on open. Fuzzy filters all commands + topic names simultaneously as user types.

**Results structure:**
- Grouped by category with a small category label
- Each row: command label on left, keybind hint on right (muted, small)
- Topic results show "Go to [Topic Name]" dynamically generated from topics list
- Active selection highlighted with `--accent` background at low opacity

**Interaction:**
- `Ctrl+K` — toggles open/closed
- `Escape` — always closes
- `↑/↓` — move selection
- `Tab / Shift+Tab` — jump between category groups
- `Enter` — execute selected command and close
- Typing — filters results fuzzy

**Topic navigation:** Palette receives `topics` as a prop and generates `nav.topic.[id]` commands dynamically. Typing "ai" shows "Go to AI" if a topic named AI exists.

---

## Keyboard Navigation

Handled entirely through the global listener described above. No per-component keyboard code.

**Entry focus state:** `focusedEntryId` lives in `App.jsx` state, passed down to list components. The focused entry card renders a subtle ring using `outline: 2px solid var(--accent)` at `0.4` opacity. Focus resets when view changes.

**`j/k`:** Moves `focusedEntryId` to the next/previous entry in the current view's rendered list. Requires list components to expose an ordered entry ID array up to `App.jsx` (via callback or context).

**Chords (`g i`, `g e`, `g h`, `g t`):** Implemented with `pendingKey` ref as described above.

**Mobile:** Entire global listener is skipped when `navigator.maxTouchPoints > 0`. No keyboard features on mobile — they simply don't exist rather than being broken.

---

## Recent Searches

### Storage

localStorage key `medialog_recent_searches` — array of strings, max 5, newest first, deduplicated on insert.

On search submit: prepend query, deduplicate, trim to 5, save.

### UI

When the search input is focused and empty, a dropdown appears directly below showing recent queries as small chips. Clicking a chip populates the input and executes the search immediately. Dropdown disappears as soon as the user types. Implemented inline in the search bar component — no new component file needed.

---

## Snooze

### Data

**Migration:** `supabase/migrations/0027_snooze.sql`

```sql
alter table entries add column if not exists surface_after timestamptz;
```

### Filtering

All entry queries in `src/lib/db/entries.js` that return active/backlog entries append:
```js
.or('surface_after.is.null,surface_after.lte.now()')
```

Snoozed entries are invisible in all normal views. They reappear automatically when `surface_after` passes — no cron needed, the filter handles it on next query.

### UI

**Entry card ⋮ menu:** "Snooze" option opens a small inline date picker (`<input type="date">`, no new dependency). Selecting a date sets `surface_after` and closes the picker. Entry disappears from view immediately.

**Snoozed indicator:** A snoozed entry card shows a small clock icon + snooze date in the card metadata row (same line as tags/status). Visible if you navigate directly to a topic where the entry lives, but hidden by the query filter in list views.

**Unsnooze:** Clicking the clock icon clears `surface_after` immediately.

**Palette command:** "Snooze focused entry" command in registry — triggers the date picker on the currently focused entry. Requires `focusedEntry` in context.

---

## Keybinds Settings Tab

New tab "Keybinds" added to `src/components/SettingsView.jsx`.

**Layout:** Commands grouped by category. Each row:
- Command label
- Current keybind (or "—" if unbound)
- "Reset" link (only shown if user has overridden the default)

**Rebinding flow:**
1. Click a keybind cell — cell enters "press any key..." capture mode
2. Next keypress (or chord sequence) is captured as the new binding
3. `Escape` cancels capture without saving
4. If the captured key conflicts with an existing command: show inline warning "Already used by [label]" with Confirm / Cancel options. Confirm reassigns and unbinds the other command.
5. Save to `medialog_keybinds` in localStorage via `saveBinding()`

**Reset all:** Small "Reset all to defaults" link at bottom of tab. Clears `medialog_keybinds` entirely.

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `src/lib/commands.js` | New — command registry |
| `src/lib/keybindings.js` | New — resolve/save/reset bindings |
| `src/components/CommandPalette.jsx` | New |
| `src/App.jsx` | Global listener, `paletteOpen` state, `focusedEntryId` state, palette render |
| `src/lib/db/entries.js` | Add snooze filter to all active/backlog queries |
| `src/components/SettingsView.jsx` | Add Keybinds tab |
| `src/styles.css` | Palette overlay, focused entry ring, snooze indicator, recent search dropdown |
| `supabase/migrations/0027_snooze.sql` | New — `surface_after` column |

---

## Out of Scope

- Saved/named searches (replaced by recent searches)
- Syncing keybinds across devices (localStorage only)
- Mobile keyboard features
- Visual mode / multi-select (`V` mode from tuxedo) — future
- NL capture enhancement — separate feature

# MediaLog — Refactor Curriculum

A sequenced plan for improving this codebase, written so that each step also
explains *why* the code is shaped the way it is. Read top to bottom the first
time; after that, treat it as a checklist.

Written 2026-08-10 against commit `e2422dd`, from five parallel read-only audits
(lint/build, architecture, duplication, correctness, tests). Re-checked
2026-08-11 at `afa7e4f`; the findings still hold. §12 teaches the git you'll
need to do the work safely.

---

## 0. Two corrections before you start

**"There are over 100 linting errors."** There aren't. The real number is
**39 errors + 23 warnings = 62 problems**, spread across 24 files. And:

- **`npm run build` does not run eslint.** `build` is `vite build`, nothing
  else. Lint is a separate `npm run lint`. The build passes today (exit 0), so
  these 62 problems have never blocked anything — which is exactly why they
  accumulated.
- **Zero of the 62 are auto-fixable.** I ran `eslint --fix-dry-run` and the
  error counts came back byte-identical. `--fix` would change nothing. Every
  one of these is a manual edit.

**"I have no idea if it's slop."** It isn't. The audits looked specifically for
the signs of a codebase written against stale knowledge and found essentially
none:

- Supabase v1 patterns: **zero**. The v2 `{ data, error }` tuple is used
  everywhere, and even the subtle one (`sub.subscription.unsubscribe()` in
  `useSession.js:16`) is correct.
- React legacy patterns: **zero**. 294 `.map()` call sites scanned for missing
  `key` props — no genuine hits. No legacy lifecycle shims, no `ReactDOM.render`.
- animejs v3 and lucide-react usage: correct for the installed versions.
- Deprecated browser APIs: exactly one (`navigator.platform`).
- 981 tests across 125 files, all passing, fully offline.

The debt here is **structural, not legacy**. Nothing is out of date; it's that
the app grew faster than its skeleton. Specifically: a 1,557-line `App.jsx`,
no router, no React Context, 32 components issuing raw database queries, and
62 places where a database error is silently discarded. That's a different and
more interesting problem than "slop", and it's what most of this document is
about.

---

## 1. How this codebase actually works

Read this section once. Everything after it assumes you have.

### 1.1 It is a two-page app, not a single-page app

This surprises people, including me at first.

```
index.html  →  src/landing.jsx  →  LandingPage      (marketing + auth)
app.html    →  src/main.jsx     →  App              (the actual product)
```

Vite is configured as an **MPA** — two separate HTML entry points producing two
separate bundles. The landing page does not ship the app's code, and vice versa.
That's why `src/landing.css` has its own frozen palette and can't see the app's
theme tokens: it is a genuinely separate document.

There's also `public/landing.html`, a 775-line static artifact that is *not*
part of either bundle. It's a leftover. Deleting it is on the list (§6).

### 1.2 The theme system

Two independent axes, applied as attributes on `<html>`:

```js
document.documentElement.dataset.theme = 'tokyo-night'   // 5 palettes
document.documentElement.dataset.style = 'brutalist'     // 3 styles
```

CSS then resolves it with attribute selectors:

```css
:root                       { --bg: #F8F5EE; }   /* warm, the default */
[data-theme="tokyo-night"]  { --bg: #1A1B26; }   /* overrides it       */
```

Every component reads `var(--bg)` and never a literal colour, so switching a
palette is one attribute write and zero re-renders. `src/hooks/useTheme.js` owns
this: `VALID_PALETTES`, `VALID_STYLES`, `applyToHtml()`, and persistence to both
`localStorage` (key `ml_theme`) and the `user_configs` table.

**This is why we rejected Tailwind.** Tailwind's model is compile-time utility
classes; runtime theme switching through it means either shipping every palette
as a class variant or reintroducing CSS variables anyway. The current system is
the right one for this app. Don't relitigate it.

### 1.3 The stylesheet layout (recently refactored)

`src/styles.css` used to be one enormous file. It is now a **25-line index of
`@import`s** pointing at `src/styles/*.css`, one file per surface.

The one rule you must respect: **import order is load-bearing.** Much of this
sheet resolves conflicts by source position, not specificity — the dark-palette
overrides in `themes.css` only win because they come after the palettes.
Reordering the imports silently changes rendering. Add new sheets at the end.

Token layering, from `src/styles/tokens.css`:

```
raw palette      --accent: #3D5A4A
semantic alias   --success: var(--tint-green-fg)
component usage  .badge-ok { color: var(--success) }
```

Always add colours at the token layer and reference them downward. Never a hex
literal in a component sheet.

### 1.4 Data flow — and the missing pieces

```
Supabase (32 tables, RLS-scoped)
  ├── src/lib/db/*.js        23 modules, each takes `supabase` as first arg
  └── …and 32 components that skip that layer entirely
        ├── 18 import `supabaseClient` directly
        └── 14 call `.from(...)` on an injected `supabase` prop
```

`src/lib/db/` is a real, well-shaped data layer — it just only covers the
*original* domain (entries, topics, tags). Every feature added since
(applications, opportunities, companies, programs, highlights, attachments)
queries inline from the component. That's the single biggest architectural
inconsistency in the repo.

**There is no React Context anywhere.** Zero `createContext` in 192 source
files. State lives in `App.jsx` and is prop-drilled, with a hand-rolled
memoized prop bundle at `App.jsx:168-184` to keep re-renders down.

**There is no router.** Navigation is:

```js
const [view, setView] = useState('home')      // App.jsx:108
// …and a 23-branch ladder at App.jsx:1251-1473
{view === 'home' && <HomeView … />}
{view === 'explore' && <ExploreView … />}
```

Consequences: the browser back button does not navigate, and no view is
linkable or bookmarkable.

The code-splitting is genuinely good, though — 17 `React.lazy` sites, 14 of them
co-located at `App.jsx:50-80`, one per top-level view.

### 1.5 The backend

27 Deno edge functions in `supabase/functions/`. Eleven are client-invoked; four
run on cron (`fetch-opportunities` hourly, `fetch-programs` daily, `fetch-reels`
every 15 min, `fetch-feeds` every 2 h); `public-share` backs the Vercel `/s/:slug`
route; `send-email` is an auth hook.

These are `.ts` and have **no lint coverage of any kind** — eslint here is
configured for `.js`/`.jsx` only, so the `supabase/functions/**` ignore entry is
redundant. Worth knowing before you assume a green `npm run lint` means the
whole repo is checked.

### 1.6 The convention conflict that matters most

```js
// src/lib/storage.js:53 — the ONLY place in the repo that does this
if (error) throw error
```

Against **22 sites** that swallow and return, and **62 `await supabase…` calls
that never destructure `error` at all**. The practical effect: a query that
fails is indistinguishable from a table that is empty. "Your backlog is empty"
when the request actually 500'd is a wrong answer delivered confidently, and
it's undebuggable from the UI.

Fixing this is §4, and it is the highest-leverage change in this document.

---

## 2. The loop

Every numbered task below runs the same loop. Learn it once.

```
1. Find every occurrence of the pattern      (Grep, with a precise regex)
2. Replace it with the target pattern        (one file at a time)
3. npm test                                  (981 tests, ~26s)
4. Fix straightforward failures              (see triage below)
5. Repeat until tests pass
6. Commit                                    (one coherent unit)
```

**Triage in step 4.** A failing test after a mechanical replacement is one of
three things:

- *The test asserted the old behaviour and the new behaviour is better* → update
  the test, and say so in the commit message.
- *The replacement was wrong* → revert that file, look again.
- *The test was passing by accident* → you found a second bug. Note it, fix it
  separately, don't fold it into this commit.

**Commit discipline** (from `CLAUDE.md`, non-negotiable):

- One complete unit of work per commit — not a snapshot of the working tree.
- `git status` before staging. Stage only files the message describes. Never
  `git add -A`.
- No back-to-back commits minutes apart. If you're about to commit again right
  after the last one, you sliced too thin.
- No `Co-Authored-By` trailers.

As of `afa7e4f` the tree is clean — the practice feature that was in progress
when this was first written has since landed. So there's nothing you need to
avoid staging *today*. That won't stay true: §12.1 shows how to check, and
§12.6 shows what to do when you find someone else's work sitting in your tree.

---

## 3. Phase 1 — Fix the confirmed bugs

> **STATUS 2026-08-24 — this whole section is done.** All six bugs fixed and
> pushed, each with a regression test that was verified to FAIL against the
> unfixed code first. Four corrections to what is written below, kept because
> the reasoning in them outlives the fixes:
>
> - **3.1 was right about ExploreView, wrong about why TopicView shares it.**
>   TopicView's `filtered` was already a `useMemo`; the unstable value was the
>   default prop `pendingArchiveIds = new Set()` sitting in that memo's dep
>   list. Same class of bug, different location. It is also latent, not live:
>   `App` passes a stable Set, so only a caller omitting the prop loops.
> - **3.5 describes two bugs and only one exists.** The cadence guard already
>   clears itself — `autoBackupTimer.current = null` is the first line of the
>   callback. Only the missing unmount cleanup was real.
> - **3.6 undercounts.** Not three hot paths: eight unguarded writes and three
>   unguarded reads. All now route through `src/lib/localPref.js`.
> - **The tests that were supposed to catch 3.6 were vacuous.** `tests/setup.js`
>   replaces `global.localStorage` with a plain object, so `localPref`'s two
>   throwing-storage tests spied on `Storage.prototype` and never threw. They
>   passed against guarded and unguarded code alike.
>
> Still open in this file: §4 error handling, §5 lint, §6 dedupe, §7 dead code,
> §8 structure, and §10 item 5 (the unused-CSS-class sweep).


Start here. These are real defects with traced reproduction paths, and several
cause silent data loss. Nothing else in this document matters if the app is
eating the user's typing.

### 3.1 Infinite render loop in ExploreView — **do this first**  — **DONE 2026-08-24 (`5a9ffb9`)**

`src/components/ExploreView.jsx:156-164` with `src/App.jsx:1278`.

```js
const filtered = displayItems.filter((e) => { … })   // new array every render
useEffect(() => {
  onOrderedIds?.(filtered.map((e) => e.id))
}, [filtered])                                        // …so this always fires
```

`onOrderedIds` is `setOrderedEntryIds` in App. Effect runs → parent setState →
re-render → `filtered` is a *new array object* → `Object.is` fails → effect runs
again. It's called with a fresh array literal each time so React's bail-out never
engages. Dev throws "Maximum update depth exceeded"; prod pegs a core.

**The lesson:** in a dependency array, an array or object literal computed during
render is *never* stable. Depend on a primitive derived from it, or memoize.

```js
const filtered = useMemo(() => displayItems.filter(…), [displayItems, /* real deps */])
const orderedIds = useMemo(() => filtered.map((e) => e.id), [filtered])
const key = orderedIds.join(',')
useEffect(() => { onOrderedIds?.(orderedIds) }, [key])   // eslint-disable orderedIds
```

Also check `TopicView` — `App.jsx:1323` passes the same `onOrderedIds` prop, and
if it builds its list the same way it has the same bug.

### 3.2 Search race — the slower request wins  — **DONE 2026-08-24 (`5a9ffb9`)**

`src/components/ExploreView.jsx:123-151`. The cleanup clears the debounce
*timer*, but a request already in flight is not cancelled. Type `rust`, pause
past the debounce, type ` traits` — if the `rust` request is slower (more rows,
and `annotateEmbedded` adds a second round trip that scales with result count),
it resolves last and writes its results while the box reads `rust traits`.

**The lesson:** clearing a timeout cancels a *pending* call, not an *in-flight*
one. Every async effect needs a cancellation flag. The codebase already has the
correct pattern — copy it verbatim from `src/hooks/useModuleAccess.js:17-31`:

```js
useEffect(() => {
  let cancelled = false
  …
  return () => { cancelled = true; clearTimeout(timerRef.current) }
}, [query, supabase, semanticMode])
```

Guard `setSearchResults`, `setSearching`, and the catch branch.

### 3.3 Topic doc autosave is cancelled, not flushed  — **DONE 2026-08-24 (`4176e48`)**

`src/components/TopicDocEditor.jsx:26-35`. Type, then click another topic within
800 ms. `TopicView` is keyed on `selectedTopic.id` (`App.jsx:1288`), so the
subtree unmounts, cleanup clears the pending save, and it never runs. The
in-memory `topics` state was already updated by `onChange`, so the UI keeps
showing the new text until reload — at which point it's gone. `.catch(() => {})`
on line 31 hides save failures too.

**The lesson:** unmount cleanup for a debounced *write* should flush, not
discard. Cancelling is right for reads; wrong for saves.

```js
const pending = useRef(null)
function flush() {
  const p = pending.current
  if (!p) return
  pending.current = null
  updateTopicDoc(supabase, p.topicId, p.doc).catch((e) => onSaveError?.(e))
}
useEffect(() => () => { clearTimeout(saveTimer.current); flush() }, [])
```

`flush()` works after unmount because it touches no React state. Consider a
`beforeunload` flush for the tab-close case.

### 3.4 Attachment upload clobbers everything typed during the upload  — **DONE 2026-08-24 (`4176e48`)**

`src/components/NoteEditor.jsx:176-189`.

```js
let next = value                        // captured BEFORE any await
for (const file of files) {
  const { url } = await uploadAttachment(supabase, file)   // seconds pass
  next = insertAtCursor(next, …)
}
onChange(next)                          // writes the stale base back
```

Drop a 5 MB image, keep typing while it uploads — the natural thing to do — and
every character typed during the upload is discarded.

**The lesson:** never hold a snapshot of mutable state across an `await`. Use
the functional updater form so the parent applies the change to whatever the
current value is:

```js
onChange((cur) => insertAtCursor(cur, md))
```

If the parent's `onChange` can't take an updater, sync `valueRef.current` in an
effect and read the ref inside the loop.

### 3.5 Auto-backup timer — two bugs from one omission  — **DONE 2026-08-24 (`6436a0c`), one of the two bugs was not real**

`src/App.jsx:301-331`. The effect returns no cleanup, and
`autoBackupTimer.current` is never reset to `null` after firing. So:

- (a) the 60 s timer survives unmount, then queries `user_configs` with a
  possibly signed-out client and calls `addToast` on a dead tree; and
- (b) the `if (autoBackupTimer.current) return` guard stays permanently true, so
  **auto-backup runs exactly once per session** rather than on a cadence.

**The lesson:** an effect that schedules anything must return a cleanup, and a
"is one already scheduled?" ref must be cleared by the thing it scheduled.

### 3.6 Unguarded `localStorage.setItem` in three hot paths  — **DONE 2026-08-24 (`6436a0c`), and it was 8 writes + 3 reads, not 3**

`setItem` **throws** — it doesn't return null — in private-mode Safari and when
the origin's quota is full. `src/lib/localPref.js` says exactly this in its own
header comment. Three sites don't follow it:

| Site | What a throw looks like to the user |
|---|---|
| `ExploreView.jsx:112` | caught by the search `catch` → **"semantic search failed", zero results** |
| `WeatherWidget.jsx:75` | caught by the geocode `catch` → **"city not found"** for a city that resolved fine |
| `useTheme.js:23-25` | thrown from *inside a `setState` updater* — the worst possible place |

**The lesson:** a preference write must never be able to fail the operation it's
attached to. Route all three through `src/lib/localPref.js`.

Note this overlaps the `no-empty` lint cluster in §5 — the same lines. Do §3.6
first and the lint fix falls out of it.

### 3.7 Then the plausibles

Lower confidence, same directory. Handle after the above:

- `useTheme.js:45-64` and `useTimezone.js:46-65` — mount-time DB read with no
  cancellation flag; on a slow connection it can land *after* the user picks a
  palette and revert it. Same `cancelled` pattern as §3.2, plus a guard so the
  DB value only applies if no local choice was made.
- `useTheme.js:66-86` — `writeLocal`/`syncToDb` called *inside* `setThemeState`
  updaters. React may invoke an updater more than once (it does so deliberately
  in StrictMode), producing duplicate `localStorage` writes and duplicate DB
  round trips. **Updaters must be pure**: compute and return the next value; do
  persistence in the handler or a keyed effect.
- `TopicDocEditor.jsx:15` — `initialDoc` in the deps means any `topics` refetch
  during typing resets the buffer. Narrow to `[topicId]`.
- `HomeReviewSummary.jsx:16` — `.eq('name','Inbox').maybeSingle()` with no
  `user_id` filter. RLS is the backstop, but `maybeSingle()` *errors* on more
  than one row, so a user with two "Inbox" topics silently gets zero counts.

**Suggested commits for this phase:** one per bug for §3.1–3.5 (each is a
distinct defect with its own reasoning), one covering all three `localStorage`
sites together (same fix, same rationale), one for the hook-cancellation pair.

---

## 4. Phase 2 — The error-handling sweep

This is the canonical find/replace loop, and the most valuable single change in
the repo.

### 4.1 What's wrong

Three overlapping populations:

- **62 `await supabase…` calls discard `error` entirely.** Worst is
  `src/lib/db/githubBackup.js` (5 occurrences: lines 22, 23, 48, 111, 112), then
  eight files with 4 each.
- **~43 sites** destructure only `data` and then do `data ?? []`, so a failure
  renders as an empty list. Includes `lib/db/retrieval.js:42,85,114,133`,
  `lib/db/entries.js:99`, `App.jsx:255`, and most widgets.
- **~25 unguarded `auth.getUser()` destructures** that drop `error` *and* don't
  handle a null user. Worst is `src/lib/entitlements.js:49`, an inline triple
  dereference.

### 4.2 The replacement

Two small helpers. Write these first, with tests, in their own commit.

```js
// src/lib/db/unwrap.js
export function unwrap({ data, error }, context) {
  if (error) throw new DbError(context, error)
  return data
}

// src/lib/requireUser.js
export async function requireUser(supabase) {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data?.user) throw new Error('Not signed in')
  return data.user
}
```

Then run the loop from §2, **one file per commit**, starting with
`lib/db/githubBackup.js` (densest) and working outward through the `lib/db/`
modules before touching components.

### 4.3 Why one file per commit

Because this sweep will surface real failures that were previously invisible.
A query that always returned `[]` on error now throws, and a test that asserted
the empty case will fail. That failure is *information* — but only if the diff
is small enough to attribute it to. A 62-site commit turns every discovery into
an archaeology problem.

**The lesson, and the reason this is the highest-leverage task here:** silent
failure is worse than loud failure. `data ?? []` reads like defensive
programming and is actually the opposite — it converts "something is broken"
into "there is nothing here", which is a *wrong answer presented with
confidence*. That's the failure mode users can't report and you can't debug.

### 4.4 Interface decision to make before you start

For user-visible lists, `loading | error | empty` are three states, not two.
Decide now whether components render an error state or whether an error bubbles
to a toast — and apply the same answer everywhere. The mess you're cleaning up
exists because that decision was never made once.

---

## 5. Phase 3 — The 62 lint problems

Now, and not before — several of these lines get rewritten by §3 anyway.

Config (`eslint.config.js`, flat config, eslint 10.5.0): `@eslint/js`
recommended + `eslint-plugin-react-hooks` v7 recommended + `react-refresh`.
Two rules deliberately off (`react-refresh/only-export-components`,
`react-hooks/set-state-in-effect`); `react-hooks/exhaustive-deps` downgraded to
warn. Everything else at recommended severity.

| Rule | Count | Severity | Nature |
|---|---|---|---|
| `react-hooks/exhaustive-deps` | 23 | warn | judgment, case by case |
| `no-empty` | 17 | error | trivial, mostly `catch {}` |
| `no-unused-vars` | 12 | error | trivial |
| `react-hooks/refs` | 5 | error | small refactor |
| `react-hooks/purity` | 3 | error | small design call |
| `react-hooks/immutability` | 2 | error | reorder declarations |

Concentration: `App.jsx` 12, `TopicView.jsx` 6, `FeedView.jsx` 5,
`TopicDocEditor.jsx` 5, `OpportunityView.jsx` 4.

### 5.1 The trivial 29 — one commit

`no-unused-vars` (12): dead imports (`fetchTitle` at `App.jsx:27`), unused
`catch (e)` bindings, an unused `data` at `App.jsx:441`. Delete or prefix with
`_` (the config sets `argsIgnorePattern: '^_'`).

`no-empty` (17): almost all `catch {}` around `localStorage`. **Don't just add a
comment to silence the rule** — most of these should be going through
`localPref.js` anyway, per §3.6. Where the swallow is genuinely correct, an
explicit `/* preference write is best-effort */` documents the intent.

### 5.2 `react-hooks/refs` (5) — all in `TopicDocEditor.jsx`

```js
candidatesRef.current = candidates    // line 11, in the render body
```

**The lesson:** the render body must be pure. Mutating a ref during render means
a render that gets thrown away (concurrent rendering does this routinely) leaves
its mutation behind. Move the assignments into a `useEffect`. Line 19 —
`() => candidatesRef.current` closed over during render — is the same problem
one level of indirection out.

Do this at the same time as §3.3, which touches the same file.

### 5.3 `react-hooks/purity` (3) — `Date.now()` in render

`OpportunityView.jsx:208`, `widgets/MarketNewsWidget.jsx:31`,
`widgets/OpportunitiesWidget.jsx:143` — all the identical
`minutesAgo` computation.

**The lesson:** render must be a pure function of props and state. `Date.now()`
makes two renders with identical inputs produce different output, which breaks
memoization and any future concurrent behaviour. The honest fix is a
`useCurrentTime(intervalMs)` hook holding the clock in state — which also
deduplicates all three sites (see §6.2).

### 5.4 `react-hooks/immutability` (2)

`SettingsView.jsx:43` calls `loadConfig()` in an effect declared above the
`function loadConfig()` at line 69; `TopicView.jsx:124` calls
`setTagSuggestLimit` above its `useState` at 127. Both work today by function
hoisting or effect-ordering luck. Move the declarations above their uses and
verify effect order didn't depend on the accident.

### 5.5 `exhaustive-deps` (23) — last, and one file at a time

Every one is a real signal about a stale closure. Blindly adding deps causes
extra renders or effect loops (§3.1 is literally that bug). For each: decide
whether the effect *should* re-run when that value changes. If yes, add it. If
no, restructure so it isn't a dependency — a ref, a `useCallback` at the
definition site, or moving the value inside the effect. Only disable with a
comment explaining why, and only after the other two fail.

Add `npm run lint` to your pre-commit habit once this is clean. Consider wiring
it into CI — it will never stay at zero otherwise.

---

## 6. Phase 4 — Deduplication

10 byte-identical helper pairs plus several near-forks. **Order matters here:**
one group must be reconciled behaviourally before any sweep.

### 6.1 First: the five time formatters that disagree

`timeAgo` ×2 and `formatAge` ×3, with **different wording and different
thresholds**. This is not a mechanical dedupe — picking one changes what some
screens display. Decide the canonical wording and rounding first, write tests
for the boundaries, *then* replace the five call sites. Expect UI test churn and
say so in the commit message.

### 6.2 Then the mechanical ones

Byte-identical, safe to sweep with the §2 loop:

- `passwordStrength` — `LandingPage.jsx:5` / `SetPasswordModal.jsx:4`. Note the
  two files are in **different bundles** (§1.1), so the shared module needs to
  be importable by both; the colour tokens are already mirrored into
  `landing.css`.
- The Escape-key `onKey` handler, identical in three places (`CatchOverlay`,
  `FilePreviewModal`, `Modal`) → extract `useEscapeKey()`.
- `stripInline`, `isUrl`, `formatDate` — duplicated pairs.
- Four URL-host extractors, four slugify modules.
- `useCurrentTime` from §5.3, covering all three `minutesAgo` sites.
- Duplicate `lucide-react` import at `App.jsx:3` and `App.jsx:25`.

### 6.3 The near-fork

`OpportunityView.jsx` ↔ `widgets/OpportunitiesWidget.jsx` share four identical
helpers *plus* duplicated `OppRow`, `markRead`, and `toggleSaved`. This is a
genuine extraction, not a sweep — pull the shared row component and mutations
into one module and have both render it.

Also on the list: the duplicated preference-hook shape (`useTheme` ↔
`useTimezone` — same structure, same bugs from §3.7, extract a
`usePersistedPref`), forked settings tabs, and two parallel spaced-repetition
engines.

---

## 7. Phase 5 — Dead code

Small, satisfying, low risk. One commit.

- `src/components/SearchBar.jsx` — orphaned, no importers.
- `src/lib/db/studyPlan.js` — orphaned.
- **22 verified dead exports.** (An earlier automated pass claimed 116; that was
  a parser artifact and is wrong. 22 is the verified figure.)
- `public/landing.html` — 775 lines, in neither bundle.
- `medialog_settings_tab` — written at `App.jsx:1540`, never read anywhere.
- `navigator.platform` at `PdfViewer.jsx:17` — deprecated, but UA-CH is not a
  drop-in for the Safari check it's doing. Behavioural; handle deliberately or
  leave with a comment.

Then the standardization that isn't strictly dead code but belongs here:
`src/lib/localPref.js` has **5 importers versus 40 raw `localStorage.*Item`
sites**, 8 of which have no try/catch at all. Route them all through the helper.

---

## 8. Phase 6 — The structural work

Everything above is cleanup. This is the part that changes what the codebase can
become. Do it *after* the above, because it's much easier to move code that
doesn't have bugs in it.

### 8.1 Add a router

**The problem:** `const [view, setView] = useState('home')` plus 23 branches of
`view === '…'` at `App.jsx:1251-1473`. Back button doesn't navigate. No view is
linkable, shareable, or bookmarkable. Deep links don't exist.

**Why it's this way:** an app with three views doesn't need a router. This one
has 23. It crossed the line somewhere around view eight and nobody noticed,
because each new `&&` branch cost nothing at the time.

**What to do:** the existing `React.lazy` split is already per-view, so it maps
onto routes almost one-to-one. Note the MPA constraint — the router mounts under
`app.html`, not at the site root, so configure the basename accordingly. Do it
incrementally: introduce the router, migrate views a few at a time, keep the
ladder working for the rest until it's empty.

### 8.2 Introduce Context for the genuinely global values

**The problem:** zero Context in 192 files; everything is prop-drilled from
`App.jsx`, with a memoized prop bundle at `App.jsx:168-184` to keep re-renders
manageable. That bundle is the tell — it's the workaround a Context would have
made unnecessary.

**Don't overcorrect.** Prop drilling is fine and often clearer. Context is for
values that are truly ambient: the `supabase` client, the session, the theme,
the toast dispatcher. Those four, and stop. Application data should keep flowing
as props, and the router will absorb a lot of what's currently drilled anyway.

### 8.3 Extend the `lib/db` layer to cover the newer domains

**The problem:** 32 components issue raw queries. `lib/db/` covers only the
original domain.

**What to do:** it's the same loop as §4 — pick one feature area
(`opportunities`, say), write `lib/db/opportunities.js` with the `unwrap()`
convention from §4, migrate its components, test, commit. Repeat per area. Doing
it *after* §4 means you're moving already-correct error handling rather than
porting the mess.

### 8.4 Split `App.jsx`

Do this **last**. 1,557 lines — 2.1× the next largest file — with 20 `useState`,
9 `useEffect`, 5 `useRef`, 14 custom hooks, a 353-line JSX return, and roughly
eight distinct responsibilities including direct `entries` and `user_configs`
access.

By the time you get here, the router has taken the view ladder, Context has
taken the ambient values, and the db layer has taken the queries. What's left to
extract is much smaller and much more obvious than it looks today. That's the
whole reason this is step four and not step one.

---

## 9. Testing

125 files, 981 tests, all passing, 26s, fully offline. Supabase is mocked via
`tests/helpers/mockSupabase.js` (a thenable query-builder chain) plus per-file
`vi.mock`. No vacuous or assertion-free tests were found. The real test root is
`./tests/` mirroring `src/` — copies under `.claude/worktrees/` are stale, ignore
them.

**Known gaps, in the order they'll bite you:**

- The shared mock covers chained CRUD faithfully but has **no coverage for
  `.auth`, `.storage`, `.rpc`, or `.channel`**. §4's `requireUser()` will need
  `.auth` mocked — extend the helper as part of that phase.
- **5 non-fatal React `act()` warnings** (`EntryCard`, `HomeView` /
  `IndexHealthBanner`). Not failures, but latent flakiness. Worth clearing while
  you're in those files.
- Untested and risky, roughly by exposure: `entitlements.js` and
  `useModuleAccess.js` (access gating — a bug here is a security bug),
  `useSession.js`, `parseMigration.js`, `useTimezone.js`, `keybindings.js`,
  `interviewSeed.js` (373 lines, the largest untested file), `buildZip.js`,
  `feedStarterPack.js`, `gainsStarterMenu.js`, `account.js`, `youtube.js`.

Write tests for a module *when you refactor it*, not as a separate campaign.

---

## 10. Loose ends from the CSS refactor  — **items 1–4 DONE 2026-08-24 (`db11d82`); item 5 still open**

Small, known, not yet done.

1. **Six frozen `rgba()` literals** that are stale copies of themed tokens —
   these render wrong in every non-warm palette today:

   | Location | Literal | Should derive from |
   |---|---|---|
   | `entry-card.css:100` `.card-status-active` | `rgba(184,92,26,0.06)` | `--active` |
   | `entry-card.css:101` `.card-status-done` | `rgba(46,122,82,0.06)` | `--done` |
   | `entry-card.css:715` `.icon-btn-danger:hover` | `rgba(192,58,43,0.08)` | `--danger` |
   | `entry-card.css:720` `.status-done` | `rgba(46,122,82,0.07)` | `--done` |
   | `entry-card.css:721` `.status-active` | `rgba(184,92,26,0.07)` | `--active` |
   | `entry-card.css:735` `.tag-chip:hover` | `rgba(192,58,43,0.1)` | `--danger` |

   Fix: `color-mix(in srgb, var(--done) 7%, transparent)`.

2. **Duplicated scrim** `rgba(28, 26, 21, 0.55)` (the warm `--text`) in
   `files.css:5` and `topic.css:341` → add a `--scrim` token.
3. **`.toast` defined twice** at base level, `feedback.css:56` and `:76` — the
   one genuinely redundant duplicate in the sheet.
4. **`.topics-grid` misplaced** at `interview.css:325`; it belongs in
   `home.css`. Moving it is a cascade change (§1.3), so verify visually.
5. **Never completed:** the unused-CSS-class sweep. Worth doing — grep each
   class name in `styles/` against `.js`/`.jsx` and list the ones with no hits.
   Verify by eye before deleting; some class names are constructed dynamically.

`!important` is rare (10 total, 4 doing real breakpoint work on
`.card-overflow-btn`) and only two hex literals remain outside `tokens.css` /
`themes.css`, one of which is `.embed-youtube { background: #000 }` — correct,
that's a video letterbox.

---

## 11. Suggested order

| # | Phase | Why here |
|---|---|---|
| 1 | §3 bugs | Data loss. Nothing else matters first. |
| 2 | §4 error handling | Highest leverage; makes everything after it debuggable. |
| 3 | §5 lint | Several lines get rewritten by 1–2 anyway. |
| 4 | §6 dedupe | Needs the time-formatter decision made first. |
| 5 | §7 dead code | Easy; shrinks the surface for what follows. |
| 6 | §10 CSS | Independent, do it whenever. |
| 7 | §8 structure | Much easier once the code is correct and deduplicated. |

If you only do two things: **§3.1–3.5 and §4.**

---

## 12. The git you need for this work

Everything below is taught against *this repository's actual state*, not toy
examples. Run the commands as you read — the output will match.

Git has exactly three ideas underneath all of it:

1. **A commit is an immutable snapshot** with a parent pointer. Commits are
   never edited. "Changing" one makes a new commit with a new hash.
2. **A branch is a movable pointer to one commit.** That's the whole data
   structure — a file containing a hash. `master` is not a container of
   commits; it's a sticky note on one commit, and the history is whatever you
   reach by walking parents backwards from there.
3. **`HEAD` is a pointer to a branch** (or, when detached, straight to a
   commit). It answers "where am I."

Almost every "advanced" command is just moving one of those pointers. Once you
see `reset`, `rebase`, `merge`, and `checkout` as *pointer moves plus optional
file-tree updates*, they stop being separate spells.

---

### 12.1 `status` — read it as three buckets, not a wall of text

```bash
git status            # prose
git status --short    # two columns, learn this one
```

`--short` prints two characters per file. **Left column = staged (index).
Right column = unstaged (working tree).**

| Code | Meaning |
|---|---|
| `M ` | modified, staged |
| ` M` | modified, not staged |
| `MM` | staged *and* modified again since staging |
| `A ` | new file, staged |
| `??` | untracked — git doesn't know it exists |
| `UU` | both modified — merge conflict |

Right now this repo prints exactly one line:

```
?? REFACTOR.md
```

The `??` matters: **untracked files are invisible to almost everything.**
`git stash` won't take it, `git diff` won't show it, and switching branches
won't protect it. That's the single most common way to lose work.

The three buckets are working tree → index → commit. The index (a.k.a. the
"staging area") is a real, inspectable middle layer, and it's the thing that
lets you obey the commit rule in §2: stage only what your message describes,
even when your tree contains more than that.

---

### 12.2 `diff` — which two things are you comparing?

`diff` always compares **two** of the three buckets. Being fuzzy about which
pair is why diff output seems to lie.

```bash
git diff                 # working tree  vs  index   ("what I haven't staged")
git diff --staged        # index         vs  HEAD    ("what my commit will contain")
git diff HEAD            # working tree  vs  HEAD    ("everything, staged or not")
```

**Run `git diff --staged` immediately before every commit.** That is literally
the commit you are about to make. It's the mechanical enforcement of the
CLAUDE.md rule about messages describing their contents.

Comparing commits or branches:

```bash
git diff master feat/full-text-hardening      # endpoint-to-endpoint
git diff master...feat/full-text-hardening    # what the BRANCH added
```

That third dot is not cosmetic and it's the thing most people get wrong:

- **`A..B` (two dots)** — "the difference between these two snapshots." Includes
  changes that landed on `A` after the branches split, shown inverted.
- **`A...B` (three dots)** — "changes on B since the common ancestor." Uses the
  merge base as the left side.

Concretely, `origin/main` and `origin/master` here share a merge base at
`d5c1ae8`. `git diff origin/main origin/master` mixes together *both* "what
master added" and "the reverse of what main added." `git diff
origin/main...origin/master` shows only master's 59 commits of work. **When
reviewing a branch, you almost always want three dots.**

Useful narrowings:

```bash
git diff --stat master...feat/full-text-hardening   # file names + churn only
git diff --name-only                                # just paths
git diff -- src/styles/                             # scope to a path
git diff -w                                         # ignore whitespace
```

That last one earns its keep in this repo: the CSS split moved thousands of
lines with re-indentation, and `-w` is what makes "did anything actually
change?" answerable.

---

### 12.3 Inspecting and comparing — before you change anything

```bash
git log --oneline -20
git log --oneline --graph --all -30      # see the branch topology
git show afa7e4f                         # one commit, message + full diff
git show afa7e4f --stat                  # just what it touched
git show afa7e4f:src/styles.css          # a FILE as of that commit
```

That last form is quietly one of the most useful commands in git — read a file
at any point in history without checking anything out or disturbing your tree.

**Counting divergence** is the question you actually want answered most often:

```bash
git rev-list --left-right --count origin/main...origin/master
# → 2   59
```

Two commits exist only on `main`; fifty-nine exist only on `master`. That's not
"main is behind" — it's a **fork**. See §12.5.

**Who wrote this line and why:**

```bash
git log -S "passwordStrength" --oneline    # commits that added/removed the string
git log -p -- src/lib/useTheme.js          # full history of one file
git blame src/components/ExploreView.jsx -L 156,164
```

`git log -S` ("pickaxe") is the right tool for the §6 dedup work: it tells you
which copy of a duplicated helper came first, and therefore which one is the
original and which is the drifted fork.

---

### 12.4 Branch and merge

```bash
git branch -vv --all      # every branch, its position, its upstream
git branch feat/x         # create, don't switch
git switch -c feat/x      # create and switch (modern; `checkout -b` is the old spelling)
git switch -               # back to the previous branch
```

`git branch -vv` in this repo prints markers worth decoding:

```
+ feat/full-text-hardening        738483c (.../.claude/worktrees/agent-a9c8...)
* master                          afa7e4f [origin/master]
  feat/quick-links-starter-topic  c683250
```

- `*` — the branch `HEAD` points at, here.
- **`+` — checked out in a *linked worktree*.** `git worktree list` shows this
  repo has three working directories sharing one `.git`. You **cannot** switch
  to a `+` branch from here; git refuses, because two directories editing one
  branch would corrupt each other's assumptions. This is not an error to work
  around — it's the feature working.
- `[origin/master]` — an upstream is configured. Note `feat/quick-links-starter-topic`
  has no bracket: **no upstream**, so bare `git push` and `git pull` on it will
  fail or guess. §12.5 fixes that.

**Merge vs rebase**, stated once:

- `git merge feat/x` — creates a *merge commit* with two parents. History
  records that a branch existed and when it joined. Never rewrites anything.
- `git rebase master` — *replays* your commits onto a new base, producing new
  commits with new hashes and a straight line. History reads as if you'd
  started from the current tip.

Neither is correct in general. The rule that works: **rebase your own unpushed
branch onto the latest `master` to keep it clean; merge when you're integrating
work that other people or other worktrees already have.** The dividing line is
always *has anyone else seen these commits* — see §12.9.

Fast-forward is worth naming, since it's what usually happens: if `master` has
no commits your branch lacks, "merging" is just sliding the `master` pointer
forward. No merge commit, no new content. `git merge --no-ff` forces the merge
commit anyway when you want the branch's existence recorded.

Conflicts:

```bash
git status                 # the UU files are the conflicts, and that's the todo list
# edit the files, delete the <<<<<<< ======= >>>>>>> markers
git add <file>             # "resolved"
git merge --continue       # or: git rebase --continue
git merge --abort          # bail out entirely, tree restored — always available
```

`--abort` is the important one. A conflicted merge is a *fully reversible*
state. Nothing is committed until you say so.

---

### 12.5 Mismatched remotes, branches, and upstreams

This repo is an excellent worked example, because it's genuinely tangled.

```
remotes/origin/HEAD    -> origin/master
remotes/origin/main    5b04406
remotes/origin/master  afa7e4f
```

**There are two default-sounding branches on the remote and they have
diverged** — 2 commits on `main`, 59 on `master`, common ancestor `d5c1ae8`.
GitHub renamed the default to `main` years ago; this repo predates or resisted
that, and someone at some point pushed twice.

`origin/HEAD -> origin/master` is the tiebreaker: it's a symbolic ref recording
which branch the remote considers default. That's the one that's authoritative
here. `origin/main` is a stale fork with two orphaned commits on it. Before you
delete it, check what those two commits are:

```bash
git log --oneline origin/master..origin/main    # commits on main, not on master
```

If they're worth keeping, cherry-pick them onto `master`; if not, the branch is
safe to retire. Don't leave it — a second plausible default branch is how work
gets pushed into a void.

**Three kinds of "branch" that people conflate:**

| Kind | Example | What it is |
|---|---|---|
| Local | `master` | Your pointer, you move it |
| Remote-tracking | `origin/master` | Your *cache* of where the remote was at last fetch |
| Upstream | `master → origin/master` | A configured link between the two |

`origin/master` never updates on its own. If it looks stale, you haven't
fetched. **`git fetch` is always safe** — it updates remote-tracking refs and
touches nothing else. Get in the habit of `git fetch` then `git status`, rather
than `git pull` (which is fetch + merge, i.e. it changes your files).

Reading the sync state:

```bash
git status -sb
# ## master...origin/master              → in sync
# ## master...origin/master [ahead 3]    → you have unpushed commits
# ## master...origin/master [behind 2]   → fetch brought new work down
# ## master...origin/master [ahead 1, behind 2]  → diverged; see below
```

Right now: `git rev-list --left-right --count master...origin/master` → `0 0`.
Perfectly in sync.

**Diverged** (ahead *and* behind) is the one that traps people. It means you
committed locally while the remote also moved. `git push` will be rejected.
The fix is *not* `--force`:

```bash
git fetch
git rebase origin/master     # replay your commits on top of theirs
git push
```

**Fixing a missing upstream** (`feat/quick-links-starter-topic` needs this):

```bash
git push -u origin feat/quick-links-starter-topic   # push and set upstream in one go
git branch --set-upstream-to=origin/feat/... feat/...   # if it's already pushed
git rev-parse --abbrev-ref @{u}                     # "what is my upstream?" — errors if none
```

`@{u}` is shorthand for "my upstream" and works anywhere a ref does — `git diff
@{u}` means "everything I have that the remote doesn't."

Three branches here exist only on the remote (`feat/ai-infra`,
`feat/editor-versioning`, `feat/opportunity-radar-backend`). To work on one:

```bash
git switch feat/ai-infra    # git infers origin/feat/ai-infra and sets upstream automatically
```

---

### 12.6 Naming conventions — and why this repo is a cautionary tale

Three incompatible schemes are live simultaneously:

```
feat/full-text-hardening              ← human-authored, readable
feat/quick-links-starter-topic
worktree-agent-a54ac9a1c2e3ca0d8      ← tool-generated, opaque
emdash/chore-import-exportbackups-mimplement-4h7   ← mangled
emdash/feat-insert-bypass-permissions-22x
```

The two `emdash/*` branches both point at commit `800e1d9` — **the same
commit**. They're duplicates with mangled names carrying no information, and
neither name survives being read aloud. That's the failure mode: a branch name
is a message to your future self about *why this work exists*, and a name that
can't be read is a branch that will never be cleaned up.

Adopt this, consistently:

```
<type>/<short-kebab-description>

feat/     new capability          feat/router-migration
fix/      bug fix                 fix/explore-render-loop
refactor/ no behaviour change     refactor/error-handling-sweep
chore/    tooling, deps, config   chore/lint-unused-vars
docs/     documentation only      docs/refactor-curriculum
```

Types matter more than they look: `refactor/*` tells a reviewer "the tests
should pass unchanged," which is a completely different review than `feat/*`.
For the work in this document, `fix/explore-render-loop` (§3.1),
`refactor/error-handling-sweep` (§4), `chore/lint-*` (§5) map directly onto the
phases.

Machine-generated names like `worktree-agent-<hash>` are fine *while the
worktree is alive* and should be deleted with it. Check for strays:

```bash
git worktree list
git worktree prune                          # drop records of deleted directories
git branch -d worktree-agent-a54ac9a1c2e3ca0d8   # -d refuses if unmerged; that's the safety
```

---

### 12.7 `stash` — the interrupt handler

You're mid-edit in `ExploreView.jsx` and need to look at `master` right now.

```bash
git stash push -m "explore loop wip"   # ALWAYS -m; an unlabelled stash is a mystery in a week
git stash list
git stash show -p stash@{0}            # inspect without applying
git stash pop                          # apply and delete
git stash apply                        # apply and KEEP (safer when unsure)
git stash drop stash@{0}
```

Two things that bite:

- **`git stash` ignores untracked files by default.** `REFACTOR.md` (`??`)
  would be left sitting in your tree. Use `-u` to include untracked files.
- **`pop` deletes the stash on success.** If applying causes a conflict, the
  stash is *kept*, which is good — but if you resolve badly you can't easily
  redo. `apply` + explicit `drop` gives you a checkpoint.

The stash is a real commit object on a hidden ref, so nothing in it is fragile
— `git fsck --unreachable` can recover even a dropped one. But don't rely on
that; stash is for minutes-to-hours, not days. Work you'd be upset to lose
belongs on a branch:

```bash
git switch -c wip/explore-loop && git commit -am "wip"
```

That's strictly better than a long-lived stash: it has a name, it's visible in
`git branch`, and it survives everything.

---

### 12.8 Changing pointers — `reset`, and the undo net

`git reset` moves your current branch pointer to another commit. The flag
decides how much comes with it:

| Command | Branch pointer | Index | Working tree |
|---|---|---|---|
| `git reset --soft HEAD~1` | moves | **unchanged** | unchanged |
| `git reset HEAD~1` (`--mixed`, default) | moves | reset | unchanged |
| `git reset --hard HEAD~1` | moves | reset | **overwritten — work lost** |

Read that table until it's automatic. `--soft` and `--mixed` **cannot lose
uncommitted work**; `--hard` can and will, silently, with no confirmation.

The `--soft` case is the one you'll use constantly — it's *undo the commit,
keep everything staged exactly as it was*:

```bash
git reset --soft HEAD~1     # uncommit
git reset                   # unstage everything (--mixed, no commit arg)
git add src/styles/*.css    # stage only what belongs
git commit -m "..."         # recommit correctly
```

That exact sequence is how the accidental `git add -A` commit earlier in this
project was repaired without losing a byte. It's the standard fix for "my
commit contains someone else's in-progress work" — the §2 scenario.

Related pointer moves:

```bash
git restore src/App.jsx              # discard unstaged changes to one file (destructive)
git restore --staged src/App.jsx     # unstage one file, keep the edits
git revert afa7e4f                   # NEW commit that undoes an old one — safe on shared history
git checkout afa7e4f                 # detached HEAD: look around, commit nothing
```

`revert` vs `reset` is the shared-history distinction again: `reset` rewrites,
`revert` adds. **On anything you've pushed, use `revert`.**

Ref syntax, so the arguments stop being guesswork:

```
HEAD~1      parent
HEAD~3      three back
HEAD@{2}    where HEAD was two moves ago  (reflog, not history)
@{u}        upstream
master@{yesterday}
```

**The reflog is the safety net that makes all of this recoverable:**

```bash
git reflog
# afa7e4f HEAD@{0}: commit: feat: real tag-color swatches...
# e2422dd HEAD@{1}: reset: moving to HEAD~1
```

Every move of `HEAD` is logged locally for ~90 days, **including moves that
"destroyed" commits**. A bad `reset --hard`, a botched rebase, a deleted
branch — the commits still exist, unreferenced, and the reflog holds their
hashes:

```bash
git reflog                       # find the hash from before the mistake
git reset --hard <that-hash>     # or: git branch rescue <that-hash>
```

The one thing reflog cannot save you from is **work that was never committed**.
`reset --hard` over uncommitted edits, or a `git restore` of a file you'd been
editing for an hour, is gone. Commit early — you can always reshape commits
later (§12.9); you can't reshape what was never recorded.

---

### 12.9 `rebase` and rewriting history

Rebase replays commits onto a new base. `git rebase master` on a feature branch
takes each of your commits, re-applies it on top of `master`'s tip, and produces
**new commits with new hashes**. The old ones become unreferenced (and
reflog-recoverable).

```bash
git switch feat/quick-links-starter-topic
git fetch
git rebase origin/master
# conflicts? fix, git add, git rebase --continue
# panicking?  git rebase --abort      ← always available mid-rebase
```

Why bother: a feature branch rebased onto current `master` produces a clean
linear diff for review, and `git diff master...HEAD` becomes exactly "my work."

**Interactive rebase** is how you clean up before sharing:

```bash
git rebase -i HEAD~5
```

You get an editor listing five commits oldest-first, each with a verb:

```
pick   a1b2c3  refactor: unwrap() helper
squash d4e5f6  fix typo
squash 7g8h9i  fix another typo
reword j1k2l3  wip
drop   m4n5o6  debug logging
```

- `squash` / `fixup` — fold into the previous commit (`fixup` discards the
  message). This turns "one real change plus four typo commits" into one commit.
- `reword` — fix a message.
- `edit` — stop there so you can amend the content.
- `drop` — remove it entirely.
- Reordering the lines reorders the commits.

For the last commit only, `git commit --amend` is the shorthand — and
`--amend --no-edit` when you just forgot to stage a file. Amend is a rewrite
too: new hash, same rules.

**The rule that governs all of it, and it is not negotiable in this project:**

> **Never rewrite history that has been pushed.**

Rewriting produces new hashes. Anyone who already has the old ones — a
teammate, CI, or *your own other worktrees under `.claude/worktrees/`* — now
holds commits that no longer exist upstream, and their next pull produces a
tangle that is genuinely painful to unpick. This repo has three working
directories sharing one object store; that risk is concrete, not theoretical.

Practical boundary:

- **Unpushed local commits** → rebase, squash, amend freely. That's the point
  of them.
- **Pushed anywhere** → `git revert`, or a new commit on top. Never `--force`.

If you are ever *certain* you must force-push a branch only you have:

```bash
git push --force-with-lease
```

`--force-with-lease` refuses if the remote moved since your last fetch — i.e.
if someone else pushed, it aborts instead of destroying their work. Plain
`--force` doesn't check. There is no situation in this repo where plain
`--force` is the right command.

---

### 12.10 A working routine

Starting a task from this document:

```bash
git fetch
git status --short                  # tree clean?
git switch master && git pull
git switch -c fix/explore-render-loop
```

Before each commit:

```bash
git status --short                  # what exists
git add <specific paths>            # never -A
git diff --staged                   # read the actual commit
npm test
git commit -m "fix: ..."
```

Before opening a PR:

```bash
git fetch && git rebase origin/master
git diff origin/master...HEAD --stat    # three dots — exactly what you're proposing
npm test && npm run lint
git push -u origin fix/explore-render-loop
```

When something goes wrong: **`git reflog` first, panic never.** Almost nothing
committed is unrecoverable. Almost nothing uncommitted is.

---

## Appendix — commands

```bash
npm run dev          # vite
npm run build        # vite build only — does NOT lint
npm test             # vitest run — 981 tests, ~26s
npm run test:watch
npm run lint         # eslint . — 39 errors, 23 warnings, 0 auto-fixable
```

```bash
git status --short                            # two columns: staged | unstaged
git diff --staged                             # the commit you're about to make
git diff origin/master...HEAD                 # three dots = what your branch adds
git branch -vv --all                          # positions, upstreams, worktree markers
git rev-list --left-right --count A...B       # divergence, as two numbers
git reflog                                    # the undo net
git rebase --abort / git merge --abort        # always available mid-conflict
```

Full audit reports (lint, architecture, duplication, bugs, tests) live in this
session's scratchpad as `audit-*.md`.

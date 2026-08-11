# Tech Debt & Bug Log

Known problems, ranked by what would actually hurt. Distinct from `IDEAS.md`
(future features) and `CHANGELOG.md` (what shipped) — this is the list of things
already wrong.

Nothing here is blocking today's single-user operation. Most items are labelled
"fine for one user, not fine when it isn't," which is precisely why they need to
be written down before that changes.

---

## Bugs / verification gaps

### ⚠️ TOP PRIORITY — Deno `npm:` resolution in `enrich` is unverified
`supabase/functions/enrich/index.ts` imports `npm:@mozilla/readability@0.6.0` and
`npm:linkedom@0.18.13`. These have **never resolved at runtime** — `deno` isn't
installed locally, so the specifiers are typed-correct but untested.

Mitigated, not assumed: both imports are lazy and wrapped in try/catch, so a
resolution failure logs and falls back to the old regex heuristic rather than
breaking capture. The failure mode is therefore "silently worse extraction," which
is the dangerous kind — it won't page you, it'll just quietly stop preserving
articles well.

**Deployed 2026-07-29, still unverified.** An unauthenticated probe returns a clean
JSON 401, which confirms the function boots and its auth gate works — but proves
nothing about the imports, because they resolve *lazily inside the handler*, after
the auth check returns. Verification requires one authenticated capture.

**The check:** capture any article in the app, then

```sql
select url, full_text_extractor, full_text_status, length(full_text)
from entries where full_text_at > now() - interval '10 minutes';
```

`full_text_extractor = 'readability'` means it works. `'heuristic'` means the
`npm:` specifiers failed to resolve and it silently fell back — which is the whole
reason this is top priority: nothing errors, the quality just quietly drops.

**Update 2026-07-30 — the extraction logic is verified; only the Deno runtime path
is not.** Run against live pages through the exact production code path
(`makeReadabilityParser` + `extractArticle`, real Readability + linkedom):

```
readability   60000 chars   paulgraham.com/greatwork.html
heuristic      8764 chars   danluu.com                  <- correct: a link index
none              0 chars   danluu.com/productivity/    <- correct: a 404
```

**Use prose articles to verify.** A first attempt read a single heuristic capture
of danluu.com as proof the deploy was broken, and it was nothing of the kind —
Readability is *supposed* to decline a link index. `scripts/check-preservation.js`
now reports INCONCLUSIVE for that case instead of FALLING BACK (`a7430b7`), but the
underlying lesson stands: **one sample of a non-article can never be evidence
either way.** Capture 2–3 blog posts or news pieces, then run the script.

### Opportunities only ever fetches GitHub — Twitter/HN/careers are dead code

Found 2026-08-11, while explaining "does the Twitter feed actually work" to a
direct question. It does not, and never has since it was written.

`supabase/functions/fetch-opportunities/index.ts` calls exactly one source:

```ts
const github = await fetchGithub().catch(() => [] as Opportunity[])
const filtered: Opportunity[] = github
```

`twitter.ts` (a real scraper with quality filters — emoji count, account age,
follower threshold), `hn.ts`, and `careers.ts` all exist, are never imported
by `index.ts`, and are never called. Settings still has a full "Twitter / X
Auth Token" tab that saves a cookie to `user_configs` — the save works, but
nothing ever reads that token to make a request. Every row in Opportunities
today is `source: 'github'`; the `SOURCE_COLORS`/`FILTERS` UI treating
`twitter`/`hn` as live options is describing a feature that was built and
never finished being wired in.

**Same root-cause class as `goals.js` / `DeadlineAlertBanner` / `window_open`
/ the `programs` RLS gap** — the fifth instance of this codebase building a
mechanism and stopping one wire short of it doing anything. Not fixed here;
recorded so the next person (or session) doesn't assume Twitter/HN coverage
exists because the Settings tab and UI chips imply it does. Wiring it in is
small if it's ever wanted — add `fetchTwitter`/others to the
`Promise.allSettled` merge in `index.ts` and redeploy the function.

---

## Reported UX problems — untriaged

Captured from use on 2026-07-30, moved here 2026-07-31 from a raw note block at the
top of `PROJECT-STATE.md`, which is regenerated-and-overwritten and would have
deleted them. **None have been reproduced or root-caused yet** — these are reports,
not diagnoses. Verify before fixing.

1. **AI search runs retrieval on every prompt.** It shouldn't have to, unless the
   prompt actually asks for something from the library. Cheap wins here: fewer
   embed calls per chat turn, faster replies.
2. ~~**Deleting a past AI conversation has no confirm.**~~ — **FIXED 2026-07-31.**
   Now routed through the existing `ConfirmModal`, naming the thread in the prompt
   (a bare "Are you sure?" gives no way to notice the wrong row's button was hit —
   the trash icon sits inside the row you click to open a conversation).
3. ~~**The export button pulls up the export UI on click.**~~ — **FIXED
   2026-07-31.** Export downloads directly. The modal it opened showed a size
   estimate that cost **a full extra `entries` scan** to compute, in service of a
   choice the user had already made by clicking Export. `ExportModal.jsx` and
   `useExport.js` are deleted; the attachments caveat moved into the success toast.
4. **Everything is very slow to load, including the Metrics page.**

   **First measurements, 2026-08-06** (`vite build`, production output). Not a
   diagnosis yet — nothing has been profiled in a browser — but the shape supports
   the "one shared cause" hypothesis rather than seven separate slow views:

   | Asset | Size |
   |---|---|
   | `app-*.js` | **1,142 KB** |
   | `supabaseClient-*.js` | 346 KB |
   | `app-*.css` | 126 KB |
   | next three chunks | 101 / 95 / 69 KB |

   **~1.5 MB of JavaScript parses before anything renders.** That would explain why
   *Metrics is slow too* — Metrics is lazily loaded and small, so if it feels slow,
   the cost is the shell it loads into, not the view. Vite already warns that
   chunks exceed 500 KB.

   Two more candidates found while looking, neither confirmed as a cause:
   **`EntryCard` is not memoised** (~700 lines, one per entry, and the CS topic has
   400+), and **`App.jsx` runs 10 `useEffect`s on mount**, several issuing their own
   queries.

   **Still measure in a browser first.** Bundle size is the loudest number, not
   necessarily the felt one — a waterfall of sequential queries on mount can hurt
   more than parse time, and these are testable apart. Original report follows.

   Broad enough
   that it needs measurement before a fix; Metrics being slow too suggests it is
   not one heavy view but something shared (initial query fan-out, bundle size, or
   an unbatched round trip per surface).
5. ~~**Settings has no save affordance for some tabs** (Programs doesn't stick).~~ —
   **FIXED 2026-07-31, and it was not a missing button.** Programs *does* save on
   change; what was broken is that `ProgramsTab`, `CompaniesTab` and `KeywordsTab`
   all updated local state optimistically and **never checked the write's error**.
   A rejected update left the row looking saved until a reload silently reverted
   it — indistinguishable from "there's no save button." All three now surface the
   failure and re-read from the server.

   **Rolling back to a remembered previous value is not sufficient**, which the
   first attempt got wrong: a date field fires a change per keystroke, so each call
   captures the *previous optimistic* value as its rollback target and undoes only
   the last keystroke. Re-reading is the only thing that reliably makes the UI match
   the database.

   Two things found while in there: `ALL_TABS` was referenced in `SettingsView.jsx`
   and **does not exist** — a `ReferenceError` that fired the moment any settings
   *search result* rendered (now `SETTINGS_TABS`); and `ProgramsTab`'s `notes` field
   was in the form state and the insert but had **no input**, so it was written as
   null every time. Every existing test for these tabs mocked `error: null`, so the
   entire failure path had no coverage — that is why this survived.

   **The first pass at this was incomplete.** It fixed writes that *failed*, but the
   report was also about state not surviving navigation, which is a different fault
   with two more causes, both fixed 2026-08-02:

   - **`useArchiveToast` never persisted at all** — a bare `useState(true)`, no
     write anywhere. Turning the archive toast off lasted until the next reload and
     then silently came back. Its three siblings (trash toast, assistant, theme)
     were all persisted, and that inconsistency is exactly what made it read as
     "settings don't save" rather than as one missing write.
   - **The settings tab reset to Appearance on every visit.** `SettingsView`
     unmounts when you navigate away, and `tab` was plain `useState('appearance')`,
     so returning always dropped you on a different tab from the one you had been
     editing — indistinguishable from your changes having been discarded.

   Both now go through `src/lib/localPref.js`, which replaces four hand-rolled
   `try/catch` localStorage blocks. `readBoolPref` keeps **absent** distinct from
   **`'false'`**, so a preference nobody has touched takes the caller's default
   instead of silently reading as off.

   **Why the existing tests missed it:** `useArchiveToast.test.js` asserted the
   setter updates the value, which passes whether or not anything is persisted,
   because the test never remounted the hook. The suite had no reload. It does now.
6. **Topic-scoped search is implicit and unclear.** Searching inside a topic
   silently excludes everything outside it, with no visible indication of scope or
   way to widen. Needs design, not a patch.
7. **Feed sort resets instead of sticking.** Clicking through to a writer or source
   should keep the sort pinned to that source rather than reverting to the
   generalized ordering — reset only on returning to a home/overview surface.
8. **No way to undo the feed floor, and no "recommend problems" affordance.**
   Open design question, unsolved. See also the topic-aware feed entry in
   `IDEAS.md` under *Big swings*.

---

## High

### v1 MCP server has ungated bulk-write tools
`mcp-server/src/tools.js` exposes 14 tools including `create_entry`, `move_entry`,
`bulk_move_entries` and `bulk_create_entries` — built before the safety model in
`docs/superpowers/specs/2026-06-25-ai-agent-rag-design.md` existed. That spec
classifies `bulk_reassign` as **propose-only, human-confirm**, and requires an
`agent_actions` log for undo. Neither exists here: the tools mutate directly, with
no proposal step and no audit trail.

Currently dormant — it's a local stdio server that needs `SUPABASE_SERVICE_ROLE_KEY`
in env, so nothing reaches it unless you wire it into a client. But it is a loaded
gun sitting in the repo: connecting it to Claude Desktop today would hand an agent
unlogged bulk mutation over the whole library, using a key that bypasses RLS.

**Before reconnecting it to anything:** either re-gate the bulk tools behind the
propose/confirm model, or strip them to read-only. Don't rely on remembering.

### Bookmarklet tokens are plaintext by construction — accepted risk
A bookmarklet is a string in your bookmarks with no secure storage, so whatever
credential it carries is necessarily visible in that string. Per-user tokens
(`0063`) fixed the part that was fixable — the credential is no longer shipped to
every visitor in the JS bundle, and it is now revocable per device — but the token
itself is still plaintext in the bookmark.

Residual risk: a bookmarklet runs **in the page's context**, so a hostile site
could monkeypatch `fetch` and capture the token when you click. Low likelihood,
but it is the security ceiling of the mechanism, not an implementation gap.
Mitigation is revocation (Settings → Capture tokens), which is now instant.

**The real fix is the browser extension** in `docs/preservation-v2-spec.md` §1:
extension code runs in an isolated world the page cannot reach, so the token is
never exposed to visited sites. That spec wanted an extension for login-walled
capture; it resolves the credential problem as a side effect. Until then, treat a
bookmarklet token as something to revoke on suspicion rather than protect
perfectly.

### Captured entries are never enriched — and wiring it up naively is worse
Found 2026-07-30. `capture/index.ts` never calls `enrich`, and `enrichEntries` in
`App.jsx` runs only on client-side creation paths (QuickAdd, bulk import,
migration). Entries created server-side by the bookmarklet / iOS Shortcut are
therefore **never enriched at all** — they keep the URL and `document.title` and
nothing else, and `full_text_status` stays null permanently.

This is most of why `check-preservation` reports 955 entries / 0 preserved / 955
"not attempted".

**Do not just wire `enrich` into `capture`.** It runs server-side and logged out,
so for any login-walled or paywalled page it fetches the wall, not the article.
`MIN_ARTICLE_CHARS` (500) catches short stubs, but a wall with nav, footer and
"subscribe to continue" boilerplate clears 500 easily — Readability would extract
it and store it as `full_text_status = 'ok'`. That is worse than storing nothing:
junk feeds the embeddings, pollutes semantic search, and the coverage number lies.

Options, in order of correctness:
1. **Browser extension** (`docs/preservation-v2-spec.md` §1) — serializes the DOM
   in your authenticated session, so it captures what you actually saw. The only
   mechanism that works for login-walled content at all.
2. Enrich captured entries but **only for public pages**, with a paywall/login
   heuristic that marks suspected walls `empty` rather than `ok`.
3. Leave as-is. Captures stay bookmarks-with-titles; the backfill script handles
   preservation for public URLs on demand.

Today's behaviour is accidentally the safe one, which is why this is logged rather
than hot-fixed.

### Contextual retrieval was never applied — ROOT CAUSE FOUND, re-index pending
Found and diagnosed 2026-07-30. **5 of 4,976 chunks have a `context` value.**
All 5 are `full_text`; **0 of 4,971 `note` chunks** have any, despite 361 entries
producing the 2+ chunks that qualify.

**Root cause:** `scripts/rechunk.js` reads `AI_BASE_URL` / `AI_API_KEY` /
`AI_MODEL` from `process.env`. Those live as **Supabase secrets**, not in
`.env.local`, so `canContextualize` was always `false` and every chunk the script
wrote got `''`. The 5 that DO have context came through the app instead, where
`contextualizeChunks` calls the `ai` edge function, which has the secrets.

**It even warned** — line 57 printed "indexing WITHOUT contextual retrieval (lower
quality)" — and that warning scrolled past. Chunks written without context are
*indistinguishable* from good ones: same shape, same dimensions, no error, working
search. Nothing could surface the difference except inspecting the DB.

**Fixed 2026-07-30:** the script now reads `.env.local` (real env still wins), and
**refuses to run** without the AI vars unless given an explicit `--no-context`.
Degrading is now a choice someone makes, not an accident they scroll past.

**Still to do — this is the actual repair:**
1. Add `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` to `.env.local`
2. **Build a real eval fixture first.** `tests/src/lib/retrievalEval.fixture.json`
   is still the shipped template — 2 placeholder queries and a note saying
   "replace expected[] with real entry ids". Without a baseline there is no way to
   answer "did contextual retrieval help", which is the whole question.
3. `runEval` → record the number
4. `node scripts/rechunk.js` → regenerates ~4,971 chunks WITH context
5. `runEval` again → compare

Step 2 before step 4, or the opportunity to measure is gone. The cited benefit is
~35% fewer retrieval failures (~49% with a lexical arm); whether that holds on a
personal notes corpus is exactly what the harness exists to find out.

**Cost note (updated 2026-07-30):** step 4 re-embeds ~5k chunks and runs the
contextualizer over ~360 documents. At the old batch size of 8 that was 798
contextualizer calls and ~$5.34; **at the new size of 32 it is 397 calls and
~$2.70.** Rate-limited by the Gemini key pool (5 keys) and the free-tier AI
provider, so expect it to take a while — resumable via `source_hash`.

**Do the batch-size change before the re-index, not after.** It is already
committed (`ca0e8d0`), so a re-index run today gets the cheaper path for free —
but a re-index run from an older checkout would pay double and produce chunks
shaped by a config you are no longer using.

### `index_status = 'pending'` is declared everywhere and written nowhere
Found 2026-07-30 while tracing the indexing paths end to end.

`0068` defines `pending`. `IndexStatus`'s `STATES` map renders it ("Indexing…").
`listUnindexed` selects on `index_status in ('pending','failed')`. But
`chunkEntryAsync` only ever calls `markIndex` with `ok`, `empty` or `failed` —
**nothing ever writes `pending`.**

**Consequence:** indexing runs entirely in the browser, so closing a tab mid-import
abandons the work. Those entries keep `index_status = null` (`not_attempted`),
which `listUnindexed` does **not** select. The notes are unsearchable *and*
invisible to the retry banner — the exact silent-unfindability failure that `0068`
was written to eliminate, surviving in the one case where the work never finishes.

**Fix:** write `pending` before the first source is processed. ~5 lines, no schema
change, and worth doing before the queue exists rather than waiting for it.

### Bulk import fires unbounded parallel indexing
`src/App.jsx:798` (and 776, 838, 872):

```js
created.forEach(e => chunkEntryAsync(supabase, e))
```

No `await`, no concurrency limit. Importing 500 notes starts 500 indexing pipelines
simultaneously — 500 contextualizer calls and 500 embed calls racing. Nothing paces
them, nothing bounds them, and the work exists **only in browser memory**, so
whatever hasn't run when the tab closes is simply lost.

This is the concrete failure the jobs table (task #5) fixes. It is not a
theoretical nicety, and it is also why there is currently no graceful way to
handle running out of AI quota mid-import: deferred work needs somewhere to wait,
and right now there is nowhere. `reindexBatch` already demonstrates the right
shape — it paces retries at 3/second precisely so a retry can't recreate the burst
that caused the failures — but the import path doesn't use it.

### Instagram session scraping is fragile and ToS-gray
`fetch-reels` depends on a session cookie in `user_configs.twitter_auth_token`.
It will break without warning and can't be defended if challenged. Already listed
under *Cuts / quiet retirements* in `IDEAS.md` — park unless used weekly.

### `App.jsx` is a god object — 1320 lines, 55 handlers, 26 `view ===` branches
The hook extraction (`useTopics`, `useEntries`, `useInbox`, …) moved *state* out
but left *orchestration* in. Share-target handling, imports, OAuth callback,
revisit, trash, export, entitlement loading and now event tracking all live in one
component.

Concrete evidence this is costing real time: three parallel branches all edited
`App.jsx` in the same session. They merged cleanly by luck, not design.

Next cut should follow seams that already exist rather than splitting by line
count — `useShareTarget`, `useOAuthCallback`, and a routing module that owns the
`view ===` ladder (26 branches) are the obvious three.

---

## Medium

### Query sprawl — 18 components bypass the db layer
**Measured 2026-08-07.** The stated convention is that `src/lib/db/` owns every
query and components receive data as props (that separation is what makes the db
layer testable with a mock client). **124 `.from()` calls live in `src/lib/db/`,
and 18 components query Supabase directly anyway:**

`ApplicationsView` · `FileRow` · `FilesView` · `HighlightsView` ·
`HomeReviewSummary` · `OpportunityView` · `ReaderModal` · `SettingsView` ·
`TidyView` · `WatchlistTab` · `settings/{CompaniesTab,DataBackupTab,KeywordsTab,ProgramsTab}` ·
`widgets/{DeadlineAlertBanner,FocusWidget,OpportunitiesWidget,ResurfaceWidget}`

Consequences: queries cannot be found or counted from one place, the same filters
(`deleted_at is null`, the `surface_after` snooze guard) get re-typed per call
site and drift, and a component that self-fetches cannot be unit-tested without a
DOM plus a mock client.

**Deliberately deferred 2026-08-07** — pulling these back through the db layer
touches career, files, settings and widgets, which are unrelated to the Manager
work in flight. Do it as its own pass with its own commit, not folded into a
feature. Mechanical enough to delegate.

**Rule while it stands:** new work does not add to this list. The Manager's
queries go in `src/lib/db/`.

### TidyView is the only untested view, and now the busiest
It self-fetches (`fetchTidyQueue` is module-private, not exported) and has no
test file at all. After the Triage merge (2026-08-07) it is the single triage
surface for both new inbox items and stale backlog, so the untested surface is
now on the core loop. Testing it means building a query-builder mock for a
component that self-fetches — which is an argument for moving its fetch into
`src/lib/db/` first, per the entry above, and testing it there with the existing
`mockSupabase` helper.

### Four status enums for what is mostly one idea
`entries.status` (`backlog|active|done`) · `applications.status`
(`saved|applied|screen|interview|offer|rejected|ghosted`) ·
`resource_sections.status` (`todo|reading|done`) · `gains_*.status`
(`open|done|dropped`). Three of the four are `todo/doing/done` spelled
differently. Alongside them sit **seven** progress-tracking mechanisms, three of
which have no UI (`goals.js`, `studyPlan.js`, most of `interviewPlan.js`).

**Update 2026-08-07: down to three.** `resource_sections.status` went inert with
the reading UI — the table survives with 0 rows and no readers (see *Orphaned
schema* below), so the enum is dead without having been unified. Counting it
would overstate the problem.

`applications` is genuinely a different geometry — a pipeline moving toward a
binary outcome, not "how far through a body of work am I" — so it should stay.
The other two are candidates for unification, but **not urgently**: this is
recorded so the count stops growing, not as a scheduled refactor. Every new
feature that invents an eighth progress mechanism makes it worse.
See `docs/manager-scope.md`, which exists partly to stop that.

### Orphaned schema from the reading-UI deletion — RETAINED ON PURPOSE, revisit before production

**Decided 2026-08-07: keep it. This entry is the note that it exists**, because
the whole point of retaining dead schema is that nothing will remind you later.

Deleting the deep-topics UI (`manager-scope.md` §4) stranded a table and seven
columns. Every one has **zero rows and zero code references** — verified against
the live database, not inferred from the migrations:

| Object | |
|---|---|
| `resource_sections` (table) | the only table in the DB both empty and referenced nowhere |
| `topics.kind` | fully inert once `.eq('kind','note')` was removed. Every remaining `kind` in the codebase belongs to a different table or a plain object |
| `topics.cursor_section_id`, `.source_kind`, `.source_url` | |
| `entries.section_id`, `.parent_id` | `parent_id` is also `IDEAS.md`'s "the one place flat-over-nested was broken" — nothing uses it, so flattening stays free |
| `user_configs.twitter_token` | unrelated and dead since `0022` |

**Why it was kept rather than dropped.** `DROP COLUMN` is one-way, these hold
nothing, and the constraint on the whole Manager pass was *"none of my existing
data gets wiped, just reformatted."* A migration that drops them is a migration
that can only be undone by remembering the exact types and constraints.

**The trigger to revisit is production.** A schema shipped to other people is one
where every column is a support question, a backup column and a thing the RLS
audit has to reason about. Before that point, a migration should drop the list above
in one pass. Not before — there is no cost to carrying it for one user.

**One item needs a decision, not just a drop: `entries.takeaway`.** It is the
only orphan that is still *read*: `chunkEntry.js:35` feeds it to the search
index and `githubSync.js:169` renders a `## Takeaway` section into backups.
`DeepTopicView` was its only writer and it is gone, so this is a live read path
against a column nothing can fill — the inverse of the dead-wire pattern in
`PROJECT-STATE.md`'s 2026-08-07 synthesis. Either give it a writer or remove
both readers; leaving it is the option that quietly rots.

**Effort, if triggered today (estimated 2026-08-11, not yet spent):** the drop
migration itself is trivial — six `DROP COLUMN`/`DROP TABLE` statements,
~15 min, no data-migration logic needed since every object is pre-verified at
0 rows / 0 references. `entries.takeaway` is the only real decision: delete
its two read sites and drop it with the rest (~30 min), or give it a writer
(~1 hr, e.g. TidyView captures one line on "done reading"). **Under 2 hours
total**, entirely mechanical except that one decision.

### Migration count is not the problem, and cannot be fixed anyway
74 files / 2005 lines, and periodically someone will want to tidy them. They
**cannot** be reduced: every one is recorded in
`supabase_migrations.schema_migrations` remotely, so deleting a local file does
not remove anything from the database — it makes local and remote disagree and
leaves the next `db push` reasoning from an incomplete history. The permanently
skipped `0059` is the same fact in miniature.

`supabase db squash` would collapse them into a baseline. **Don't.** It buys a
cosmetic file count and puts the one artifact that cannot be reconstructed —
the schema's history — through a rewrite. The clutter worth removing is in the
schema, not the folder; see the entry above.

### `styles.css` monolith — 5784 lines / 153 KB
The entire design system in one file, and every feature keeps appending to it
(this session added three separate blocks). Split by surface — tokens, layout,
then per-view — before it becomes unnavigable. No framework needed; the CSS
itself is fine, it's the packaging that isn't.

### Feature sprawl — many near-products in one shell
Reels, career/opportunities, interview bank, deep topics, digest, boards. The
modules system (migration 0057) makes this *manageable* by letting each be turned
off, but it doesn't reduce the maintenance surface. Retiring things is still the
only real fix.

### Regex HTML sanitization on public share
`public-share` sanitizes with regex, which is not a sanitizer. Low risk while you
are the only author of your notes; a real problem the moment shared content is
user-generated by anyone else. Use a parser-based sanitizer before that.

---

## Lower

### Silent fire-and-forget chunk indexing
`chunkEntryAsync` deliberately never throws — indexing must not break a save,
which is right. But there's no signal anywhere when indexing fails, so semantic
search can quietly go stale with no indication. The `full_text_status` marker
(0060) is the pattern to copy: a per-entry index status would make staleness
visible. Related: the import queue (task #5) needs somewhere to report failures.

### `EntryCard.jsx` (~650 lines) does too many jobs
Display, inline edit, tagging, versioning, preview, archive. Split along the
same lines as the props it takes.

---

## Resolved — kept for the lesson, not the status

Moved out of the live list 2026-07-31. Each is closed; what earns it a place here is
the thing that was learned doing it. Nothing below needs action.

**Migrations written but never applied** *(2026-07-29)* — all applied via
`supabase db push`. `0059` is permanently unused: parallel worktrees claimed numbers
out of order. Applied state lives in `PROJECT-STATE.md` §1, not here.

**`VITE_CAPTURE_SECRET` in the client bundle** *(2026-07-30)* — `SettingsView.jsx`
rendered bookmarklet / iOS templates containing the shared capture secret, shipping
it to every visitor who loaded that chunk. Closed by per-user tokens (`0063`), then
unsetting `CAPTURE_SECRET`, deleting the Vercel var, and rebuilding; absence verified
against the live bundle. Two lessons: (1) **it was never exploitable** —
`CAPTURE_USER_ID` had never been set, so the legacy path had no account to attribute
captures to and 401'd, meaning the bookmarklet had been quietly broken for some time,
and earlier notes claiming an attacker could write to the Inbox were simply wrong;
(2) **removing an env var is not enough** — `VITE_` values are inlined at build time,
so the deployed bundle keeps the secret until a rebuild replaces it. Deleting the
variable and not redeploying looks fixed and isn't.

**Dead landing backups** *(2026-07-29)* — `LandingPage.backup.jsx`,
`landing.backup.css`, orphaned `src/lib/fetchFeed.js` deleted; zero references
anywhere, including the HTML entry points. `src/lib/retrievalEval.js` was checked
and **kept** — a deliberate before/after harness for `chunkConfig` tuning, not
forgotten code. "No importers" and "dead" are not the same thing for a tool.

**`allorigins.win` SPOF** *(2026-07-30)* — replaced by the `crawl-archive` edge
function. Parsing is regex-based (Deno has no `DOMParser`), reusing the approach
proven in `fetch-feeds`, and was verified against live sites before deploy: danluu
128/128 atom entries, simonwillison 30/30, jvns 20/20, plus 16,808 URLs off
simonwillison's sitemap. That last number is why `MAX_ITEMS = 500` exists — the
uncapped response was multi-megabyte JSON that would also have buried the picker UI,
and the old client-side version had the same unbounded behaviour. The function
requires a logged-in user; without that gate it is an open URL fetcher anyone could
point at arbitrary hosts using our egress. `isSafeUrl` is re-checked **per fetched
URL**, not just on user input, because a sitemap index points at child sitemaps a
hostile site could aim at internal addresses.

**`showFounderUploads` outside the module system** *(2026-07-30)* — now the `uploads`
module (`minTier: 'founder'`) via `src/hooks/useModuleAccess.js`; `NoteEditor` has two
callers, so a local hook beat threading entitlement through both. `src/lib/account.js`
is down to `isDev` and `isFounder`. **Behaviour change worth knowing:** `uploads` is
`defaultOn: false`, so it is opt-in per account rather than automatically on in dev —
the grandfathered founder account has it, a fresh account must enable it in
Settings → Modules. The old test encoded the previous always-on-in-dev behaviour and
was rewritten to cover both directions.

**Duplicated `isSafeUrl`** *(2026-07-30)* — `capture/index.ts` imports from
`_shared/isSafeUrl.ts`; the inline copy was byte-identical. `crawl-archive` uses the
same module.

---

## Bottom line

The core is genuinely good: search that isn't naively embedding-only, backup that
respects GitHub limits and secret boundaries, capture that works on iOS/Android,
sharing that doesn't punch holes in RLS. Real constraints, closed loops.

The cost is **concentration** — too much product surface and too much UI/CSS
weight in too few files. The capture-secret tradeoff is closed (per-user tokens);
what remains on the personal-app side is the IG session cookie and the plaintext
bookmarklet token, both of which need revisiting before this stops being "just me."

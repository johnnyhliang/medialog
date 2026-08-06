# Manual QA checklist

**Written 2026-08-06.** For clicking through the running app, not for the test suite.

Everything here has automated tests or none at all, and it still needs a human,
because this session's bugs were overwhelmingly the kind that **pass their tests and
fail in use**: a setting that saved to a database nobody checked the error from, a
hook whose test never remounted it, a function that was complete and never called,
a `ReferenceError` on a code path no test rendered. Coverage numbers would have
reported all of those as fine.

**Order is deliberate.** §1 is unverified data-loss risk. §2 is code that may not be
reachable at all. §3 is everything changed this session, none of which has been seen
in a browser. §4 is the long tail.

Mark items ✅ / ❌ / N/A as you go. An ❌ belongs in `docs/tech-debt.md`, and if it
matters, ranked into `PROJECT-STATE.md` §6.

---

## 1. Data loss — do these first

The only items here where being wrong is unrecoverable.

- [ ] **Supabase automatic backups are ON.** Dashboard, not code. Free tier has none
      and pauses on inactivity. Nothing else in this file matters if this is off.
- [ ] **Migrations `0070` and `0071` are actually applied** — `supabase db push`.
      Both arrived from a parallel session; written ≠ applied.
- [ ] **A full backup→restore round trip, against real data.** *This has never been
      done.* The format was refactored twice this week and only unit-tested.
  - [ ] Settings → Data & Backup → **Download zip**. Open it: `data/*.json` present,
        `README.md` present and describing the contents, `notes/` readable.
  - [ ] **Grep the zip for your GitHub token and Twitter token. Both must be absent.**
        A test asserts this; confirm it on a real file.
  - [ ] Open `data/user_configs.json` — theme, modules, archive_toast,
        radar_keywords, prep_target_date, prep_focus should be there.
  - [ ] **Import it back into a throwaway account.** Topics, entries, tags,
        highlights, versions, assistant threads, programs, companies, quick links
        and your preferences all arrive.
  - [ ] **Import the same zip twice.** Nothing duplicates — restore upserts by key.
  - [ ] Restore does not delete anything that was already there.
- [ ] **GitHub backup still works after the format change.** Press **Back up now**,
      then check the repo has a new commit and its README lists current row counts.
- [ ] **Auto-backup is running.** Check `user_configs.last_error` is null and the
      backup repo has recent commits. It fails silently by design and once did
      nothing for months.
- [ ] **Attachments have a second copy somewhere.** Preserved PDFs and images live
      only in the `snapshots` bucket; no backup carries the bytes.

---

## 2. Built but possibly unreachable

`PROJECT-STATE.md` §2 lists code that is real, tested, committed — and that nothing
in the UI may import. For each: **can you reach it as a user at all?**

- [ ] **Goals** (`src/lib/goals.js`, 85 lines, tested). Expected: **no UI exists.**
      Confirm, so it stops being ambiguous.
- [ ] **Interview readiness** (`interviewPlan.js` 210 lines, `db/studyPlan.js`).
      Rings, staleness dot, gap list, target-date editor — does any of it render in
      Interview? `prep_target_date`/`prep_focus` are believed never read.
- [ ] **Preservation coverage** (`preservation.js`). `preservationPatch` is wired;
      `preservationCoverage` (the ◆ marker, "N of M preserved") may have no UI.
- [ ] **`scripts/backfill-full-text.js`** — never run against real data. Do **not**
      run it in anger first; try it on a handful of entries.
- [ ] **Billing** (`billingPlan.js`) — inert by design. Confirm nothing in the UI
      appears to offer payment, since nothing can take it.

---

## 3. Changed this session — none of it seen in a browser

All of this passed unit tests. **None of it has been used.**

### Settings persistence
- [ ] **Programs tab**: add a program, toggle its window open/closed, edit a
      deadline, add one with **Notes** filled. Reload — everything stuck, notes saved.
- [ ] **Companies / Keywords**: add, toggle, delete. Reload. Keywords especially —
      `radar_keywords` had no backup until today.
- [ ] **Settings remembers the tab you were on** when you navigate away and back.
- [ ] **Archive toast** toggle in Behavior survives a **reload** (it is stored in the
      database, cached locally — if it flickers to the wrong state on load, that is
      the cache and worth reporting).
- [ ] **Trash toast** and **assistant enabled** toggles survive a reload.
- [ ] Turn a **module off in Settings → Modules**, confirm its nav item disappears,
      turn it back on. Then confirm Settings did not strand you on a hidden tab.
- [ ] **Settings search**: type a query and click a result. It must not crash —
      this threw a `ReferenceError` on every result until this session.

### Assistant
- [ ] Delete a saved conversation → **a confirm appears naming that conversation**.
      Cancel keeps it. Confirm removes it and the row disappears.
- [ ] Deleting the thread you currently have open resets to a new chat.

### Export
- [ ] Sidebar **Export** downloads immediately with **no modal**, and the toast says
      how many entries and that attachments are excluded.
- [ ] The Markdown export is still readable elsewhere (front-matter intact).

---

## 4. Everything else, by surface

Nothing below was touched this session; several have never been systematically
walked. Do these when convenient.

### Capture — the core loop
- [ ] Quick add with a URL: title auto-fetches, lands in **Inbox**.
- [ ] **Bookmarklet** from Settings → Bookmarklet actually saves. It was quietly
      broken for months once, and the token mechanism changed since.
- [ ] **iOS Shortcut** from a real Safari share sheet.
- [ ] **Capture tokens**: mint one, use it, then **revoke it and confirm it stops
      working.** Revocation is the whole security model for bookmarklets.
- [ ] Bulk import a handful of URLs. *Watch for the known issue: import fires
      unbounded parallel indexing and closing the tab loses whatever hasn't run.*
- [ ] Sort Inbox: assign topic, tag, delete.

### Search & retrieval
- [ ] Keyword search across everything.
- [ ] **Search inside a topic** — note how unclear the scoping is; that is open bug #6.
- [ ] Ask the assistant something answerable from your notes; citations open the
      right entry.
- [ ] Ask something about the app itself (app-help route, not retrieval).
- [ ] *Known issue #1: retrieval runs on every prompt whether or not it's needed.*
- [ ] **Index health**: is the "N notes aren't searchable" banner accurate? Retry
      works? *Known gap: `index_status = 'pending'` is never written, so notes
      abandoned mid-import are invisible to this banner.*

### Entries
- [ ] Inline edit title and URL; note autosave; **version history** and restore.
- [ ] Tags, pin, status backlog → active → done, takeaway prompt on done.
- [ ] Move an entry between topics; archive; trash → restore → empty trash.
- [ ] File preview for a PDF and an image.

### Views
- [ ] **Home**, **Browse**, **Progress** (topic picker + insights — changed by the
      parallel session), **Digest**, **Revisit**, **Tidy**, **Explore**, **Files**,
      **Highlights**, **Reading**, **Archive**, **Guide**.
- [ ] **Feed**: add a source, poll, read/save items. *Known issue #7: sort resets
      instead of staying with the writer/source. #8: no way to undo the floor.*
- [ ] **Career**: companies, keywords, programs, applications, radar.
- [ ] **Interview**: see §2 — much of the readiness UI may not exist.
- [ ] **Deep topics**: outline + cursor. *Note this is slated to be collapsed into
      ordinary topics (§6 row 17), so log annoyances rather than fixing them.*
- [ ] **Metrics** (founder only). *Known issue #4: slow, like everything else.*

### Sharing & preservation
- [ ] Share an entry publicly, open the link **in a private window**, then
      **unshare and confirm the link dies.**
- [ ] Manage shares in Settings → Shared.
- [ ] Capture 2–3 **prose articles**, run `node scripts/check-preservation.js`.
      Expect `readability`. *Do not judge from a link index or a GitHub/YouTube URL
      — Readability correctly declines those, and reading that as failure is a
      mistake already made once.*
- [ ] Wayback: *known broken — records successes it never verified.*

### Cross-cutting
- [ ] **Mobile / PWA**: install it, capture from the share target, check layout.
- [ ] All four themes × both styles, light and dark.
- [ ] Keyboard: command palette, entry navigation, remap a binding and confirm it
      persists and shows in the editor.
- [ ] **Sign out and back in.** Preferences and modules survive.
- [ ] *Known issue #4: watch load times everywhere — it is the top-ranked bug and
      needs measurements more than impressions. Note which surfaces are worst.*

---

## What to do with results

- ❌ that loses or corrupts data → fix now, ahead of the §6 ranking.
- ❌ elsewhere → add to `docs/tech-debt.md`, rank in `PROJECT-STATE.md` §6 if it
  deserves to compete for time.
- "I could not find it" → that is a §2 answer worth writing down; unreachable code
  is the single largest source of "did that get built?" confusion in this project.

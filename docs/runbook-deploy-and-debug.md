# Two things only you can do

Written 2026-09-01. Both are blocked on a browser or a deploy credential, not on
code. Each says what to run, what to look for, and — the part that matters —
**what each outcome would prove**, so a result is information rather than
another inconclusive attempt.

---

## 1. Deploy `fetch-opportunities`

**Why it matters:** commit `86d462c` wired two opportunity sources that were
written and never called, and fixed a bug that was **deleting your saved
opportunities**. None of it is live until the edge function is deployed.

```bash
supabase functions deploy fetch-opportunities
```

### Then verify, in this order

**a) The two new sources actually return rows.** Supabase → SQL Editor:

```sql
select source, count(*), max(posted_at) as newest
from opportunities
group by source
order by count(*) desc;
```

- **Only `github`** → the new sources deployed but returned nothing. Check the
  function logs for the line it now prints: `sources: github=N hn=N careers=N`.
  A zero there is the source failing, not the wiring.
- **`hn` present** → HN is live.
- **`greenhouse` / `lever` / `ashby` present** → careers is live. These are the
  chips the UI already had colours for and could never display.
- **`careers=0` in the logs specifically** → it found no companies. `careers.ts`
  reads the `companies` table; if that is empty there is nothing to fetch, which
  is a data question, not a bug.

**b) The saved-item delete fix.** This is the one worth actually testing,
because the failure was silent and destructive.

1. Open Opportunities, **save** any GitHub-sourced item.
2. Confirm it is saved: `select * from opportunity_state where is_saved;`
3. Trigger a refetch (wait for the cron, or invoke the function).
4. The item must **still be there**.

Before the fix, the reaper checked `opportunities.is_saved` — a legacy column
that migration `0044` stopped writing to — so a saved item read as unsaved and
was deleted the moment it fell out of the GitHub fetch.

### Known and deliberate

- **`hn` and `careers` have no reaper.** Only `github` entries are cleaned up.
  They upsert on `(source, url)` with `ignoreDuplicates`, so they accumulate
  rather than duplicate. If the board gets noisy, that is the reason.
- **Twitter stays unwired.** `twitter.ts` needs a session cookie and is
  ToS-gray. `src/lib/modules.js` already parks it behind a founder-only module
  that is off by default; that decision was made correctly and stands.

---

## 2. GitHub connect — get the observation

**Read this first:** `docs/ui-polish.md` § *GitHub connect is BROKEN* opens with
an instruction not to ship another fix without a specific observation. Four
hypotheses have been formed, each looked convincing, each was wrong, and each
cost a deploy cycle. **The failure is silent, so "it still doesn't work" carries
no information about which stage failed.** The point of the steps below is to
produce a result that eliminates something.

Do this on the real origin — **`notes.johnnyliang.me`**, not localhost. A stale
service worker is a production-origin problem and cannot reproduce locally.

### Step 0 — the cheapest check, still untested

1. DevTools → **Application** → **Service Workers** → **Unregister**
2. Hard reload (Ctrl+Shift+R)
3. Try Connect again

**If it works now:** the bug was never in the code. Three correct fixes were
shipped and the browser was running cached JS the whole time. That is the
leading hypothesis precisely because it explains why correct fixes changed
nothing. If so, the follow-up is making the service worker update reliably, not
touching the OAuth path again.

Also try a **private window**, which sidesteps both the service worker and any
cached bundle in one move.

### Step 1 — the observation, if step 0 didn't fix it

DevTools → **Network** tab → tick **Preserve log**. Click Connect, complete
GitHub, then capture, in order:

**1. The full URL the instant you land back**, before any redirect. The browser's
history dropdown is the reliable way to read it — it gets replaced fast.

This one matters more than it looks. Every defence in the flow used to key on the
path; commit `f19da9b` changed that to an OAuth `state` parameter, so the URL now
tells us whether `state` survived the round trip.

- URL contains **`?code=...&state=medialog_...`** → the handshake is intact and
  the capture should have fired. Go to 2.
- URL contains `?code=` but **no `state`** → GitHub is not returning it, which
  points at the app registration rather than our code.
- URL is **`/app`** with no query at all → something consumed or discarded it
  before you could see it.

**2. Does a `github-token` request appear at all?**

- **No request** → the code never reached `handleGitHubCallback`. Still a
  front-end delivery problem.
- **Request, status 400** → open the Response tab. The `error` field is the real
  cause and is almost certainly a credentials mismatch. **This ends the guessing.**
- **Request, status 200** → OAuth worked. The bug is on the read side
  (`loadConfig` / RLS), not in the OAuth path at all.

**3. Any `alert()` popup.** The handler alerts on every failure path, so silence
means it never ran.

**4. Console errors during the redirect**, especially from supabase-js.

### The 30-second check that would end this instantly

Supabase → Table Editor → **`user_configs`**. If **`github_user` is set**, OAuth
has been working all along and only the UI read is broken — a completely
different bug from the one being chased.

### Already ruled out — do not re-investigate

Verified against the deployed bundles, not assumed:

- `VITE_GITHUB_CLIENT_ID` is inlined correctly and the authorize URL is built right
- `/settings` returns 200 and serves `app.html`, not the landing page
- The callback check is present in the shipped bundle
- The edge function returns **400** on every failure path, so silence proves it
  was never called

### Fixed along the way, each a real bug, none the blocker

`991b00b` the reload discarding `setView('settings')` · `b47e15c` supabase-js
PKCE stripping the code · `2473610` capturing the code at module load ·
`f19da9b` keying on `state` instead of the path, plus a verified build-order bug
where Rollup did not preserve the side-effect import order `main.jsx` relied on.

### Meanwhile, your data is safe

The **local zip backup** needs no GitHub at all: Settings → Data & Backup →
*Manual backup & restore* → Download zip. Anyone blocked on this still has a
working, restorable backup path.

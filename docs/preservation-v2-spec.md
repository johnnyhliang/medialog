# Preservation v2 — client-side capture, delegated fidelity, opt-in media

**Written:** 2026-07-29 · **Status:** spec, not built
**Supersedes:** the server-side Tier 2 in `docs/content-preservation-plan.md` (parts (b) and (c))

---

## The reframe

The original plan assumed preservation happens **server-side**: a worker running a
headless browser for pages and `yt-dlp` for media. That assumption is what made it
expensive and what made login-walled pages unsolvable.

Inverting it removes most of the infrastructure:

| Need | Where | Server infra |
|---|---|---|
| Article text | `enrich` edge function | ✅ built |
| Images / PDFs | Supabase `snapshots` bucket | ✅ built |
| Public page fidelity | **delegate to Wayback (SPN2)** | none |
| **Auth'd / JS-heavy pages** | **browser extension → capture endpoint** | none |
| Video transcripts | edge function (captions are plain HTTP) | none |
| Videos that must be video | **R2, opt-in per item** | small `yt-dlp` runner |

The worker shrinks from "browser + binaries + queue" to one job runner used only
for videos you explicitly mark.

---

## 1. Browser extension capture — the auth'd-page answer

**Why this and not a server.** A server needs your cookies to see what you see.
That means credentials at rest, constant breakage, and exactly the fragility
already flagged for the Instagram scraper (`docs/tech-debt.md`). Capturing in the
browser that is *already* authenticated sidesteps the entire problem.

Secondary wins, both of which the server approach cannot match:
- You archive **what you actually saw** — the rendered DOM, so SPAs, canvas, and
  client-rendered content come through. A crawler gets a shell.
- No "the snapshot silently differs from the page I read" risk.

**Must be an extension, not the existing bookmarklet.** A bookmarklet cannot fetch
cross-origin assets to inline them (CORS). An extension has the permissions.

### Shape
- Manifest v3, `activeTab` + `scripting` + `storage`. Request permissions on
  invocation, not install — a preservation tool asking for all-sites access up
  front is indistinguishable from spyware.
- Bundle **SingleFile** as a library (it's designed for this) to serialize the DOM
  into one self-contained HTML string.
- POST to the existing `capture` function: `{ url, title, html, captured_at }`.
- Store in the `snapshots` bucket, `kind: 'page'` (the column already anticipates
  this — see `0054`). Expect 2–8 MB per page; the 25 MB cap is right.

### Auth — fix this first, it is a prerequisite
The extension cannot use `VITE_CAPTURE_SECRET`. That secret is inlined into the
client bundle (High in `docs/tech-debt.md`) and shipping it in an extension makes
it worse: extension bundles are trivially unpacked.

**Blocking work:** per-user capture tokens. A `capture_tokens` table
(`user_id`, `token`, `created_at`, `revoked_at`), minted server-side, shown once,
revocable. The `capture` function resolves the token to a user instead of reading
`CAPTURE_USER_ID` from env. This is required for the extension and it retires a
launch blocker, so it is worth doing regardless.

### Deliberately out of scope
Auto-capture-on-visit. It would hoover up every authenticated page you open —
banking, email, medical. Capture stays an explicit gesture. This is not a
limitation; it is the feature.

---

## 2. Wayback via SPN2 — for public pages

Current code is not a fair test of Wayback. `submitArchive` calls `window.open`
on `/save/<url>` and returns, verifying nothing, and the caller writes
`wayback_submitted_at` regardless — so the database records archival successes
that were never confirmed, and the bulk submitter then *skips* those entries
forever.

**Rewrite:**
- Save Page Now 2 with S3-style keys from an archive.org account. Returns a job
  id; poll it. Authenticated captures get meaningfully better throughput.
- Move `checkArchive` into an edge function: no CORS, real retry/backoff, and the
  result can be cached in a column instead of re-fetched on every popup open.
- **Split the single `catch`.** Today rate-limited, CORS-blocked, timed out,
  network-down, and malformed-response all render as one `'error'` state,
  indistinguishable from "this page genuinely isn't archived." Return
  `rate_limited` / `unavailable` / `not_archived` / `failed` so the UI can say
  something true.
- Only write `wayback_submitted_at` after the job reports success.

**What Wayback cannot do — accept these consciously:**
1. **Snapshots can be removed retroactively.** Sites can request exclusion and
   archive.org honors it. Trading "the original died" for "my archive died too" is
   the failure self-hosting exists to prevent — so Wayback is a complement, never
   the only copy of something that matters.
2. **One institution.** Under publisher litigation; had multi-day outages from a
   breach and DDoS in 2024. Excellent library, poor guarantee.
3. **No authenticated or paywalled content.** That is what §1 is for.
4. **JS-heavy pages degrade.** Also §1.
5. **No usable video.**
6. **Silent partial success** — a capture can succeed while missing assets. Verify
   by fetching the snapshot and sanity-checking size, once, at capture time.

---

## 3. Video — transcripts free, media opt-in

**Transcripts need no worker.** Captions are fetchable over plain HTTP, so this
fits in an edge function. ~50 KB, and for a conference talk it usually preserves
the actual value. This is the default for every video entry.

**When video must be video:** opt-in per item, stored in **Cloudflare R2**
(~$0.015/GB/month, **zero egress**). That pricing shape matches the workload —
write once, re-watch occasionally, one viewer. ~100 hours of 720p ≈ 100 GB ≈
**$1.50/month** with no bandwidth surprises. Supabase Storage is ~$0.021/GB but
charges egress, and media gets re-watched, so R2 wins on the read side.

**Rejected: re-uploading to a personal YouTube account.** Content ID scans private
and unlisted uploads; a match can produce a claim or strike against the *same
Google account* that holds Gmail and Drive. Risking a critical personal identity
to avoid a $1.50/month bill is a bad trade. Also `videos.insert` costs 1600 units
against a 10,000/day default quota (~6 uploads/day), and stored OAuth refresh
tokens recreate the session-cookie fragility we're trying to eliminate.

**`yt-dlp` operational note:** it breaks frequently as sites change. Pin loosely
and expect to rebuild; a container that never updates will silently rot. This is
the one piece with genuine ToS exposure, which is another reason it stays
explicitly opt-in and low-volume.

---

## 4. The job queue

Media downloads need one. **It should be the same table as the import queue**
(task #5) rather than a second one — both are "work too slow or too heavy for a
request, needs status and retries."

```
preservation_jobs(id, user_id, kind, target_id, status, attempts, last_error, created_at, updated_at)
```

`kind` covers `media`, `reindex`, and future work. One queue, one status UI, one
retry policy. Two queues means two of everything and a second thing to forget to
monitor.

---

## 5. Build order

1. **Per-user capture tokens** — blocks the extension, retires a launch blocker
2. **Wayback SPN2 rewrite** — fixes an already-broken feature, no new infra
3. **Extension** — the auth'd-page capability, biggest jump in what's preservable
4. **Transcripts in an edge function** — cheap, no infra
5. **Job queue** (shared with #5) → **R2 media**, opt-in

1 and 2 are independent and both worth doing before any of the rest.

---

## 6. What is consciously not preserved

Anything behind a login that you never explicitly capture with the extension, and
any public page a site later excludes from Wayback. If a category emerges that
genuinely cannot be lost, the answer is a **narrow** self-hosted path for exactly
that category — not a general server-side archiver.

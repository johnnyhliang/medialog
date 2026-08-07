# Production Launch Checklist

Prep for launching MediaLog to first real users. Nothing here is done yet — it's the
"before other people depend on this" list. Costs are approximate; verify against current
provider pricing before committing.

---

## Cost summary (target ≈ $25–30/month)

| Piece | Choice | Cost |
|---|---|---|
| Database / auth / edge functions / crons | **Supabase Pro** | ~$25/mo |
| Frontend (static Vite build: landing + app) | Cloudflare Pages / Vercel / Netlify **free tier** | $0 |
| File storage | **None — uploads removed.** Users hotlink their own files (`docs/hotlinking.md`) | $0 |
| Domain | Cloudflare / Namecheap | ~$12/yr |
| Transactional email | **Resend** free tier (~3k/mo) for digests/resets | $0 to start |
| Error monitoring | **Sentry** free tier | $0 |

**Do NOT self-host Supabase to save money at launch.** A VPS able to run the full stack
(Postgres + GoTrue + PostgREST + Realtime + Storage + Kong) is ~$12–24/mo *and* you own backups,
patching, and uptime — more money and far more work than the $25 managed tier. Self-host later only
for data-ownership reasons, never as the cheap option.

---

## Scaling & cost mechanics

Measured 2026-07-30. The point of this section is that **AI cost here is dominated
by embeddings, not by chat** — which is the opposite of what people assume, and it
changes what you optimise.

### Per-operation AI cost, ranked

| Operation | When it fires | Approx tokens | Notes |
|---|---|---|---|
| **`embed-entry`** | **every entry save** | ~200–2 000 in, per chunk | Per *save*, not per question. Fires for every user whether or not they ever open the assistant. **This is the real cost centre.** |
| `askLibrarian` | per library question | ~1 550 | 8 passages × 700 chars + system |
| `askAppHelp` | per app question only | ~1 010 | Cheapest AI path. Router sends app-shaped questions here; library questions never pay it |
| `enrich` | per URL capture | 0 (no LLM) | Readability is local to the function |

**Implication:** capping chat would barely move the bill. Capping/queueing
*embeddings* is what controls spend. `chunkEntry.js` already hash-guards on
`source_hash`, so re-saving unchanged text costs nothing — the exposure is new
content and backfills.

### What grows, and when to act

| Thing | Today | Acts up at | Fix |
|---|---|---|---|
| App-help prompt | 23 modules × ~22 tok + 21 settings × ~12 tok | ~40 modules | Prefilter rows by keyword, same as `searchSettings` — send only relevant ones |
| Library passages | 8 × 700 chars, fixed | never | Already bounded by design |
| `content_chunks` | ~1 chunk per source field | 100k+ rows | pgvector index tuning (`lists`/`probes`); consider HNSW |
| `snapshots` bucket | images/PDFs only, 25 MB cap | video opt-in | See `preservation-v2-spec.md` §3 — R2 for media |
| `events` | 5 event types, batched | 1M+ rows | Partition by month, or roll up nightly and drop raw |
| `crawl-archive` | capped at 500 items | — | Already bounded after a sitemap returned 16 808 |

### Free-tier constraint is rate, not money
The AI provider is an OpenRouter/Groq free-tier Llama 3.3 70B (`docs/ai-setup.md`).
Monetary cost is ≈ $0; the ceiling is **requests- and tokens-per-minute**. A burst
— bulk import triggering hundreds of embeddings — hits TPM long before it hits a
bill. That is the same burst problem the import queue (task #5) solves, so the
queue is a *rate-limit* fix as much as a cost one.

---

## What must not be open-sourced

Full analysis with measured coupling: `docs/open-source-boundary.md`.

**Keep closed — these are the business, not a security concern:** `src/lib/limits.js`
(tier allowances = your pricing model) · `src/lib/modules.js` (feature list,
maturity, gating = your roadmap) · `src/lib/billingPlan.js` ·
**`_shared/meter.ts` (per-model cost table = your unit economics)** ·
`admin-metrics` + `MetricsView` · migrations (schema + every RLS policy) ·
`feedStarterPack.js` / `interviewSeed.js` (**curated content — arguably the actual
IP**; the ranking code is generic, the judgement about which sources matter is not).

**Safe to open-source if you want the signal:** the chunking + retrieval-eval
engine (~430 lines) · `extractArticle.ts` · `isSafeUrl.ts` · `parseMigration.js`.
The eval harness is the part worth publishing — most chunking code ships with no
measurement.

**Licence:** repo is public, all rights reserved, `package.json` is `UNLICENSED`.
No licence means no permission is granted to use, deploy or host it.

---

## If you ever move off Supabase/Vercel

**Don't, until something specific forces it.** Managed Supabase at ~$25/mo replaces
Postgres + auth + storage + edge functions + cron. Reproducing that on a
hyperscaler is more money and far more operational surface. The honest triggers
are: an enterprise customer demanding a specific region/compliance posture, costs
crossing roughly $500/mo where committed-use discounts start to matter, or needing
something Supabase genuinely cannot host (a persistent worker, a GPU).

**What would actually port, in order of difficulty:**

| Piece | Portability | Notes |
|---|---|---|
| Frontend | **trivial** | Static Vite build. S3+CloudFront / Azure Static Web Apps / Cloudflare Pages. Only `vercel.json` rewrites need translating — see `docs/deploy.md` for the two-entry-point routing that must be preserved |
| Postgres | **easy** | RDS/Aurora or Azure Database for PostgreSQL. Needs the **pgvector** extension — available on both, verify the version. `pg_cron` and `pg_net` are the catch: RDS has `pg_cron`, but `pg_net` is Supabase-specific, so every cron that POSTs to a function has to become an EventBridge/Logic Apps schedule instead |
| Edge functions | **medium** | 16 Deno functions → Lambda (needs a Deno layer, or a rewrite to Node) or Azure Functions. The rewrite is mostly mechanical since they are small and dependency-light — but `_shared/isSafeUrl.ts` and `extractArticle.ts` must move with them |
| **Auth** | **hard — the real lock-in** | Supabase Auth issues the JWTs that **every RLS policy reads via `auth.uid()`**. Moving to Cognito/Entra ID means either re-issuing compatible JWTs with the same `sub` claims, or rewriting every policy. Migrating password hashes is possible but users may need resets |
| **RLS** | **hard if you leave Postgres** | Row-level security *is* the authorization model here — client gating is cosmetic. Keep Postgres and it ports untouched; move to DynamoDB/Cosmos and you are rewriting authorization from scratch |
| Storage | **easy** | `snapshots` bucket → S3/Blob with equivalent per-user prefix policies |

**The lesson to keep:** the app is portable *because* the client is a thin layer
over Postgres+RLS. That is also why the AI-agent tool layer was deferred and why
client gating was kept cosmetic — those decisions preserve the property. Anything
that moves authorization into application code makes a future migration harder.

**A cheaper intermediate step**, if the trigger is cost rather than compliance:
keep Supabase for auth+Postgres, and move only the expensive workload (embeddings,
media) to whichever provider is cheapest. Nothing forces an all-or-nothing move.

---

## Operating the app — where the controls are

**Admin dashboard:** sidebar → **more** (collapsed by default) → **Metrics**.
Requires `tier = 'founder'`; it's `stage: experimental`, so it is invisible to
every other account regardless of tier.

From there you can: see every account with tier, billing status, AI calls, cost,
storage and last-seen · change any account's tier inline · **emergency stop** all
AI globally · pause AI for one account.

**CLI fallback** if the UI is broken: `node scripts/set-tier.js <email> paid`
(needs `SUPABASE_SERVICE_ROLE_KEY`). Emergency SQL and the full incident runbook
are in `docs/limits-runbook.md`.

**Your own usage:** Settings → Behavior shows the rolling-window meter, storage
and plan.

---

## Measured cost model (2026-07-30)

Real numbers from the live corpus — 4,976 chunks, 396 documents, avg 418
tokens/chunk. Priced at **paid-tier rates** so the numbers stay meaningful when the
free provider is swapped out; today's actual spend is ~$0.

| Operation | Cost |
|---|---|
| Indexing one 2-chunk note | **~$0.0009** |
| 100 notes | ~$0.09 |
| **Importing 500 notes** | **~$0.42** |
| One-time full re-index of the whole corpus | **~$5.34** (ctx $4.98 + embed $0.36) |
| One chat question | ~$0.001 |

**Contextualisation is ~93% of indexing cost**, because the document is re-sent
once per batch of 8 chunks — 8.05M input tokens versus 2.37M for the embeddings
themselves. That is the knob that matters if cost ever bites: raising
`CONTEXTUALIZE_BATCH_SIZE` sends the document fewer times.

**Implication for pricing:** a heavy user importing 5,000 notes costs about $4
once, then pennies per month. That is comfortably inside a $8–12/mo tier. Storage
and egress will bite before AI does.

### Quota design — keep the two budgets separate

`ai_usage` already meters both paths under different `function_name` values, so
either shape is available. **Do not put them on one budget.**

A shared quota means importing your library exhausts your ability to *ask
questions about it* — the app punishing you for using its core feature, at the
exact moment you're deciding whether you like it. Instead:

- **Chat** — rolling `AI_WINDOW_HOURS` window, user-visible meter, hard cap. This
  is interactive; a user can see it, feel it, and wait.
- **Indexing** — no user-facing cap. Queue it and drain at a rate. The user never
  waits on it and never sees a number.
- **Cost ceiling** — a per-account monthly `est_cost_usd` alert covering BOTH.
  That's the number that actually protects you, and it belongs in the admin
  dashboard rather than in the user's face.

### Making indexing invisible

Design goal: a user should never think about embedding. Three mechanisms, in the
order they pay off:

1. **Queue + drain** (task #5). Imports mark entries `pending`; a worker drains at
   a few per second. The import completes instantly from the user's perspective;
   search catches up quietly.
2. **Two-phase indexing** — embed raw content immediately (searchable within
   seconds), then upgrade with context in the background. The user gets working
   search at once and better search later, with no visible state in between. This
   also makes contextualisation *interruptible*, which a single-phase pipeline
   isn't.
3. **Silence on the happy path.** `IndexStatus` renders nothing when healthy;
   `IndexHealthBanner` appears only when something actually failed. Progress bars
   for work nobody asked about are noise.

**What to avoid:** a spinner on save, a percentage during import, or any
"indexing…" state the user has to wait through. Indexing is the app's problem.

---

## 🔴 Must fix before first users (blockers)

- [x] **RLS / multi-tenant audit** — done 2026-07-22, fixes in `0044_multitenant_rls.sql`
  (NOT YET PUSHED — run `npx supabase db push`). Found and fixed: `applications` had no owner
  column (any authenticated user could read/write everyone's job pipeline); `opportunities.is_read/
  is_saved` was per-user state on globally shared rows (moved to `opportunity_state`);
  `opportunities`/`programs`/`companies` were writable by any authenticated user (now read-only,
  cron writes via service role); storage `attachments` select was bucket-wide, not owner-scoped.
  Every other table was already correctly owner-scoped.
  - Scope that was checked: the app grew up effectively single-user. Before users share
  one database, verify EVERY table's row-level security truly isolates users — no one can read or
  write another account's `entries`, `topics`, `highlights`, `resource_sections`, `feeds`,
  `feed_items`, `opportunities`, etc. Run `/security-review` on the branch. A cross-user data leak
  at launch is the worst-case bug and is cheap to check now.
  - Note: some tables are intentionally **global/shared** (e.g. `opportunities`, `programs` job
    boards everyone sees). Confirm those have read-for-all RLS and are NOT user-writable, and that
    genuinely per-user tables are strictly owner-scoped.
- [ ] **Single-user edge functions.** These read a single `CAPTURE_USER_ID` env var — they're wired
  to the founder's personal account, not multi-tenant:
  - `supabase/functions/capture/index.ts` — inserts to `CAPTURE_USER_ID`'s Inbox.
  - `supabase/functions/fetch-reels/index.ts` — personal Instagram session + `CAPTURE_USER_ID`.
  - Decision per function: make it per-user, or disable/hide it for non-founder accounts before
    launch. (For contrast, `fetch-feeds` already iterates all users' feeds — that pattern is the
    multi-tenant target.)
- [x] **Remove file uploads** — done 2026-07-22, `0045_revoke_attachment_uploads.sql` APPLIED to the
  linked project. Client: attach button + drag/paste upload removed from `NoteEditor.jsx` (dropping a
  file now explains hotlinking), PDF upload fallback removed from `ReadingView.jsx`, dead
  `src/lib/storage.js` deleted. Server (the actual gate): `attachments_insert_own` and
  `attachments_update_own` policies dropped, bucket `file_size_limit` set to 0 — verified live.
  `FilesView.jsx` kept deliberately: read + delete of pre-existing objects, so they can be reviewed
  and purged. **Still open: whether to purge the existing objects.** Original text follows.
- [ ] **Remove file uploads entirely from the deployed build.** Decision (2026-07-09): MediaLog does
  not host files. Users hotlink instead — see `docs/hotlinking.md`. Not taking on storage cost,
  abuse surface, or content liability at this stage.
  - **UI removal (necessary, not sufficient):** the two upload entry points are
    `src/components/NoteEditor.jsx` (drag/paste attachment) and `src/components/ReadingView.jsx`
    (the PDF upload fallback — the pasted-link path stays). Also decide the fate of
    `src/components/FilesView.jsx`, which lists and deletes bucket objects, and the now-unused
    `uploadAttachment`/`CAP_BYTES`/`isAllowedAttachment` in `src/lib/storage.js`.
  - **⚠️ Enforcement must be server-side.** The anon key ships in the client bundle, so removing the
    React UI does NOT prevent uploads — anyone can call
    `supabase.storage.from('attachments').upload(...)` directly. **Revoke insert on the `attachments`
    bucket via Supabase storage RLS policies.** That policy change is the actual gate; the UI removal
    is cosmetic. Do both.
  - Existing uploaded objects: decide keep vs. purge before other users exist.
- [x] **Secrets hygiene** — checked 2026-07-22. Scanned all 133 JS files in a fresh `dist/` build:
  no service-role key, no Gemini key, no literal `service_role` anywhere in the bundle. `.env.local`
  is git-ignored (via `*.local`) and was never committed. The only key ever committed to history was
  the **anon** key hardcoded in `index.html` (removed in `b297ce3`) — decoded, its payload is
  `role: anon`, which is public by design and ships in the client regardless. No rotation needed.
  Remaining (needs console access, yours): confirm `CRON_SECRET` / `CAPTURE_SECRET` / provider keys
  are set as Supabase function secrets rather than living only in a local file. Original text:
- [ ] **Secrets hygiene.** Service-role key never shipped to the client bundle; `CRON_SECRET`,
  `CAPTURE_SECRET`, provider API keys set as Supabase secrets / host env, not in the repo. Confirm
  `.env.local` is git-ignored and no secret leaked into git history.
- [x] **Backups on.** Supabase automatic backups enabled 2026-08-07; evaluate the PITR add-on once
  real user data exists.
- [ ] **Auth flows verified end-to-end** on the production domain: email confirmation, password
  reset (`resetPasswordForEmail` redirect), and GitHub OAuth redirect all point at the prod URL,
  not localhost. Enable Supabase auth rate limits.

## 🟡 Should do before/around launch

- [ ] **Hotlinking guide is the storage story.** Uploads are being removed (see blocker above);
  `docs/hotlinking.md` documents where users host files and how CORS decides inline rendering.
  Consider surfacing that guide in the in-app Guide view. If hosting files ever becomes necessary,
  **Cloudflare R2** (presigned URLs, free egress, ~10 GB free) is the path — not Supabase storage.
- [ ] **Cron review.** Confirm the pg_cron jobs (fetch-feeds 2h, fetch-opportunities daily,
  fetch-reels) all carry the `X-Cron-Secret` and that functions are deployed `--no-verify-jwt` so
  the cron (no bearer token) reaches them. Re-check after any redeploy.
- [ ] **Rate limiting / abuse** on public-ish endpoints (capture, any function callable without a
  session) — at minimum the shared-secret checks that already exist, plus Supabase's built-in
  limits.
- [ ] **Deep-topics deferred minor:** `listDeletedTopics` doesn't filter `kind`, so a soft-deleted
  deep topic would appear in the Trash grid mixed with breadth topics. Only matters once deep-topic
  deletion ships; fix then.
- [ ] **PWA / offline sanity** on real devices: install to home screen, share-target save, offline
  read of cached content.
- [ ] **Legal-lite:** a basic privacy note + "export everything / delete account" path (the app
  already does full markdown export; wire an account-delete that cascades user rows).

## 🟢 Nice to have

- [ ] Sentry (or similar) error monitoring wired into the frontend + edge functions.
- [ ] Basic analytics that respect privacy (self-hosted Plausible / Umami, or none).
- [ ] Uptime check (cron-ping) on the app + a key edge function.
- [ ] Staging project (a second Supabase project) so migrations get tested before prod `db push`.

---

## Launch sequence (suggested order)

1. Upgrade to **Supabase Pro**; enable daily backups.
2. Run the **RLS / multi-tenant audit** (`/security-review`) and fix findings.
3. Resolve the **single-user edge functions** (per-user or disable).
4. Deploy frontend to a **free static host** on a real **domain**; verify all auth redirects.
5. Smoke-test signup → capture → triage → read as a brand-new second account (proves isolation).
6. Wire **Resend** for transactional email; verify digest + reset send from prod.
7. Invite first users.


Client-side end-to-end encryption (E2EE) fundamentally breaks your AI features. If entries are encrypted so the server can't read them, then the server can't embed them, can't chunk them, can't run semantic search, and the assistant can't read them. You cannot do RAG over ciphertext. It's a hard either/or:

- E2EE → maximum privacy, "even we can't read your data" (great for the own-your-data thesis) → but no semantic search, no assistant. You'd be shipping Standard Notes, not the "memory that reads itself back."
- Plaintext server-side (what you have) → all the AI works → but you and Supabase (and Gemini) can technically read the data. Encryption-at-rest (disk) is already on via Supabase, but that's not E2EE.

The pragmatic middle ground, and the one I'd actually consider: encrypt the things you don't need to search (file attachments, maybe raw private journal entries flagged "private"), keep searchable notes plaintext. You E2EE the sensitive blobs, keep AI over the corpus. That's a real, shippable posture — and it means when you do add file uploads, encrypting those client-side is cheap and doesn't cost you any AI feature, because you weren't going to RAG over a PDF's bytes anyway.

production ideas: this really isn't worth it at the moment because it would ruin the ai vec search and I would have to reimplemnet, not worth optimizing, but something worth later down the lineis

Related docs: `IDEAS.md` (feature backlog), `docs/superpowers/specs/` (feature specs).

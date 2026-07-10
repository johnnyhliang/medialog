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

## 🔴 Must fix before first users (blockers)

- [ ] **RLS / multi-tenant audit.** The app grew up effectively single-user. Before users share
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
- [ ] **Secrets hygiene.** Service-role key never shipped to the client bundle; `CRON_SECRET`,
  `CAPTURE_SECRET`, provider API keys set as Supabase secrets / host env, not in the repo. Confirm
  `.env.local` is git-ignored and no secret leaked into git history.
- [ ] **Backups on.** Supabase Pro daily backups enabled; evaluate the PITR add-on once real user
  data exists.
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

Related docs: `IDEAS.md` (feature backlog), `docs/superpowers/specs/` (feature specs).

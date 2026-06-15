# MediaLog Plan 5 — Hardening (CI, security, cleanup)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or executing-plans. Checkbox steps.

**Goal:** Bulletproof the app before moving forward — CI, lint, fix two real security issues (search-filter injection, enrich SSRF), and cleanup/polish (gitignore, lazy-load editor, real icons, input caps).

**Tech Stack:** Existing + GitHub Actions, ESLint flat config.

**Scope:** "Core + polish." Excludes the breaking Vite major upgrade — the 6 npm-audit findings are all in the dev toolchain (esbuild/vite/vitest dev server), none in shipped runtime; defer to a future major bump.

---

## Task 1: .gitignore + CI workflow
- Add `.vite/` and `*.local` to `.gitignore`.
- Create `.github/workflows/ci.yml`: on push/PR → `npm ci`, `npm run lint`, `npm test`, `npm run build`.
- Commit.

## Task 2: ESLint
- Install `eslint @eslint/js eslint-plugin-react-hooks eslint-plugin-react-refresh globals`.
- Add `eslint.config.js` (flat, recommended + react-hooks), `lint` script.
- Run `npm run lint`, fix findings, commit.

## Task 3: Search-filter injection fix (TDD)
- Create `src/lib/searchFilter.js` `buildSearchFilter(query)` — escapes `\ % _ "` and wraps the value in double quotes so PostgREST `or` delimiters (`,()`) can't be injected.
- Test the escaping. Wire into `searchEntries`. Commit.

## Task 4: enrich SSRF guard (TDD)
- Create `supabase/functions/_shared/isSafeUrl.ts` `isSafeUrl(url)` — only http/https; reject localhost, private/loopback/link-local IP literals, `169.254.169.254`, `.local`.
- Vitest-test it. Wire into `enrich/index.ts`: reject unsafe URLs, add 5s `AbortController` timeout, cap response read. Commit.

## Task 5: Lazy-load CodeMirror
- `EntryCard` imports `NoteEditor` via `React.lazy` + `<Suspense fallback>`.
- Update `EntryCard.test.jsx` to `await screen.findByLabelText('note editor')`. Commit.

## Task 6: Real PWA icons
- Replace 1×1 placeholder `public/pwa-192x192.png` / `pwa-512x512.png` with correctly-sized branded icons. Commit.

## Task 7: Input length caps
- `maxLength` on note/url/topic inputs; clamp in `createEntry`/`bulkCreateEntries` (note ≤ 10000, url ≤ 2000, topic ≤ 120). Commit.

## Done criteria
- CI green on PR; `npm run lint` clean; search & enrich hardened with tests; `.vite/` ignored; editor lazy-loaded; real icons; input caps. All existing tests pass; build succeeds.

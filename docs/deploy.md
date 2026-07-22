# Deploying MediaLog

Everything here is a one-time setup except step 6. Written 2026-07-22.

## What makes this app's routing unusual

The Vite build has **two HTML entry points** (`vite.config.js`):

- `index.html` → the marketing landing page (`src/landing.jsx`)
- `app.html` → the application itself

The app is not served from `/`. It lives at `/app`, and it also has to be
reachable at `/settings`, because that is where GitHub OAuth returns the user.
A naive single-page catch-all (`/* → /index.html`) breaks every auth flow by
serving the landing page to `/app` and `/settings`. Both `public/_redirects`
(Netlify / Cloudflare Pages) and `vercel.json` encode the correct routing.

Auth redirect targets, for reference:

| Flow | Returns to |
|---|---|
| Signup confirmation | `origin + /app` |
| Password reset | `origin + /app` |
| GitHub OAuth (backup) | `origin + /settings` |
| PWA share target | `/app.html` |

---

## 1. Pick a host

Either works; the repo is configured for both.

- **Vercel** — uses `vercel.json`.
- **Cloudflare Pages / Netlify** — uses `public/_redirects`.

Build settings are identical: build command `npm run build`, output directory
`dist`, Node 20.

## 2. Set environment variables in the host dashboard

Only `VITE_`-prefixed variables reach the browser bundle. **Never** add
`SUPABASE_SERVICE_ROLE_KEY` or `GEMINI_API_KEY` here — they are server-side
secrets and would ship to every visitor.

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_GITHUB_CLIENT_ID=<github oauth app client id>
VITE_CAPTURE_SECRET=<capture shared secret>
```

## 3. Deploy

```bash
# Vercel
npx vercel link          # once, interactive
npx vercel --prod

# Cloudflare Pages
npx wrangler pages deploy dist --project-name medialog
```

## 4. Point Supabase auth at the deployed domain

Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://<your-domain>`
- **Redirect URLs** (add all):
  - `https://<your-domain>/app`
  - `https://<your-domain>/settings`

Leave `http://localhost:5173/**` in the list so local development keeps working.

Then Authentication → Rate Limits: keep the defaults on, they are the only
abuse protection on signup.

## 5. Update the GitHub OAuth app

github.com → Settings → Developer settings → OAuth Apps → your app:

- **Homepage URL**: `https://<your-domain>`
- **Authorization callback URL**: `https://<your-domain>/settings`

## 6. Deploy the edge functions

Functions are **not** deployed by the frontend host — they live in Supabase and
must be pushed separately after any change.

```bash
npx supabase functions deploy github-backup
npx supabase functions deploy github-token
```

Secrets they need (set once, server-side only):

```bash
npx supabase secrets set GITHUB_CLIENT_ID=...
npx supabase secrets set GITHUB_CLIENT_SECRET=...
npx supabase secrets set ENCRYPTION_KEY=...   # 32+ chars, used for AES-GCM at rest
```

`ENCRYPTION_KEY` must never change once a user has connected GitHub — rotating
it makes every stored token undecryptable, and affected users have to reconnect.

## 7. Verify before demoing

Walk these in a private window, on the deployed domain:

- [ ] `/` renders the landing page
- [ ] `/app` renders the application, not the landing page
- [ ] Sign up → confirmation email link lands on `/app` signed in
- [ ] Password reset link lands on `/app`, not localhost
- [ ] Settings → GitHub → Connect completes and returns to `/settings` connected
- [ ] Back up now writes a commit to the repo
- [ ] Semantic search returns passages
- [ ] Hard refresh on `/settings` still loads the app (rewrite works)

## Gotchas

- **The service worker caches aggressively.** After a deploy, a returning
  visitor may hold a stale bundle until the SW updates. `vercel.json` marks
  `/sw.js` no-cache to shorten that window. When testing a fresh deploy, use a
  private window or clear site data.
- **Migrations are not deployed by either host.** `npx supabase db push` is a
  separate, deliberate step.
- **`supabase/.temp/` is gitignored**, so a fresh clone has no project link —
  run `npx supabase link --project-ref <ref>` before any `db push`.

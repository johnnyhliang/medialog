# Supabase Key Migration — Legacy anon/service_role → JWT Signing Keys

Date: 2026-06-23
Priority: Next immediate — do before any public launch

## Problem

Supabase is deprecating the legacy HS256 anon key and service_role key in favor of keys issued through JWT Signing Keys. The dashboard shows:

> "Legacy anonymous key. Use SUPABASE_PUBLISHABLE_KEYS issued through JWT Signing Keys instead."
> "Legacy service role key. Use SUPABASE_SECRET_KEYS issued through JWT Signing Keys instead."

## What Changes

| Old | New | Where used |
|---|---|---|
| `VITE_SUPABASE_ANON_KEY` | `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env.local`, `src/lib/supabaseClient.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | (new secret key from dashboard) | `.env.local`, Supabase secrets |

The new keys look different from legacy JWT format. The API endpoints, SDK calls, and RLS policies do NOT change — only the key values and env var names.

## Dashboard Steps (Manual — Must Be Done in Supabase Dashboard)

1. Go to: **Supabase Dashboard → Settings → API → JWT Signing Keys**
2. Click **"Create new signing keys"** — generates a key pair
3. Copy the **Publishable Key** (replaces anon key)
4. Copy the **Secret Key** (replaces service_role key)
5. In Auth settings — keep current behavior, the key type change does not affect auth flows

## Code Changes Required

### `.env.local`
```
# Remove:
VITE_SUPABASE_ANON_KEY=eyJ...old...
SUPABASE_SERVICE_ROLE_KEY=eyJ...old...

# Add:
VITE_SUPABASE_PUBLISHABLE_KEY=<new publishable key from dashboard>
SUPABASE_SECRET_KEY=<new secret key from dashboard>
```

### `src/lib/supabaseClient.js`
```js
// Change:
import.meta.env.VITE_SUPABASE_ANON_KEY
// To:
import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
```

### Supabase Secrets (edge functions)
Any edge function that uses the service_role key via `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` must be updated:
```
npx supabase secrets set SUPABASE_SECRET_KEY=<new secret key>
```
Then update the `Deno.env.get()` calls in edge functions to use `SUPABASE_SECRET_KEY`.

### `README.md`
Update the configuration table to reflect new env var names.

## Account Linking (GitHub OAuth + Magic Link)

Supabase does not currently offer "automatic account linking" for all auth providers (the dashboard toggle is limited). For proper linking of GitHub OAuth and magic link accounts sharing the same email:

- Supabase's `linkIdentity` API can programmatically link a second provider to an existing account
- Implementation: after GitHub sign-in, call `supabase.auth.linkIdentity({ provider: 'email' })` to also attach the magic link identity
- This requires the user to be already signed in with one method before linking the second
- Alternative: enforce single auth method per user (GitHub OR magic link, not both) and document this

For now: if user signed up via GitHub and tries magic link with same email (or vice versa), Supabase creates two separate accounts. The cleanest UX fix is to display a note in the auth modal: "Use the same sign-in method you used previously."

## Email Transactional — Production Recommendation

For production, Supabase's built-in email is rate-limited (3/hour on free tier, low deliverability). Options ranked by cost:

**Cheapest for a personal/small-scale app:**
1. **Resend** ($0 free tier: 3,000 emails/month, 100/day) — Supabase Send Email Hook sends HTTP POST to your Edge Function which calls Resend API. No SMTP config. Resend has first-class Supabase integration docs. **Recommended.**
2. **Postmark** ($10/month) — Same pattern, higher deliverability SLA, more expensive
3. **Dreamlit / Pingram** (marketplace wrappers) — Skip these: they abstract away too much, add cost, and Resend directly is simpler

**Implementation path (when ready):**
1. Create account at resend.com, get API key
2. Add API key as Supabase secret: `npx supabase secrets set RESEND_API_KEY=<key>`
3. Create `supabase/functions/send-email/index.ts` — Supabase Send Email Hook that calls Resend API
4. In Supabase Dashboard → Auth → Hooks → "Send Email" — point to your edge function
5. Build email template (plain HTML or React Email)

This approach:
- Costs $0 until you need > 3,000 emails/month
- No SMTP port configuration
- Edge function = full control over templates
- Works for magic links, signup confirmation, password reset

## Non-Goals (this migration)

- Do not change RLS policies (they are key-type agnostic)
- Do not change auth flows
- Do not change the database schema
- Do not implement account linking in this pass (document the limitation instead)

## Acceptance Criteria

- No legacy key warnings in Supabase dashboard
- `npm run build` passes with new env var name
- Magic link and GitHub OAuth still work after migration
- Edge functions use new secret key from Supabase secrets
- README updated

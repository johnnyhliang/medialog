# Transactional Email — Resend via Supabase Send Email Hook

Date: 2026-06-23
Stage: Mid — do after Supabase key migration and Tuxedo UX features

## Why

Supabase's built-in email is rate-limited (3 emails/hour on free tier) and has low deliverability. Magic links landing in spam or getting rate-limited breaks the only auth flow in the app.

Resend fixes this:
- 3,000 emails/month free, 100/day
- Deliverability via verified domain (SPF/DKIM)
- No SMTP config — pure HTTP API
- First-class Supabase integration

## Architecture

```
User requests magic link
  → Supabase auth event fires
  → "Send Email" hook triggers edge function
  → Edge function calls Resend API (HTTP POST)
  → Resend delivers the email
```

Supabase's Send Email Hook intercepts ALL auth emails: magic links, signup confirmation, password reset, email change. One hook handles everything.

## What Gets Built

### 1. Edge Function — `supabase/functions/send-email/index.ts`

Receives the Supabase hook payload, selects the right template, calls Resend.

Hook payload shape (from Supabase docs):
```ts
{
  user: { email: string, ... },
  email_data: {
    token: string,           // OTP for magic link
    token_hash: string,
    redirect_to: string,
    email_action_type: 'signup' | 'magiclink' | 'recovery' | 'email_change',
    site_url: string,
    token_new: string,       // for email_change only
    token_hash_new: string,  // for email_change only
  }
}
```

The function must:
- Verify the request came from Supabase (hook secret header)
- Build the correct magic link URL: `${site_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`
- Call Resend `POST https://api.resend.com/emails` with the right template
- Return `{}` on success (Supabase requires empty JSON body, not 204)

### 2. Email Templates

Three templates (plain HTML, no external dependencies):

**Magic link / signup**
Subject: `sign in to medialog`
Body: minimal, on-brand — cream background, Fraunces heading, single CTA button linking to the verify URL. Keep it to 10 lines.

**Password recovery** (future-proof, not currently used)
Subject: `reset your medialog password`

**Email change confirmation**
Subject: `confirm your new medialog email`

Templates should match the landing page aesthetic: `#F8F5EE` background, `#3D5A4A` accent, Inter font fallback.

### 3. Supabase Hook Registration

Done in the Supabase Dashboard:
- **Auth → Hooks → Send Email** → point to `send-email` edge function
- Add hook secret to edge function secrets as `EMAIL_HOOK_SECRET`

No migration needed — this is pure config.

### 4. Resend Setup

- Create account at resend.com
- Add and verify your domain (adds SPF/DKIM DNS records — takes ~10 min)
- Create API key
- Set `from` address as `noreply@yourdomain.com` (or `medialog@yourdomain.com`)
- Store as Supabase secret: `RESEND_API_KEY`

## Secrets Required

| Secret | Value |
|---|---|
| `RESEND_API_KEY` | From Resend dashboard |
| `EMAIL_HOOK_SECRET` | Generated in Supabase → Auth → Hooks |

## Files

| File | Action |
|---|---|
| `supabase/functions/send-email/index.ts` | Create |
| No migrations needed | — |
| No frontend changes needed | — |

## Not In Scope

- React Email or Tailwind CSS templates — plain HTML is sufficient for now; no build step needed
- Dreamlit/Pingram marketplace wrappers — skip, Resend directly is simpler and cheaper
- Postmark — more expensive than Resend, not needed at this scale
- Email preference management — not needed until user base grows
- Unsubscribe link — magic link emails are transactional, legally exempt from unsubscribe requirements

## Cost

| Volume | Cost |
|---|---|
| 0–3,000 emails/month | Free |
| 3,000–50,000 emails/month | $20/month (Resend Pro) |

For a personal/small-team app, free tier covers the entire lifecycle. Only upgrade if you're running marketing campaigns (which is a separate tool anyway).

## Acceptance Criteria

- Magic links arrive in inbox (not spam) within 10 seconds
- No "rate limit exceeded" errors
- Email matches MediaLog visual style
- Hook secret prevents spoofed hook calls
- Function returns valid JSON on success (not 204)
- Supabase built-in email is no longer the delivery path

## Implementation Order

1. Verify domain in Resend → get API key
2. Deploy `send-email` edge function
3. Register hook in Supabase dashboard
4. Test magic link end-to-end
5. Remove Supabase's built-in SMTP config (optional — hook takes precedence)

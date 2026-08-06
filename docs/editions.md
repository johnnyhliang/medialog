# Hosted vs self-hosted — what differs, and how to keep them one codebase

**2026-08-06. Scoping, not built.** Which parts of MediaLog belong to the hosted
service, which only make sense when you run it yourself, and which are the same
either way.

Distinct from [`open-source-boundary.md`](open-source-boundary.md), which asks
*"which library modules could be extracted and published as packages"*. This asks
*"if someone runs the whole app on their own box, what changes"*.

The two answers differ. `limits.js` is on that document's keep-closed list because
it reveals pricing — but a self-hoster **needs** a limits module, just one that
returns "unlimited". The module isn't the secret; the numbers are.

---

## The principle

**A constraint that exists because of multi-tenancy should not exist for one
person on their own machine.** Almost every quota, gate and safety rail here is
downstream of one of three facts:

1. **Someone else pays the bill** — a shared AI key, egress, storage
2. **Other users share the blast radius** — a runaway import, a ToS complaint
3. **The operator is liable** — for what the service fetches and hosts

A self-hoster brings their own keys, is their own blast radius, and accepts their
own liability. None of those three facts hold, so the constraints they justify
should not either. **Removing them is not a favour to self-hosters; keeping them is
a bug.**

---

## 1. Hosted only — the commercial layer

Not secret because it's dangerous. Client gating is cosmetic and RLS is the real
enforcement; a forged tier reveals nav items that lead nowhere. It's private
because **it is the business**.

| Thing | Why hosted-only |
|---|---|
| `src/lib/limits.js` **values** | Tier allowances *are* the pricing model |
| `src/lib/billingPlan.js`, Stripe | Subscription→tier mapping, grace periods, dunning |
| `_shared/meter.ts` **cost table** | Per-model unit economics — the sharpest commercial intel in the repo |
| `admin-metrics`, `MetricsView` | Operator tooling. No user value; maps the admin surface |
| `user_entitlements`, `subscriptions` | Tier state, meaningless with one user |
| `admin_actions`, activation metrics | Operating a service, not using an app |
| `feedStarterPack.js`, `interviewSeed.js` | **Curated content — arguably the real IP.** The ranking code is generic; knowing *which* twenty writers are worth following is accumulated judgement |

**In a self-hosted build these should be absent or inert, not merely hidden.** A
paywall that can be flipped in devtools is worse than no paywall: it implies a
restriction that isn't real and invites someone to "discover" the bypass.

---

## 2. Self-hosted only — things a hosted service can't responsibly offer

The interesting half, and the reason a self-hosted edition is worth wanting rather
than just tolerating.

| Capability | Why hosted can't | Why self-hosted can |
|---|---|---|
| **`yt-dlp` video download** | Genuine ToS exposure, and per-tenant storage that grows without bound | Your box, your account, your call. `preservation-v2-spec.md` §3 keeps it explicitly opt-in and low-volume for exactly this reason |
| **Full page snapshots** (headless browser) | A browser per tenant is the single most expensive thing you could offer | One user, one browser, run it whenever |
| **No storage quota** | Someone pays for the bytes | You pay for your own disk |
| **No AI caps** | A shared key means one user's import starves everyone | Your key, your bill, your rate limits |
| **No feed-source limit** | Polling cost scales with tenants | Poll a thousand if you like |
| **Instagram / Twitter session cookies** | ToS-gray *on behalf of someone else* | Your session, your risk |
| **MCP server with write access** | Ungated bulk mutation across a shared database is indefensible | Still re-gate it — see `tech-debt.md` — but the objection is different in kind |

**The honest framing:** these aren't features withheld from paying customers out of
stinginess. They're things that are *safe alone and unsafe at scale*, which is a
real and explainable distinction.

---

## 3. Identical in both — most of the app

Everything that makes MediaLog what it is:

- **Supabase stays.** Postgres + auth + RLS + storage + edge functions. A
  self-hoster can point at Supabase cloud's free tier or run `supabase start`
  locally. Rewriting the data layer to avoid a dependency that is already free and
  self-hostable would be enormous work for no user benefit.
- **RLS policies stay**, even single-user. Auth still exists, `auth.uid()` still
  scopes rows, and a self-hoster may add a second account. Removing them creates a
  divergence in the one layer that must never diverge.
- Topics, entries, tags, capture, triage, search, chunking, embeddings, retrieval,
  backup/restore, preservation, feeds, digest, revisit — all of it.
- **The module system stays**, minus tier gating. `modules.js` composes entitlement
  AND preference; a self-hoster keeps the preference half, which is genuinely
  useful for turning off surfaces you don't want.

---

## How to do it without forking

**Do not maintain two repos.** For a solo project that means versioning, sync, and
a divergence you will discover at the worst moment. `open-source-boundary.md`
reaches the same conclusion for the same reason.

Three mechanisms, cheapest first:

**a. Move values into config, keep mechanisms in code.** `limits.js` reads its
allowances from config rather than hardcoding them. The *mechanism* — tiers exist,
modules gate on them — can be public without revealing anything commercial. This
alone solves most of §1 and costs almost nothing.

**b. One edition flag.** `EDITION = 'hosted' | 'self'` resolved at build time.
Self-hosted returns `null` (unlimited) from every limit, treats every module as
entitled, and enables the §2 capabilities. Dead-code elimination drops the
commercial branches from the bundle.

**c. A scripted export**, only if a and b prove insufficient. One private repo, a
script that strips §1 and produces the public one. Costs you PR-ability and
history on the public side, so it is a last resort rather than a starting point.

**Start with (a).** It is a config refactor, it's useful regardless of whether a
self-hosted edition ever ships, and it makes the eventual (b) mostly mechanical.

---

## Open questions

- **Does a self-hosted edition actually get built, or is this insurance?** It has
  real cost — a second configuration to test, and every quota becomes a branch. It
  earns its keep if it's a credibility signal (YC, hiring) or if people ask. Not
  before.
- **Which licence?** The current repo is public with all rights reserved, which is
  not open source. A self-hostable edition needs a real answer.
- **Who supports it?** An unsupported self-hosted build that breaks generates
  issues you did not budget for.
- **Do the curated lists ship?** `feedStarterPack` is judgement, not code, and it
  is arguably the most copyable thing in the repo.

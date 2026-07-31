# Limits & Emergency Runbook

**2026-07-30.** How to change what each tier gets, and what to do when spend runs
away. Written for you at 2am with a surprise bill, so it leads with the stop button.

---

## 🚨 Emergency: stop AI spend now

**Fastest — the dashboard.** Sidebar → **Metrics** → **emergency stop** at the top.
Confirms, then every AI call returns **503** for every account within seconds.
Existing data is untouched; nothing is deleted.

**If the app is broken and you can't reach the dashboard:**

```sql
-- Supabase SQL editor
update app_flags set enabled = false where key = 'ai_enabled';
```

**If Supabase itself is the problem**, pull the key — this stops spend even if
nothing else responds:

```bash
npx supabase secrets unset AI_API_KEY
# and, for embeddings:
npx supabase secrets unset GEMINI_API_KEY
```

Slower to reverse (you must re-set the secret), so prefer the flag.

### One account, not everything
Metrics → the **AI** column → **pause**. Blocks that account's AI calls without
changing its tier, so it keeps its features and the pause reads as temporary.
Sets `user_entitlements.ai_suspended`.

### What each brake actually does

| Brake | Blocks chat | Blocks embeddings | Reversible |
|---|---|---|---|
| `ai_enabled = false` | ✅ 503 | ✅ 503 | instantly, from the dashboard |
| per-account pause | ✅ 503 | ❌ **deliberately not** | instantly |
| unset `AI_API_KEY` | ✅ 500 | ❌ | needs the key value again |

**Why per-account pause doesn't block embeddings:** blocking them doesn't error,
it just silently stops indexing — the user's notes quietly become unsearchable
with no signal. That's a worse outcome than a bill. The global switch is
different: it's a deliberate outage you're choosing, and you know it's on.

### Every brake is logged
Emergency stop, per-account pause and tier changes all prompt for a **reason** and
write a row to `admin_actions` (migration `0069`) recording the value **before**
and **after**. The log is visible at the bottom of Metrics, and per-account under
**inspect**.

The before/after matters more than it looks: it means undoing an action never
requires remembering what the old state was. A reversible flag with no record of
why is a trap — weeks later you find a paused account, can't reconstruct what you
saw, and "leave it paused" starts to feel like the safe choice. It isn't, if
they're paying you.

`admin_actions` has RLS enabled with **no policies at all** — no client key can
read or write it, verified against production. The only path is the service role
inside `admin-metrics`, which does its own founder check. Reads are not logged:
opening the dashboard is not an event, and recording it would bury the rows that
matter.

### Debugging one account
Metrics → **inspect** on any row. Without writing SQL against production you get:
tier and its source, billing status, entry count, active days, **index health**
(and the verbatim error on any failed embed), article-preservation coverage,
storage, AI usage by day and function for 30 days, product-event counts, and every
operator action ever taken on that account.

Counts and statuses only — never note text, titles, URLs or search queries. Being
the operator is not a licence to read someone's library.

### After an incident
1. Metrics → sort by **cost** (default) — the top row is your answer
2. Check `ai_usage` for the shape of it:
   ```sql
   select user_id, function_name, hour, calls, est_cost_usd
     from ai_usage where hour > now() - interval '24 hours'
     order by est_cost_usd desc limit 20;
   ```
3. `function_name = 'embed-entry'` spiking → a bulk import or backfill, not abuse.
   The import queue (task #5) is the real fix.
4. `function_name = 'ai'` spiking on one account → pause it, then set a limit.

---

## Changing limits

Everything lives in **`src/lib/limits.js`**. It's data — edit, test, deploy.

```js
export const TIER_LIMITS = {
  free: {
    storageBytes: 500 * 1024 * 1024,
    feeds: 10,
    backupIntervalHours: 24,
    aiCallsPerWindow: null,   // null = unlimited
  },
  …
}
```

- `null` means unlimited
- an **undeclared** key is also unlimited — adding a dimension can never
  retroactively restrict an existing tier
- `AI_WINDOW_HOURS` (default 5) is the rolling window
- `WARN_AT` (default 0.9) is when the meter turns amber

Changes take effect on the next frontend deploy. **Except storage**, which is also
enforced in `supabase/functions/snapshot/index.ts` — edge functions can't import
client code, so the numbers are duplicated there. **Change both, or the UI will
promise something the server refuses.**

### Setting AI limits for the first time

They ship `null` on purpose. Guessing before you have data is how you pick a number
that's either useless or hostile. After ~a week:

```sql
-- What does a busy 5-hour window actually look like?
select user_id, date_trunc('hour', hour) as h, sum(calls) as calls
  from ai_usage
 where function_name = 'ai' and hour > now() - interval '7 days'
 group by 1, 2 order by calls desc limit 20;
```

Set `free.aiCallsPerWindow` somewhere above the 95th percentile of real sessions.
The goal is that a normal user never sees the meter fill; it exists to stop abuse
and runaway loops, not to ration ordinary use.

Then add the cap itself to `supabase/functions/ai/index.ts` — see
`docs/metering-scope.md` Step 5. **Return 429 with `{ limit, used, resets_on }`,
never 500**, and exempt founder.

---

## The rolling window, and why it's 5 hours

A monthly cap fails badly: burn it on day 2 and you're dead for 29 days, with
nothing to show but a distant date. A short rolling window recovers continuously,
so *"wait a bit"* is always a true and useful answer.

`ai_usage` buckets **hourly**, so a rolling N-hour window is a sum over the last N
buckets — max 24 rows/day/function/model rather than one row per call. `resets_at`
is when the **oldest bucket in the window ages out**: in a rolling window nothing
resets all at once, capacity returns gradually, and the next return is what a user
actually wants to know.

`UsageMeter` renders nothing while the limit is `null` — an empty bar is noise.

---

## Suggestions worth doing before you charge anyone

1. **Set AI limits from real data.** The one blocking item. A week of `ai_usage`.
2. **Import queue** (task #5). `embed-entry` is the dominant cost and a bulk import
   fires hundreds at once. A queue turns the burst into a drain, which is a
   rate-limit fix as much as a cost one.
3. **Cost alert.** Nothing currently tells you spend is climbing — you have to look.
   A daily cron comparing yesterday's `est_cost_usd` to a threshold, emailing via
   the existing `send-email` function, is maybe 30 lines.
4. **Verify the kill switch with a real session.** It's deployed but only
   partially verified: an anon probe 401s before reaching the flag check, because
   the check necessarily sits after auth. Sign in, flip it, confirm you get a 503,
   flip it back. Two minutes, and it's the control you least want to discover is
   broken during an actual incident.
5. **Storage limits are duplicated** between `limits.js` and the snapshot function.
   Worth a shared constant if it drifts even once.
6. **Grandfather existing accounts** before enforcing anything new, the same way
   `0057` did for modules. Someone over a new limit on the day you introduce it
   should be warned, not blocked.

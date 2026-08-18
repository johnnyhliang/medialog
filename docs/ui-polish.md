# UI polish — the design-system pass

Owner file for the visual-quality work. `PROJECT-STATE.md` §6 ranks these
against everything else; this file is authoritative on *how* and on what was
deliberately left alone.

**Why this exists.** The app was described as looking unpolished, and the cause
turned out to be measurable rather than a matter of taste: the tokens existed,
almost nobody used them. Corner radii were 15% tokenized across 19 distinct
values; font sizes are 30% tokenized across 33 distinct values, most of them
clustered at 10–13px so nothing has hierarchy. Four phases, cheapest visible
payoff first.

---

## Phase 1 — corner radii ✅ DONE (`fd7bc6b`, 2026-08-15)

19 values → 4 tokens (`--radius-sm` 4px / `--radius` 8px / `--radius-lg` 12px /
`--radius-pill` 999px). 194 CSS declarations plus the structural inline radii in
seven components. Tokenization 15% → **94%**; the remainder is `50%` ×12 and `0`
×7, which are shapes rather than scale steps.

`--radius` dropped 10px → 8px, so the default style is slightly tighter.
`themes.css` now zeroes all four under `[data-style="brutalist"]` instead of
overriding `--radius` alone plus two hand-written rules.

Deliberately excluded, and should stay excluded:
- `landing.css` / `LandingPage.jsx` — self-contained system with its own fixed
  palette (see the note at `tokens.css`). Handled in Phase 5.
- The style-preview swatches at `SettingsView.jsx:236-254` — they *depict*
  default/brutalist/glass corners. If they followed the tokens, all three
  previews would render identically and the picker would stop working.
- Password-strength meter fills and tag dots (`2px` on a 3px-tall bar).

The codemod lives in scratch, not the repo; it was a one-shot.

---

## Phase 2 — colour cleanup ✅ DONE (`bf4e679`, 2026-08-17)

Green/amber/red now resolve to `var(--done)`/`var(--active)`/`var(--danger)`, so
the palette shrank rather than grew; blue and purple mixed toward pine and
pencil. Also caught three raw Tailwind rgbas on the revisit grade-button borders
that had survived the token indirection. Original scoping below.


Kill the five stock-Tailwind tint pairs at `tokens.css:53-61` (`#DCFCE7`,
`#3B82F6`, `#EC4899`, `#8B5CF6`, `#FEF3C7` …). They are cold, saturated,
screen-native hues sitting on a warm paper background, and BRAND.md's colour
section says in as many words: *do not add colours casually*.

Rederive from pine/paper. **Must change `tokens.css` and `themes.css` in one
pass** — `themes.css` overrides the tint tokens 10 times for the dark palettes,
so changing only one file breaks them.

~30 sites. Small, but wants a human eye on the result.

**Leave alone — user data, not theming:** the `--hl-*` highlight ramp (a
highlight saved as "yellow" must be the same yellow in every palette; the file's
own comment explains this) and `TagColorRow.jsx` (17 hex values that are
user-chosen tag colours).

## Phase 3 — the type scale ✅ DONE (`77e2a74` + `7723d8c`, 2026-08-17)

Split deliberately: `77e2a74` tokenized 435 sites with no size change (33 values
→ 8, tokenization 30% → 98%), then `7723d8c` raised the eight token values alone,
so the risky half is one revertable commit. Each step moves in proportion to its
size and inversely to how often it is used. **Still unverified in a browser.**

One semantic loss: ~31 `rem` sites became fixed px and no longer scale with a
raised browser default. `landing.css` was converted to px to match (`8a26499`),
so the app is at least consistent — honouring browser font scaling is now one
decision, currently "no". Reversing it means defining the eight tokens in `rem`:
one block, no call-site churn, but the dense surfaces have never been tested at a
20px root. Original scoping below.


33 distinct font-size values, mostly hardcoded px: `12px ×68`, `11px ×62`,
`13px ×49`, `10px ×38`, plus `11.5`, `12.5`, `13.5`, `10.5`, `9.5`. Two
consequences: everything is 10–13px so the app reads like a dense settings
panel, and nothing is meaningfully larger than anything else so the eye has
nowhere to land. **This is the single biggest reason the app looks unpolished.**

~314 CSS sites + ~132 inline `fontSize` sites (excluding landing).

Not purely mechanical: raising the base from 12px to 14px changes density in
every dense view. Expect real overflow and wrapping fallout needing visual
checks, not just find-and-replace. Tightest surfaces: `entry-card`,
`settings-panels`, `manager`, `interview`.

Worst single offender: `SettingsView.jsx`, 39 inline font sizes.
`SetPasswordModal.jsx` reimplements the token system inline (`18px`/`13px`/
`14px`/`11px` plus its own box-shadow) and is a good canary.

## Phase 4 — fonts

`tokens.css` ships DM Sans + Lora. BRAND.md specifies **Fraunces 700 opsz:144**
for display and **Inter 300/400/500** for everything else, with Caveat reserved
for landing marginalia only. Two token lines plus font loading — trivial to
execute, but it restyles every screen at once, so land it *after* Phase 3.

## Phase 5 — landing page

Blocked on the naming decision — see `BRAND.md` § *Naming & positioning*.
Sequencing notes in § *Branding* below.

---

## Also open, from the 2026-08-15/16 session

Ranked roughly by "can this lose data or block a user".

**~~GitHub backup — no disconnect exists.~~** ✅ FIXED `ba77b50`. Grepped for it: capture tokens have a
proper revoke flow, GitHub backup has none. There is no way to unlink the backup
account from the UI. Add a disconnect that nulls `github_token`, `github_user`
and `repo_name` *together*, plus a link to GitHub's revocation page.

**~~`repo_name` survives an account switch.~~** ✅ FIXED `ba77b50`, hardened to fail closed in `c0e33cb`. Re-linking upserts `github_token` and
`github_user` (`github-token/index.ts:66-68`) but leaves `repo_name`. Because the
repo is created automatically if absent, switching to account B silently creates
a new repo of the same name under B — backup history splits across two accounts
with no indication. Fix: clear it alongside, or store `owner/name`.

**The two GitHub identities are never distinguished.** Login OAuth
(`LandingPage.jsx:163`) and backup OAuth are fully decoupled, so you can sign in
as A and back up to B. Legitimate, but the UI only says "Connected as {user}".
Name them separately and say so when they differ.

**~~Backup failures are invisible.~~** ✅ FIXED `ba77b50` — `last_backup_at` is now written and `last_error` surfaces in a banner. `App.jsx:320` swallows errors into
`user_configs.last_error` by design. Surface it, plus a "last backup: N days
ago" from `last_backup_sha` / `last_backup_summary`. Turns a silent failure into
a loud one.

**OAuth scope is `repo`** (`DataBackupTab.jsx:214`) — full read/write on every
repository, public and private, for an app that writes to exactly one. A GitHub
App with per-repo installation would scope it properly. Larger change; noted, not
urgent. *(The token itself is fine: encrypted at rest, decrypted only inside the
edge function at `github-backup/index.ts:54`. The client only ever sees
ciphertext, used as a presence check.)*

**Plain-text toggle for link-heavy entries.** `MarkdownView.jsx:11-27` swaps any
paragraph that is *only* a link for a rich `LinkEmbed` card, so a note with
twenty links becomes twenty stacked preview cards with no way to turn it off.
Add a per-entry "plain" toggle (preferred over a global setting — embeds are
good on a two-link entry and awful on a twenty-link one). `buildMarkdownComponents`
is already parameterised.

**The aged-entry fade — partially addressed.** `retired_at` (2026-08-17) gives it an exit: a retired entry stops being dimmed. The deeper point stands —
`noNoteAged = !entry.note && days >= 14` (`EntryCard.jsx:96`) →
`opacity: 0.65`. `days` counts from `created_at`, so the age half can never
become false; the only exit is writing a note. An entry that genuinely needs no
note is a permanently faded card. Worse, the app's response to "you never
processed this" is to make it *harder to read*, pushing exactly the entries that
need a decision toward invisibility. Consider an explicit "no note needed" state,
or inverting the treatment so the pile gets louder rather than quieter.

**~~`SettingsView.jsx` has 2 pre-existing lint errors~~** ✅ FIXED `8a26499`. — `loadConfig` accessed
before declaration (line 43) and an empty catch block. Predate this session's
changes; verified by linting the file before and after.

**Settings rail is unverified in a browser.** The 172px rail column
(`settings-view.css`) is a starting guess. "Data & Backup" is the longest label.

---

## How Revisit actually selects entries (recorded 2026-08-18)

Surprising enough in conversation to be worth writing down.

`listForRevisit` (`src/lib/db/entries.js:173`) selects entries where
`deleted_at IS NULL` and `retired_at IS NULL` and
**`surface_after IS NULL` OR `surface_after <= now()`**, ordered by
`last_surfaced_at` **ascending, nulls first**, limit 10 (set at `App.jsx:969`).

So it is *"anything due or never scheduled, least-recently-shown first"* — not
random, but also **not curated**. Because `surface_after IS NULL` qualifies,
every entry you have never graded is eligible, so until you start grading the
pool is effectively your entire library in oldest-shown-first order. A
reasonable cold start; it is a FIFO, not "the 10 most worth reviewing".

Once graded, `rateRevisit` (`entries.js:231`) runs SM-2 over
`srs_reps`/`srs_ef`/`srs_interval` (grades 3/4/5 = Hard/Good/Easy) and sets
`surface_after` to now + interval days. From then on it is genuine spaced
repetition.

Two traps found while working here, both now fixed but worth remembering:
- **Skip wrote nothing**, so a skipped entry stayed *first* next time. It now
  calls `markSurfaced`.
- **The component advanced twice per action.** Every parent handler ends in
  `applySeen`, which removes the entry from the queue — the list shrinking IS
  the advance. An index on top of that skipped every other entry. `current` is
  now `entries[0]`, never a cursor. Any future consumer of `<Revisit>` must
  remove on success or the card will never move.

A real ranking design (recency, topic weight, unfinished-ness) is drafted in
`IDEAS.md` § *Draft: the Resurface algorithm (beyond FIFO Revisit)*.

---

## Branding

> **Superseded 2026-08-18.** The naming research, the ruled-out candidates and
> the positioning decisions now live in `BRAND.md` § *Naming & positioning*.
> What stays here is the landing-page sequencing, below.

**One-liner, current draft:**
`Keep your best finds and ideas — and actually find them again.`
The finds/find echo is deliberate; "keep" avoids stuttering on a synonym.

**The thesis the name should carry:** the note is the load-bearing object. The
app *dims entries without one*. Every other read-later tool is a link graveyard
that asks nothing of you; this one's opinion is that a saved link without a
takeaway is worthless. Second differentiator: passage-level retrieval, so you
can find the sentence you half-remember. The product is **finds + ideas** —
external and internal — which is historically a *commonplace book*.

**Shortlist:** `Gloss` (a marginal note explaining a text; matches the
marginalia brand exactly, one syllable, works as a verb) · `Findings` (means
both things-found and conclusions; explains itself) · `Commonplace` (the real
historical name for this object).

Also considered: Winnow, Margin/Marginalia, Trove, Sift.
**Avoid:** `Recall` (heavily used), `Refind` (existing link-saving product).

⚠️ **Not yet checked:** domain availability, trademarks, current collisions.
Do this before anything reaches the wordmark.

**Landing direction (decided, not built):** drop the story-scroll for a direct
page — "if you're here you probably want to try it," the basics, a screen
recording, then features with graphics. Traffic from HN, YC, Twitter, Reddit, so
build for the most sceptical of those: one sentence, a demo watchable without
signing up, honest mechanics, repo link visible. BRAND.md's *voice* rules
(lowercase, plain verbs, no exclamation points) stay correct; it's the
*structure* that changes.

**Open considerations:**
- **Sequencing** — recording the demo freezes the current UI into permanent
  assets. Do Phases 3–4 first. User has agreed: record "after I have a
  publishable version".
- **Demo data is the largest unestimated piece.** The real library is career
  applications, interview prep and personal reading — unrecordable. Needs a
  seeded demo account with plausible non-personal content, reusable for
  screenshots and the OG image.
- **Video mechanics** — size, autoplay-muted-loop vs click-to-play, poster
  frame, `prefers-reduced-motion`, hosting. Show *one complete loop* (capture →
  lands → found later), not a feature tour.
- **Rewrite vs evolve** — `landing.css` is 20KB with its own palette and
  `LandingPage.jsx` carries 152 hardcoded hex values. A rewrite is cleaner given
  the direction change, but keep the auth flow.
- Decide whether the hand-drawn marginalia layer survives; it is most of the
  current landing's personality and half of BRAND.md.

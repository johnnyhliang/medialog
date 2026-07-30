# What could be open-sourced, and what shouldn't be

**2026-07-30.** The repo is public with all rights reserved. This is the analysis
of which parts could safely become genuinely open source, and which are the
business.

Measured coupling, not guessed: a module is "extractable" here if it has no
Supabase calls, no DOM access, and no local imports outside its own cluster.

---

## The one worth doing: the chunking + retrieval-eval engine

~430 lines, four files, and it is the best work in the repo that isn't
app-specific.

| File | Lines | Coupling |
|---|---|---|
| `src/lib/chunkContent.js` | 120 | `chunkConfig.js` + `github-slugger`. Nothing else |
| `src/lib/chunkConfig.js` | 23 | pure constants |
| `src/lib/contextualize.js` | 51 | `chunkConfig.js` + `ai.js` ← **only real coupling** |
| `src/lib/retrievalEval.js` | 38 | `db/retrieval.js` for `runEval`; **`scoreRun` is pure** |

**Why it's a real contribution rather than a code dump:** heading-aware markdown
chunking with merge-forward and window-split, Anthropic-style *contextual
retrieval* (each chunk gets an LLM-written sentence of document context before
embedding), and — the unusual part — **an eval harness that measures whether a
config change helped**. `scoreRun` computes `failureRate` / `recallAt5` / `mrr`
against a fixture, using the same failure-rate metric as Anthropic's contextual
retrieval numbers, so results are comparable to the published ones.

Most published chunking code has no eval. That is the thing people actually need
and rarely get.

**Work required:** ~2 hours. `contextualize` takes `supabase` and calls `callAI`
directly; it needs to accept an injected `complete(prompt) => string` instead. That
is a strictly better design anyway — `extractArticle.ts` already uses exactly this
dependency-injection pattern to run under Deno, Node and vitest from one file.

---

## Also safely open, if you want more surface

| Module | Why someone would want it |
|---|---|
| `_shared/extractArticle.ts` (192L) | Readability with the **DOM injected**, so one file runs in Deno, Node and vitest. That pattern is genuinely useful and rarely written down |
| `_shared/isSafeUrl.ts` (32L) | Correct SSRF guard — private ranges, CGNAT, IPv6, and the `169.254.169.254` cloud-metadata address. Small, easy to get wrong |
| `src/lib/parseMigration.js` (137L) | Imports Obsidian ZIP, Notion export, Apple Notes HTML, Google Keep JSON. Directly useful to anyone building a notes tool |
| `src/lib/feedRelevance.js` (65L) | Interest-profile ranking without embeddings |
| `fuzzyFind`, `headingSlug`, `markdownOutline`, `entryTitle`, `searchSnippets` | Small, well-tested utilities |

---

## Keep closed — and the reason is business, not security

**Important distinction:** publishing `modules.js` or `limits.js` would *not*
create a vulnerability. Client gating is cosmetic; RLS is the real enforcement, and
a forged tier reveals nav items that lead nowhere. Security through obscurity was
never the plan and isn't needed here.

The reason to keep these closed is that they *are* the business:

| Module | What it reveals |
|---|---|
| `src/lib/limits.js` | Exact tier allowances — your pricing model, before you've announced one |
| `src/lib/modules.js` | Every feature, its maturity, and what's gated at what tier. A product roadmap |
| `src/lib/billingPlan.js` | Subscription→tier mapping, grace periods, dunning behaviour |
| **`_shared/meter.ts`** | **Your per-model cost table.** Genuine commercial intelligence: it tells a competitor exactly what your unit economics are |
| `admin-metrics`, `MetricsView` | Operator tooling. No user value, and it maps your admin surface |
| `settingsIndex.js`, `appHelp.js` | Product surface description |
| `feedStarterPack.js`, `interviewSeed.js` | **Curated content — arguably the actual IP.** The code that ranks feeds is generic; the list of which 20 writers are worth following is judgment you accumulated |

**Migrations are the genuine judgement call.** They reveal the full schema *and*
every RLS policy. Publishing security policies is defensible — Kerckhoffs's
principle says a system shouldn't depend on its design being secret, and yours
doesn't. But it does let someone probe for gaps efficiently rather than blindly.
Given RLS is the *only* real enforcement layer here, I'd keep them closed.

---

## Recommendation

**Don't split the repo yet.** Two repos means versioning, sync, and a package to
publish, and that overhead is real for a solo project. The benefit only arrives
when someone actually wants the package or you want the credibility signal.

**When you do want it** — for a YC application, a hiring signal, or because someone
asks — the minimal version is one small public repo:

```
medialog-chunking/     (MIT or Apache-2.0)
  chunkContent.js      heading-aware markdown chunking
  chunkConfig.js       tunable constants
  contextualize.js     contextual retrieval (AI callable injected)
  scoreRun.js          the eval metrics
  README.md            the eval numbers, before/after a config change
```

~430 lines, zero coupling to MediaLog, and it stands on its own. Consume it from
the private app as a dependency.

**What makes it worth publishing is the eval harness**, not the chunker. Anyone can
split text on headings. Almost nobody publishes the measurement that shows their
splitting choices were right — and that is the part people copy.

**One thing not to do:** don't open-source the *retrieval* side (`db/retrieval.js`)
without the chunking side. Alone it's a pgvector query with RRF, which is neither
novel nor useful detached from the pipeline that fed it.

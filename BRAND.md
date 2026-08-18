# MediaLog — Brand Guide

The one-line identity: **a well-kept reading desk.** Warm paper, dark ink, one botanical green,
and honest pencil marks in the margins. Everything MediaLog shows the world should feel like it
was set in type by someone careful — then annotated by hand by someone who actually uses it.

## Voice

- Lowercase, plain verbs, no exclamation points. "sort your inbox", not "Supercharge your workflow!"
- Talks about the reader's life, not the product's features: "you were reading…" beats "Resume feature".
- Self-aware about the problem (tabs, graveyards, guilt) without being snarky about competitors.
- The handwritten voice (marginalia) is the only place allowed to be playful — it's the human in
  the margins, not the typesetter.

## Color (do not add colors casually)

| Token | Hex | Role |
|-------|-----|------|
| paper | `#F8F5EE` | background, always |
| ink | `#1C1A15` | text, dark sections |
| pine | `#3D5A4A` | the single accent: links, highlights, marks |
| pencil | `#8A8174` | hand-drawn annotations — graphite, *not* pine, so marginalia reads as human, not UI |
| card | `#F2EDE3` / `#EAE4D8` | raised surfaces |
| rule | `#DDD7CB` | hairlines |

Rule of thumb: pine is what the *system* points at; pencil is what the *person* scribbled.

## Type

- **Fraunces 700, opsz 144** — display only. Big, tight (-.04em), lowercase. Never body text.
- **Inter 300/400/500** — everything else.
- **Caveat 500/600** — marginalia only: annotations, arrows' labels, margin notes. Never longer
  than ~8 words per note, never for UI controls, max ~3 notes visible per screen. Overuse kills it.

## The hand-drawn layer

The signature. Rules that keep it charming instead of gimmicky:

- Strokes look drawn: 1.5–2px, slightly wobbly paths, round caps, imperfect closures (circles
  that don't quite meet).
- Color is always `pencil` at 0.7–0.9 opacity — except a mark the system makes (a highlight,
  a "this one" pointer), which may be pine.
- Motion: marks *draw themselves* (stroke-dashoffset) when scrolled into view, 400–700ms,
  ease-out, once. Under `prefers-reduced-motion`, they're simply present.
- Budget: one big drawn element per section maximum. Marginalia are seasoning, not layout.

## Motion

- Reveals: 500ms fade + 12px rise, staggered ≤80ms, IntersectionObserver, once per load.
- Nothing loops, nothing bounces, nothing parallaxes. Paper doesn't move; things settle onto it.
- Reduced-motion: all reveals instant, all draw-ons static.

## Logo / mark

- Wordmark: `medialog.` in Fraunces, lowercase, with the period — the period is the brand
  (a log entry ends; a thing is *kept*).
- Small mark: `ml` in Fraunces (already in footer). A future drawn mark: a pencil-circled dot.

## Applications

- **Landing:** tells a story downward (tabs-problem → the loop → proof → exit); marginalia
  annotate it like a well-loved book.
- **App:** stays quiet — the app inherits palette and type but *not* Caveat or wobbly strokes,
  except two earned moments: "all tidy" and inbox-zero.
- **Social/OG images:** paper bg, one Fraunces line, one pencil mark. That's the template.

---

# Naming & positioning — open, as of 2026-08-18

Everything below is a live decision, not settled guidance. The rest of this file
describes `medialog`; if the name changes, the palette, type and hand-drawn
layer all survive unchanged — only the wordmark does.

## The thesis a name has to carry

**The note is the load-bearing object.** The app *dims entries that don't have
one* (`EntryCard.jsx:96`) and tells you how long they've gone unwritten. Every
other read-later tool is a link graveyard that happily accepts infinite URLs and
asks nothing of you; this one's opinion is that **a saved link without a
takeaway is worthless**. Second differentiator: passage-level retrieval, so you
can find the sentence you half-remember rather than the document.

The product is **finds + ideas** — things you found and things you thought.
Historically that object is a **commonplace book**.

## One-liner, current draft

> Keep your best finds and ideas — and actually find them again.

The finds/find echo is deliberate; "keep" avoids stuttering on a synonym.
Alternate framing that tested well in conversation:

> Most note apps are where things go to be forgotten.
> Save what you find, write why it mattered, and get it back when you need it.

## Positioning

- **Copy Notion's *clarity*, not its positioning.** Clear one-line hero, real
  product screenshot above the fold, short demo, feature sections with images,
  plain sentences. That is just competent marketing craft.
- **Do not position as "Notion but simpler".** It invites the one question that
  cannot be won — *"why wouldn't I just use Notion?"* — and commits you to
  breadth as the promise, which means keeping all thirteen surfaces.
- **NotebookLM is the right foil. Google Keep is the wrong one.** Nobody resents
  Keep, they outgrow it. NotebookLM is genuinely in this space *and structurally
  capped*: notebooks hold 50 sources on the free tier, up to 500–600 on Ultra,
  with 100–500 chat interactions per plan. It is "assemble a corpus for this
  project, interrogate it, generate artifacts" — it cannot be eight years of
  everything you read, and you upload to it rather than capture into it.
- **mymind is the real competitor** ($5.99/mo, save anything in one click, AI
  auto-organises with no folders or tags, associative search). Its thesis is the
  **inverse** of ours, which is the sharpest contrast available: mymind is
  frictionless hoarding with good search; this is deliberate keeping.
- **Never say "second brain."** Correct concept, worn-out phrase — it was the
  pitch for Roam, Obsidian, Logseq, Mem, Tana, Reflect and Capacities, and the
  category's search results are mostly SEO listicles published by those
  companies. Let readers apply the label themselves.
- **Say the markdown mirror out loud.** The GitHub backup writes every entry as
  a plain file you own. That is most of the emotional benefit of local-first,
  already shipped, and currently mentioned nowhere.

## The name — shortlist, unresolved

Direction the user chose: the **tip-of-the-tongue phenomenon** — lethologica,
*presque vu*. It fits: the product resolves "I read something about this once…"

**Ruled out with research:**
- **Inkling** — ✗ Thinking Machines shipped an open-weight foundation model
  called Inkling on 2026-07-15 (TechCrunch, VentureBeat, HuggingFace). Also
  Inkling Systems (acquired by Echo360, 2024) whose product is literally
  *Inkling Knowledge*; a live USPTO software registration; an App Store app.
  Fatal for an AI-adjacent tool — you would be the other Inkling forever.
- **Letho / lethologica** — ✗ *lēthē* is the river of **forgetting**; naming a
  memory tool after oblivion, one letter from "lethal".
- **Recall** ✗ heavily used. **Refind** ✗ an existing link-saving product.

**Researched, viable but weak:**
- **Nib** — no software or category collision, and `nib.com` is listed for sale.
  But "nib" as a search term belongs to nib Group, an ASX-200 Australian health
  insurer that brands lowercase; plus The Nib (comics journalism, same pen
  imagery), two banks, and `.nib` as an old Apple file format. Failure mode is
  *findability*, not confusion — survivable with `nib.app` and link-driven
  traffic, but you would never own the search.

**Unresearched — do these before getting attached:**
- **Penumbra** ★ top pick. The partially lit edge of a shadow: neither dark nor
  clear, which *is* the half-remembered state. **"Pen" is the first syllable**,
  so it earns the ink association structurally rather than by luck. Known
  collisions: a horror game series and the novel *Mr. Penumbra's 24-Hour
  Bookstore* (flattering adjacency, not competition).
- **Almanac** — a book of collected useful things, kept because they would be
  wanted later. Strongest "thing you keep" name; no half-recall meaning.
- **Cusp** / **Verge** — "just about to", the tip-of-the-tongue moment stated
  plainly. Short, no teaching cost, likely contested.
- Also considered: Gloss, Findings, Commonplace, Winnow, Marginalia, Trove,
  Sift, Glimmer, Mneme, Aletheia/Alethe ("un-forgetting", the exact inversion of
  lethologica — beautiful, three syllables, needs teaching).

⚠️ Domains, trademarks and recent launches are **unchecked** for everything in
the unresearched list. Inkling was one search away from being a serious mistake;
do the pass before anything reaches the wordmark.

## Landing page — direction decided, not built

Drop the story-scroll for a direct page: *"if you're here you probably want to
try it"* → the basics → a screen recording → features with graphics. Traffic
comes from HN, YC, Twitter and Reddit, so build for the most sceptical of those:
one sentence, a demo watchable without signing up, honest mechanics, repo link
visible. The **voice** rules above stay correct; it is the *structure* that
changes.

Sequencing and open questions live in `docs/ui-polish.md` § Branding — chiefly
that the demo recording must wait for the type/font work, and that seeded demo
data is the largest unestimated piece (the real library is career applications
and interview prep, which cannot be filmed).

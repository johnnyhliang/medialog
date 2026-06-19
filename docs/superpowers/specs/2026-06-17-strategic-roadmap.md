# MediaLog — Strategic Roadmap & Competitive Moat

**Date:** 2026-06-17
**Status:** Living strategy doc (update as direction shifts)
**Companion to:** `2026-06-15-medialog-ultimate-vision.md`

This doc exists so the small feature plans don't drift. Every plan should advance one
of the loop stages below. If a feature doesn't, question whether to build it.

---

## The Loop (the actual product)

The thing nobody else closes end-to-end. Each competitor owns 1-2 stages and drops the rest.

```
   CAPTURE  →  TRIAGE  →  CONSUME  →  RETAIN  →  SYNTHESIZE
   (get in)   (place it)  (read it)  (remember) (connect it)
      │          │           │          │            │
   feeds,     Sort       Reader     SRS /        Living
   shortcut,  Inbox      mode +     Revisit      Topic Docs
   email,     (forced    highlights  2.0          + semantic
   paste      gate)                               links
```

**Why the loop is the moat:** Readwise nails CAPTURE→RETAIN but has no SYNTHESIZE.
Obsidian nails SYNTHESIZE but has no CAPTURE/CONSUME/RETAIN. Instapaper does CONSUME
only. Inoreader does CAPTURE (feeds) only. Nobody connects all five. A note that
flows capture→synthesize without leaving the app is the entire pitch.

---

## What people actually pay for (and our answer)

| Tool | The paid feature | What MediaLog does |
| :--- | :--- | :--- |
| **Readwise** | Highlights → daily review email | SRS Revisit 2.0 (built-in, no email needed) |
| **Readwise Sync** | Auto-export highlights → Notion/Obsidian/Anki | GitHub backup as Markdown (we already sync OUT); future: Anki export |
| **Reader** | Distraction-free read + inline highlight | Reader mode + Highlight layer (Phase 2-3) |
| **Instapaper** | Clean reading + offline | Full-text mirroring → offline + searchable |
| **Obsidian** | Bidirectional links + graph | AI-automated links (no manual burden) |
| **Notion** | Flexible docs + DB | Living Topic Docs (structured, auto-synthesized) |
| **Inoreader** | Feed aggregation + filter rules | Feed Gathering (Phase A below) |

**The Readwise Sync insight:** people pay $8/mo largely because Readwise is the
*connective tissue* — highlights auto-flow into the tool they already use. MediaLog's
equivalent is "Plain Text First": Markdown export/backup means we're never a silo.
That's a retention feature (no lock-in fear) AND a moat (we can be the hub others sync from).

---

## What we were missing (the "what else?" list)

Captured so we don't forget. Not all will be built — flagged by conviction.

1. **Feed gathering / RSS** — *high conviction.* The CAPTURE stage is currently
   manual (paste, shortcut). Following 20 sources via RSS turns MediaLog into the
   front door, not just the filing cabinet. Inoreader's whole business.
2. **Highlight layer** — *high conviction.* Readwise's core loop. Select text in
   Reader → saves as a child entry linked to the source. Feeds SRS.
3. **Reader mode** — *high conviction.* Prerequisite for highlights. Full-text
   mirror already planned (enrich → body text).
4. **SRS / spaced repetition** — *high conviction.* Revisit 2.0 with SM2. Converts
   the graveyard into memory. This is "retention is the product."
5. **Semantic search / RAG chat** — *medium.* "Ask my library" — chat over your own
   notes via embeddings. The AI infra (Plan 7) is the foundation.
6. **Browser extension** — *medium.* One-click capture from desktop (the iOS
   Shortcut equivalent for laptop). Lowers CAPTURE friction.
7. **Newsletter terminal** — *medium.* Private `@medialog` email → entries. From vision doc.
8. **Anki / SRS export** — *low-medium.* For people already living in Anki.
9. **Public sharing / digital garden** — *low.* Publish a topic as a read-only page.
   Nice-to-have, not core to the loop.
10. **Podcast / audio + transcript** — *low.* Expands ingestion to audio. Later.
11. **OCR physical capture** — *low.* From vision doc. Cool, niche.
12. **Note-taking sync (Notion / Obsidian / Roam)** — *future consideration.* The actual
    Readwise paid driver: highlights/entries auto-flow INTO the tool you already use, two-way
    or one-way. We already sync OUT as Markdown via GitHub backup — this generalizes it to
    named integrations. High moat potential; scope later as its own project.
13. **Advanced / media parsing** — *future consideration.* Beyond full-text mirror (Phase A):
    EPUBs, newsletters, and **YouTube transcript highlighting** (highlight straight from the
    video's text), enhanced article/newsletter readability parsing. This is Readwise Reader's
    "Media Parsing" feature. Builds on the Phase A full-text mirror; broaden later.
14. **Top-level visual organization** — *near-term, scope after Phase 0.* A visual layer
    ABOVE the flat topic list — e.g. a board/grid/grouped view, pinned/favorite topics,
    color or icon per topic, collapsible topic groups. Directly addresses "topic list just
    gets really long." Distinct from Living Topic Docs (which fixes *within*-topic loss);
    this fixes *across*-topic navigation. Must not violate the flat-topics philosophy —
    grouping is a visual/organizational overlay, not real nesting.
15. **Archive for stale entries** — *near-term, scope after Phase 0.* A dedicated archive
    state (distinct from Trash/soft-delete) for entries that are old, read, or no longer
    relevant but worth keeping. Keeps active topic views clean without deletion. Pairs with
    the age display already on cards and the SRS "done" concept. Anti-graveyard: archiving is
    a triage outcome, not a dead end.

---

## Sequenced phases (what advances the loop fastest)

Ordered by leverage, not difficulty. Each is its own brainstorm → spec → plan cycle.

### Phase 0 — Stop the bleeding (NOW)
The "skeleton UI" + "topics getting long, notes getting lost" problem. This is
ACTIVE pain that contradicts the whole point. **→ Living Topic Docs** (master
markdown doc per topic + grouping so notes don't get lost) + editor polish.
*This is the next thing we scope.*

### Phase 0.5 — Organization & cleanup (right after Phase 0)
Fixes navigation/clutter ACROSS topics, complementing Living Topic Docs' within-topic fix.
- **Top-level visual organization** (#14) — board/grouped/pinned view above the topic list.
- **Archive for stale entries** (#15) — archive state distinct from Trash; keeps views clean.

### Phase A — Close the read→retain loop
1. **Full-text mirror** — `enrich` fetches body text, stored + searchable offline.
2. **Reader mode** — distraction-free view of mirrored text / PDFs.
3. **Highlight layer** — select in Reader → child highlight entry.
4. **SRS Revisit 2.0** — SM2 over highlights. The retention payoff.

### Phase B — Become the front door
5. **Feed gathering (RSS)** — follow sources, new items land in Inbox for triage.
6. **Browser extension** — one-click desktop capture.

### Phase C — The synthesis moat
7. **Semantic links** — embeddings → "related entries across topics."
8. **AI-synthesized topic docs** — the Living Topic Doc gets auto-drafted by AI.
9. **RAG chat** — "ask my library."

### Phase D — Reach
10. Newsletter terminal, Anki export, public sharing, audio/OCR.
11. **Note-taking sync** (#12) — Notion/Obsidian/Roam integrations. Generalizes GitHub backup.
12. **Advanced/media parsing** (#13) — EPUB, newsletter, YouTube transcript highlighting.

---

## Specs on file (reference index)

Detailed specs for future work, mapped to phases. Check here before scoping any feature
— a spec may already exist.

| Spec | Phase | What it covers |
| :--- | :---- | :------------- |
| [`2026-06-19-anti-clutter-quality-gates.md`](2026-06-19-anti-clutter-quality-gates.md) | **Phase 0.5** | Fuzzy duplicate detection at capture, empty-note aging warnings, Done takeaway prompt, `maybe` status, alternative views (list / kanban / table) |
| [`2026-06-19-tuxedo-analysis.md`](2026-06-19-tuxedo-analysis.md) | **Phase 0.5 / A** | Command palette (`Ctrl-P`), full keyboard navigation layer, saved search shortcuts, natural-language capture, snooze-to-date, density toggle — TUI patterns worth stealing |
| [`2026-06-19-entry-version-history.md`](2026-06-19-entry-version-history.md) | **Phase A** | Session-based snapshots (not keystroke-level), thinning strategy, version-history drawer UI, schema extension of existing `entry_versions` table |
| [`2026-06-17-file-preview-design.md`](2026-06-17-file-preview-design.md) | **Phase A** | File attachment previews — PDF, image, video inline in entry |
| [`2026-06-17-living-topic-docs-design.md`](2026-06-17-living-topic-docs-design.md) | **Phase 0** | Living topic docs design spec (master doc per topic) |
| [`2026-06-19-dashboard-design.md`](2026-06-19-dashboard-design.md) | **Phase 0.5** | Dashboard home view — inbox card, movers widget, Morning Brew digest, TickTick-style quick-add |

---

## Guardrails (from core philosophy — don't violate)

- **Triage is mandatory.** Every new CAPTURE source (feeds, email) MUST dump into
  the Inbox for the forced Sort gate. Never auto-file. The gate is the anti-graveyard.
- **Retention is the product.** A feature that adds capture without adding retention
  makes the graveyard worse. Weight retention work accordingly.
- **Plain Text First.** Everything exportable as Markdown. No lock-in. This is both
  philosophy and moat.
- **Source ≠ System.** Feeds/inboxes are noise until triaged into a Topic.

---

## Next action

Scope **Living Topic Docs** (Phase 0) — master document per topic + UI so notes
stop getting lost. Separate brainstorm session.

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

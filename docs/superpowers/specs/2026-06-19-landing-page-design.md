# MediaLog Landing Page — Design Spec

**Date:** 2026-06-19
**Status:** Approved design, pre-implementation
**Route:** `/landing.html` — standalone self-contained file, not part of the React app

---

## Overview

A public-facing product landing page targeting potential users of the open source MediaLog PWA. Primary goal: get visitors to open the app or star the GitHub repo. Tone: premium, editorial, earnest — not SaaS sales copy. Modeled after tool landing pages like Linear, Craft, Obsidian.

**Two CTAs throughout:**
- Primary: `Open App` → deployed PWA URL
- Secondary: `View on GitHub` → GitHub repo URL

---

## Technical Constraints

- **Self-contained single HTML file** — no build step, no React, no bundler
- **Inline CSS + vanilla JS only**
- **External dependencies allowed:** Google Fonts CDN (Lora + DM Sans, already used by the app), `picsum.photos` for image placeholders
- **Animations:** CSS only where possible; vanilla JS only for scroll-triggered reveals
- **Performance:** No blocking scripts, images lazy-loaded, fonts with `display=swap`
- **Deployed alongside the app** — lives at `/landing` or `/landing.html` on the same host

---

## Design Tokens (match the app exactly)

```css
--bg:          #F8F5EE;
--surface:     #FFFFFF;
--surface-2:   #F2EDE3;
--border:      #DDD7CB;
--text:        #1C1A15;
--muted:       #7A7264;
--accent:      #3D5A4A;
--font-ui:     'DM Sans', system-ui, sans-serif;
--font-serif:  'Lora', Georgia, serif;
```

Dark hero uses `--text` (`#1C1A15`) as background with off-white text.

---

## Animations

**Ambient hero background:** 3 slow-moving blurred color orbs behind the mockup.
- Orb 1: `#3D5A4A` (accent green), ~300px, 20s loop
- Orb 2: `#B85C1A` (warm amber from `--active`), ~250px, 25s loop
- Orb 3: `#F8F5EE` (off-white), ~200px, 30s loop
- All at ~12% opacity, `filter: blur(80px)`, `border-radius: 50%`
- CSS `@keyframes` translate on X/Y axes, no JS needed

**Scroll reveals:** IntersectionObserver on all major content sections. Class `reveal` → `visible` transition: `opacity 0 → 1`, `translateY(20px) → 0`, duration 0.5s, easing `ease-out`. No per-character animations, nothing jarring.

**Mockup load:** fades in + drifts up 12px over 0.8s on page load, 0.2s delay.

**Loop step highlight:** as user scrolls through Section 3, each step lights up with `--accent` color sequentially via IntersectionObserver on the section.

---

## Section Breakdown

### Section 1 — Hero (dark)

Background: `#1C1A15`. Full viewport height minimum.

**Layout (centered, single column, max-width 720px):**

1. **Eyebrow** — DM Sans, 11px, letter-spacing 0.12em, uppercase, color `#3D5A4A`:
   `OPEN SOURCE  ·  FREE`

2. **Headline** — Lora serif, ~60px desktop / 38px mobile, off-white (`#F8F5EE`), line-height 1.2:
   `"The fourth bucket."`
   *(placeholder — copy to be revised)*

3. **Subheadline** — DM Sans, 18px, color `#7A7264` (muted), line-height 1.6, max-width 520px:
   `"A personal knowledge system for links, notes, and ideas — organized by topic and actually revisited."`
   *(placeholder)*

4. **CTAs** — row, gap 12px:
   - `Open App` — solid `#3D5A4A` bg, off-white text, 44px height, 20px h-padding, border-radius 8px
   - `View on GitHub` — ghost, off-white border, off-white text, same size

5. **Ambient orbs** — absolutely positioned behind everything, `z-index: 0`, content `z-index: 1`

6. **Mockup** — browser chrome frame (pill-shaped top bar with 3 traffic-light dots, rounded-12px frame, subtle `box-shadow: 0 40px 80px rgba(0,0,0,0.5)`). Contains a `picsum.photos` image sized to approximate the app's card grid (e.g. `https://picsum.photos/seed/medialog/1200/750`). Max-width 900px, centered, margin-top 48px. Fades in on load.

---

### Section 2 — The Problem (off-white)

Background: `--bg` (`#F8F5EE`). Padding: 96px vertical.

**Layout: two columns, max-width 960px, centered.**

- **Left** (40%): Large Lora italic quote, ~36px, `--text`:
  `"A source is not a system."`
  Small DM Sans attribution below: `— MediaLog`

- **Right** (60%): 3 short paragraphs in DM Sans 16px, `--text`:
  - Browser tabs are not a system (placeholder copy)
  - The "save for later" graveyard problem (placeholder copy)
  - MediaLog is the system, not another inbox (placeholder copy)

Scroll reveal: left fades in from left (-20px X), right fades in from right (+20px X), simultaneously.

---

### Section 3 — The Loop (surface-2)

Background: `--surface-2` (`#F2EDE3`). Padding: 80px vertical.

**Header:** centered, DM Sans caps eyebrow + Lora headline:
`"Capture. Triage. Consume. Retain. Synthesize."`

**5-step row** (horizontal on desktop, vertical stack on mobile):
Each step: icon placeholder (32px lucide-style SVG outline, accent green), bold DM Sans step name, one-line DM Sans description in muted. Steps separated by a thin right-arrow `→` in muted color.

Steps:
1. **Capture** — "Links, shortcuts, bulk paste"
2. **Triage** — "Sort Inbox forces placement"
3. **Consume** — "Reader mode, status tracking"
4. **Retain** — "Spaced revisit, SRS"
5. **Synthesize** — "Living topic docs, AI"

Scroll behavior: as Section 3 enters viewport, each step lights up sequentially (0.15s stagger) — label color shifts from `--muted` to `--accent`, icon strokes brighten.

---

### Section 4 — Features (white)

Background: `--surface` (`#FFFFFF`). Padding: 96px vertical.

**Header:** centered, Lora 36px headline: `"Everything in one loop."`

**3 feature cards** in a row (stack on mobile), max-width 1040px:

Each card (`--surface-2` bg, border-radius 12px, padding 28px, subtle border):
- **Image placeholder** — `picsum.photos` image, 100% width, height 200px, object-fit cover, border-radius 8px, lazy-loaded. Seeds: `inbox`, `topics`, `revisit`
- **Title** — Lora 20px: feature name
- **Description** — DM Sans 14px muted: 2-line description

Cards:
1. **Sort Inbox** — `picsum.photos/seed/inbox/600/300` — "Triage everything before it enters your library. Nothing hides in the backlog."
2. **Living Topic Docs** — `picsum.photos/seed/topics/600/300` — "A master document per topic synthesizes your entries into a running reference."
3. **Revisit Feed** — `picsum.photos/seed/revisit/600/300` — "Surfaces the least-recently-seen entries so nothing rots."

Scroll reveal: cards stagger in with 0.1s delay between each.

---

### Section 5 — Open Source (dark)

Background: `#1C1A15` (mirrors hero, bookends the page). Padding: 96px vertical.

**Centered, max-width 600px:**

- Eyebrow (same style as hero): `MIT LICENSE  ·  OPEN SOURCE`
- Headline (Lora, 40px, off-white): `"Built in the open."`
- Body (DM Sans, 16px, muted): 2 sentences about being open source, self-hostable, plain-text underneath. (placeholder)
- Single CTA: `View on GitHub` — ghost white button

---

### Section 6 — Footer (off-white)

Background: `--bg`. Padding: 32px vertical. Border-top: `1px solid --border`.

**Single row, space-between:**
- Left: `MediaLog` in Lora italic, `--muted` color
- Right: two links in DM Sans 13px — `Open App` · `GitHub`

---

## Responsive Behavior

- **Breakpoint: 768px**
- Hero headline: 60px → 36px
- Section 2 two-column → single column (quote above, text below)
- Loop 5-step row → vertical stack
- Feature cards 3-col → single column
- Mockup: full width, horizontal scroll disabled

---

## File Structure

```
/landing.html   ← single self-contained file
```

All CSS in a `<style>` block in `<head>`. All JS in a `<script>` block before `</body>`. Google Fonts loaded via `<link>` in `<head>`. No other external files.

---

## Copy Note

All copy in this spec is placeholder. Wording to be revised before shipping. Structure and layout are fixed; only the text content is variable.

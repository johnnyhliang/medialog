# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained `public/landing.html` product landing page for MediaLog with 6 sections, ambient animations, and scroll-triggered reveals.

**Architecture:** Single HTML file in `/public` (served as `/landing.html` by Vite). All CSS inline in `<style>`, all JS inline in `<script>`. No build step, no React, no external files except Google Fonts CDN and picsum.photos for placeholder images.

**Tech Stack:** HTML5, CSS3 (custom properties, keyframes, IntersectionObserver), vanilla JS ES6

## Global Constraints

- File location: `public/landing.html` (Vite serves `/public` statically — accessible at `/landing.html`)
- Zero external JS dependencies — no libraries, no CDN scripts
- Google Fonts CDN link allowed: Lora + DM Sans (same as main app)
- Image placeholders: `picsum.photos` with named seeds — never gray boxes or blank space
- All CTAs use `href="#"` as placeholder — copy and URLs are intentionally placeholder throughout
- Self-contained: removing this file has zero impact on the React app
- No co-authored-by trailers in commits

---

## File Structure

```
public/
  landing.html    ← create: the entire landing page
```

One file. Tasks build it section by section, each task appends to the growing file. Final task wires the JS.

---

### Task 1: HTML Scaffold — head, tokens, reset, reveal CSS

**Files:**
- Create: `public/landing.html`

**Produces:** A valid HTML file that renders a blank `--bg` colored page with correct fonts loading. The `.reveal` / `.reveal-child` animation classes are defined and ready for later tasks.

- [ ] **Step 1: Create `public/landing.html` with the full scaffold**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MediaLog — The fourth bucket.</title>
  <meta name="description" content="A personal knowledge system for links, notes, and ideas — organized by topic and actually revisited." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet" />
  <style>
    /* ── Tokens ──────────────────────────────────────────────────────────── */
    :root {
      --bg:        #F8F5EE;
      --surface:   #FFFFFF;
      --surface-2: #F2EDE3;
      --border:    #DDD7CB;
      --text:      #1C1A15;
      --muted:     #7A7264;
      --accent:    #3D5A4A;
      --amber:     #B85C1A;
      --dark:      #1C1A15;
      --font-ui:   'DM Sans', system-ui, sans-serif;
      --font-serif:'Lora', Georgia, serif;
    }

    /* ── Reset ───────────────────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-ui);
      font-size: 16px;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    img { display: block; max-width: 100%; }
    a { color: inherit; text-decoration: none; }

    /* ── Shared layout ───────────────────────────────────────────────────── */
    .container { max-width: 960px; margin: 0 auto; }

    /* ── Shared typography ───────────────────────────────────────────────── */
    .eyebrow {
      font-family: var(--font-ui);
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 16px;
    }
    .section-eyebrow {
      font-family: var(--font-ui);
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--accent);
      text-align: center;
      margin-bottom: 12px;
    }
    .section-headline {
      font-family: var(--font-serif);
      font-size: clamp(24px, 3.5vw, 36px);
      color: var(--text);
      text-align: center;
      margin-bottom: 56px;
      line-height: 1.3;
    }

    /* ── Shared buttons ──────────────────────────────────────────────────── */
    .btn {
      display: inline-flex;
      align-items: center;
      font-family: var(--font-ui);
      font-size: 15px;
      font-weight: 500;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.15s;
      border: none;
    }
    .btn:hover { opacity: 0.85; transform: translateY(-1px); }
    .btn-primary { background: var(--accent); color: #F8F5EE; }
    .btn-ghost-dark {
      background: transparent;
      color: #F8F5EE;
      border: 1px solid rgba(248,245,238,0.3);
    }
    .btn-ghost-dark:hover { border-color: rgba(248,245,238,0.6); }

    /* ── Scroll reveals ──────────────────────────────────────────────────── */
    .reveal {
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.55s ease-out, transform 0.55s ease-out;
    }
    .reveal.visible { opacity: 1; transform: translateY(0); }
    .reveal-child {
      opacity: 0;
      transform: translateY(16px);
      transition: opacity 0.4s ease-out, transform 0.4s ease-out;
    }
    .reveal-child.visible { opacity: 1; transform: translateY(0); }

    /* ── Orb shared ──────────────────────────────────────────────────────── */
    .orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      pointer-events: none;
    }
    @keyframes float1 {
      0%, 100% { transform: translate(0, 0); }
      33%       { transform: translate(40px, -30px); }
      66%       { transform: translate(-20px, 20px); }
    }
    @keyframes float2 {
      0%, 100% { transform: translate(0, 0); }
      33%       { transform: translate(-50px, 20px); }
      66%       { transform: translate(30px, -40px); }
    }
    @keyframes float3 {
      0%, 100% { transform: translate(0, 0); }
      50%       { transform: translate(-30px, -20px); }
    }
  </style>
</head>
<body>

  <!-- sections go here in subsequent tasks -->

  <script>
    /* JS goes here in Task 5 */
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

Open `public/landing.html` directly in a browser (double-click the file or use `npx serve public`).
Expected: blank page with `--bg` warm off-white background, no console errors, Google Fonts loading in Network tab.

- [ ] **Step 3: Commit**

```bash
git add public/landing.html
git commit -m "feat: landing page scaffold — tokens, reset, reveal classes"
```

---

### Task 2: Hero Section

**Files:**
- Modify: `public/landing.html` — add hero HTML between `<body>` and `<script>`, add hero CSS inside `<style>`

**Consumes:** `.orb`, `@keyframes float1/2/3`, `.eyebrow`, `.btn`, `.btn-primary`, `.btn-ghost-dark` from Task 1
**Produces:** Full-viewport dark hero with animated orbs, headline, CTAs, and browser-framed mockup image

- [ ] **Step 1: Add hero CSS inside `<style>` before `</style>`**

```css
/* ── Hero ────────────────────────────────────────────────────────────────── */
.hero {
  background: var(--dark);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  padding: 80px 24px;
}
.orb-1 {
  width: 320px; height: 320px;
  background: #3D5A4A; opacity: 0.12;
  top: 15%; left: 10%;
  animation: float1 20s ease-in-out infinite;
}
.orb-2 {
  width: 260px; height: 260px;
  background: #B85C1A; opacity: 0.10;
  top: 45%; right: 8%;
  animation: float2 25s ease-in-out infinite;
}
.orb-3 {
  width: 200px; height: 200px;
  background: #F8F5EE; opacity: 0.06;
  bottom: 15%; left: 38%;
  animation: float3 30s ease-in-out infinite;
}
.hero-content {
  position: relative;
  z-index: 1;
  text-align: center;
  max-width: 820px;
  width: 100%;
}
.hero .eyebrow { color: var(--accent); margin-bottom: 20px; }
.hero-headline {
  font-family: var(--font-serif);
  font-size: clamp(36px, 6vw, 64px);
  font-weight: 600;
  color: #F8F5EE;
  line-height: 1.1;
  margin-bottom: 20px;
}
.hero-sub {
  font-family: var(--font-ui);
  font-size: clamp(15px, 2vw, 18px);
  color: var(--muted);
  line-height: 1.75;
  max-width: 520px;
  margin: 0 auto 36px;
}
.cta-row {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 56px;
  flex-wrap: wrap;
}
.mockup-wrap {
  opacity: 0;
  transform: translateY(12px);
  animation: mockupIn 0.8s ease-out 0.3s forwards;
}
@keyframes mockupIn {
  to { opacity: 1; transform: translateY(0); }
}
.mockup-frame {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 40px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.07);
  max-width: 900px;
  margin: 0 auto;
}
.mockup-chrome {
  background: #2A2722;
  padding: 10px 16px;
  display: flex;
  gap: 7px;
  align-items: center;
}
.dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: rgba(255,255,255,0.14);
}
.mockup-frame img {
  width: 100%;
  display: block;
  height: 480px;
  object-fit: cover;
  object-position: top;
}
```

- [ ] **Step 2: Add hero HTML between `<body>` and `<script>`**

```html
<!-- ── Hero ─────────────────────────────────────────────────────────────── -->
<section class="hero">
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>
  <div class="orb orb-3"></div>
  <div class="hero-content">
    <p class="eyebrow">Open Source &nbsp;·&nbsp; Free</p>
    <h1 class="hero-headline">The fourth bucket.</h1>
    <p class="hero-sub">
      A personal knowledge system for links, notes, and ideas —
      organized by topic and actually revisited.
    </p>
    <div class="cta-row">
      <a href="#" class="btn btn-primary">Open App</a>
      <a href="#" class="btn btn-ghost-dark">View on GitHub</a>
    </div>
    <div class="mockup-wrap">
      <div class="mockup-frame">
        <div class="mockup-chrome">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
        <img
          src="https://picsum.photos/seed/medialog/1200/750"
          alt="MediaLog app interface"
          loading="lazy"
        />
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Verify in browser**

Open `public/landing.html`. Expected:
- Dark full-viewport hero section
- Three blurred color orbs gently moving (barely visible)
- Off-white headline, muted subheadline
- Two CTA buttons side by side
- Browser chrome frame with picsum image fading in and drifting up
- No layout overflow or horizontal scroll

- [ ] **Step 4: Commit**

```bash
git add public/landing.html
git commit -m "feat: landing hero — dark bg, ambient orbs, browser mockup"
```

---

### Task 3: Problem + Loop Sections

**Files:**
- Modify: `public/landing.html` — append two sections after hero, add CSS

**Consumes:** `.container`, `.section-eyebrow`, `.section-headline`, `.reveal`, `.orb` keyframes from Task 1
**Produces:** Off-white two-column problem section + surface-2 five-step loop section with scroll-highlight hooks

- [ ] **Step 1: Add Problem + Loop CSS inside `<style>` before `</style>`**

```css
/* ── Problem ─────────────────────────────────────────────────────────────── */
.problem { background: var(--bg); padding: 96px 24px; }
.problem-grid {
  display: grid;
  grid-template-columns: 2fr 3fr;
  gap: 64px;
  align-items: center;
}
.problem-quote blockquote {
  font-family: var(--font-serif);
  font-size: clamp(22px, 2.8vw, 34px);
  font-style: italic;
  color: var(--text);
  line-height: 1.35;
  margin-bottom: 14px;
}
.problem-quote cite {
  font-family: var(--font-ui);
  font-size: 13px;
  color: var(--muted);
  font-style: normal;
}
.problem-text p {
  font-family: var(--font-ui);
  font-size: 16px;
  color: var(--text);
  line-height: 1.8;
  margin-bottom: 18px;
}
.problem-text p:last-child { margin-bottom: 0; }

/* ── Loop ────────────────────────────────────────────────────────────────── */
.loop { background: var(--surface-2); padding: 80px 24px; }
.loop-steps {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 0;
}
.loop-arrow {
  font-size: 18px;
  color: var(--border);
  padding: 0 6px;
  margin-top: 30px;
  flex-shrink: 0;
  user-select: none;
}
.loop-step {
  text-align: center;
  padding: 18px 12px;
  border-radius: 10px;
  flex: 1;
  min-width: 0;
  transition: background 0.35s ease;
}
.loop-step.active { background: rgba(61,90,74,0.09); }
.loop-icon {
  font-size: 22px;
  margin-bottom: 10px;
  color: var(--border);
  transition: color 0.35s ease;
  line-height: 1;
}
.loop-step.active .loop-icon { color: var(--accent); }
.loop-step-name {
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 6px;
  transition: color 0.35s ease;
}
.loop-step.active .loop-step-name { color: var(--accent); }
.loop-step-desc {
  font-family: var(--font-ui);
  font-size: 11.5px;
  color: var(--muted);
  line-height: 1.55;
}
```

- [ ] **Step 2: Append Problem + Loop HTML after the `</section>` closing tag of the hero**

```html
<!-- ── Problem ──────────────────────────────────────────────────────────── -->
<section class="problem reveal">
  <div class="container">
    <div class="problem-grid">
      <div class="problem-quote">
        <blockquote>"A source is not<br>a system."</blockquote>
        <cite>— MediaLog</cite>
      </div>
      <div class="problem-text">
        <p>Your browser tabs are not a reading list. Your "Save for later" folder is a graveyard. Bookmarks are where links go to die.</p>
        <p>The problem isn't capture — it's what happens after. Nothing gets revisited. Nothing gets synthesized. Nothing gets remembered.</p>
        <p>MediaLog is the system, not another inbox. Every link is placed in a topic, triaged, consumed, and revisited on a schedule that builds retention.</p>
      </div>
    </div>
  </div>
</section>

<!-- ── Loop ─────────────────────────────────────────────────────────────── -->
<section class="loop reveal" id="loop">
  <div class="container">
    <p class="section-eyebrow">How it works</p>
    <h2 class="section-headline">Capture. Triage. Consume.<br>Retain. Synthesize.</h2>
    <div class="loop-steps">
      <div class="loop-step" data-step="0">
        <div class="loop-icon">↓</div>
        <div class="loop-step-name">Capture</div>
        <div class="loop-step-desc">Links, shortcuts,<br>bulk paste</div>
      </div>
      <div class="loop-arrow">→</div>
      <div class="loop-step" data-step="1">
        <div class="loop-icon">⊞</div>
        <div class="loop-step-name">Triage</div>
        <div class="loop-step-desc">Sort Inbox<br>forces placement</div>
      </div>
      <div class="loop-arrow">→</div>
      <div class="loop-step" data-step="2">
        <div class="loop-icon">◎</div>
        <div class="loop-step-name">Consume</div>
        <div class="loop-step-desc">Reader mode,<br>status tracking</div>
      </div>
      <div class="loop-arrow">→</div>
      <div class="loop-step" data-step="3">
        <div class="loop-icon">↺</div>
        <div class="loop-step-name">Retain</div>
        <div class="loop-step-desc">Spaced revisit,<br>SRS</div>
      </div>
      <div class="loop-arrow">→</div>
      <div class="loop-step" data-step="4">
        <div class="loop-icon">✦</div>
        <div class="loop-step-name">Synthesize</div>
        <div class="loop-step-desc">Living topic docs,<br>AI</div>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Verify in browser**

Scroll past hero. Expected:
- Off-white problem section with Lora italic quote on the left, body text on the right
- Surface-2 loop section with five steps in a row, separated by arrows
- Steps are initially muted (will light up once JS is wired in Task 5)
- Both sections start invisible (`.reveal` class — will animate once JS is wired)

- [ ] **Step 4: Commit**

```bash
git add public/landing.html
git commit -m "feat: landing problem + loop sections"
```

---

### Task 4: Features + Open Source + Footer Sections

**Files:**
- Modify: `public/landing.html` — append three sections after loop, add CSS

**Consumes:** `.container`, `.section-eyebrow`, `.section-headline`, `.reveal`, `.reveal-child`, `.orb`, `@keyframes float1/2` from Task 1; `.btn`, `.btn-ghost-dark` from Task 1; `.eyebrow` from Task 1
**Produces:** White 3-card features section, dark open source section, minimal footer

- [ ] **Step 1: Add Features + Open Source + Footer CSS inside `<style>` before `</style>`**

```css
/* ── Features ────────────────────────────────────────────────────────────── */
.features { background: var(--surface); padding: 96px 24px; }
.feature-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}
.feature-card {
  background: var(--surface-2);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  transition: box-shadow 0.25s, transform 0.25s;
}
.feature-card:hover {
  box-shadow: 0 8px 32px rgba(0,0,0,0.08);
  transform: translateY(-3px);
}
.feature-card img {
  width: 100%;
  height: 200px;
  object-fit: cover;
  display: block;
}
.feature-card-body { padding: 24px 22px; }
.feature-card-body h3 {
  font-family: var(--font-serif);
  font-size: 19px;
  color: var(--text);
  margin-bottom: 8px;
  line-height: 1.3;
}
.feature-card-body p {
  font-family: var(--font-ui);
  font-size: 13.5px;
  color: var(--muted);
  line-height: 1.65;
}

/* ── Open Source ─────────────────────────────────────────────────────────── */
.opensource {
  background: var(--dark);
  padding: 96px 24px;
  text-align: center;
  position: relative;
  overflow: hidden;
}
.orb-os-1 {
  width: 320px; height: 320px;
  background: #3D5A4A; opacity: 0.10;
  top: -80px; right: 8%;
  animation: float1 22s ease-in-out infinite;
}
.orb-os-2 {
  width: 220px; height: 220px;
  background: #B85C1A; opacity: 0.08;
  bottom: -60px; left: 12%;
  animation: float2 28s ease-in-out infinite;
}
.opensource-content {
  position: relative;
  z-index: 1;
  max-width: 580px;
  margin: 0 auto;
}
.opensource .eyebrow { margin-bottom: 20px; }
.opensource-headline {
  font-family: var(--font-serif);
  font-size: clamp(28px, 4vw, 44px);
  color: #F8F5EE;
  margin-bottom: 20px;
  line-height: 1.2;
}
.opensource-sub {
  font-family: var(--font-ui);
  font-size: 16px;
  color: var(--muted);
  line-height: 1.8;
  margin-bottom: 36px;
}

/* ── Footer ──────────────────────────────────────────────────────────────── */
.footer {
  background: var(--bg);
  border-top: 1px solid var(--border);
  padding: 28px 24px;
}
.footer-inner {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.footer-brand {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 18px;
  color: var(--muted);
}
.footer-links { display: flex; gap: 24px; }
.footer-links a {
  font-family: var(--font-ui);
  font-size: 13px;
  color: var(--muted);
  transition: color 0.2s;
}
.footer-links a:hover { color: var(--text); }
```

- [ ] **Step 2: Append Features + Open Source + Footer HTML after the loop `</section>`**

```html
<!-- ── Features ─────────────────────────────────────────────────────────── -->
<section class="features reveal">
  <div class="container">
    <p class="section-eyebrow">Features</p>
    <h2 class="section-headline">Everything in one loop.</h2>
    <div class="feature-cards">
      <div class="feature-card reveal-child">
        <img
          src="https://picsum.photos/seed/inbox/600/300"
          alt="Sort Inbox feature"
          loading="lazy"
        />
        <div class="feature-card-body">
          <h3>Sort Inbox</h3>
          <p>Triage everything before it enters your library. Nothing hides in the backlog unexamined.</p>
        </div>
      </div>
      <div class="feature-card reveal-child">
        <img
          src="https://picsum.photos/seed/topics/600/300"
          alt="Living Topic Docs feature"
          loading="lazy"
        />
        <div class="feature-card-body">
          <h3>Living Topic Docs</h3>
          <p>A master document per topic synthesizes your entries into a running reference you actually use.</p>
        </div>
      </div>
      <div class="feature-card reveal-child">
        <img
          src="https://picsum.photos/seed/revisit/600/300"
          alt="Revisit Feed feature"
          loading="lazy"
        />
        <div class="feature-card-body">
          <h3>Revisit Feed</h3>
          <p>Surfaces the least-recently-seen entries so nothing rots. Retention is the product.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ── Open Source ───────────────────────────────────────────────────────── -->
<section class="opensource reveal">
  <div class="orb orb-os-1"></div>
  <div class="orb orb-os-2"></div>
  <div class="opensource-content">
    <p class="eyebrow">MIT License &nbsp;·&nbsp; Open Source</p>
    <h2 class="opensource-headline">Built in the open.</h2>
    <p class="opensource-sub">
      MediaLog is free, open source, and self-hostable.
      Your data stays yours — exportable as plain Markdown,
      backed up to GitHub, never locked in a proprietary silo.
    </p>
    <a href="#" class="btn btn-ghost-dark">View on GitHub</a>
  </div>
</section>

<!-- ── Footer ────────────────────────────────────────────────────────────── -->
<footer class="footer">
  <div class="footer-inner">
    <span class="footer-brand">MediaLog</span>
    <nav class="footer-links">
      <a href="#">Open App</a>
      <a href="#">GitHub</a>
    </nav>
  </div>
</footer>
```

- [ ] **Step 3: Verify in browser**

Scroll to the bottom. Expected:
- White features section: 3 cards in a row, each with a picsum image, Lora title, muted description text
- Cards lift subtly on hover
- Dark open source section mirroring the hero with two orbs
- Minimal footer with italic brand name and two links
- No horizontal overflow at any scroll position

- [ ] **Step 4: Commit**

```bash
git add public/landing.html
git commit -m "feat: landing features, open source, footer sections"
```

---

### Task 5: Vanilla JS — Scroll Reveals + Loop Highlight

**Files:**
- Modify: `public/landing.html` — replace the `/* JS goes here in Task 5 */` comment inside `<script>` with the full JS

**Consumes:**
- `.reveal` and `.reveal-child` CSS classes from Task 1
- `.loop-step` elements with `data-step` attributes from Task 3
- `#loop` section id from Task 3

**Produces:** Working IntersectionObserver scroll reveals on all `.reveal` sections; staggered `.reveal-child` children; one-shot sequential loop step activation on scroll

- [ ] **Step 1: Replace the `<script>` block content with the following**

```js
(function () {
  'use strict';

  /* ── Scroll reveals ─────────────────────────────────────────────────── */
  const revealEls = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');

      // Stagger any .reveal-child elements inside this section
      var children = entry.target.querySelectorAll('.reveal-child');
      children.forEach(function (child, i) {
        child.style.transitionDelay = (i * 0.1) + 's';
        child.classList.add('visible');
      });

      // Unobserve — reveal fires once only
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  revealEls.forEach(function (el) { revealObserver.observe(el); });

  /* ── Loop step sequential highlight ────────────────────────────────── */
  var loopSection = document.getElementById('loop');
  var loopSteps   = document.querySelectorAll('.loop-step');
  var loopFired   = false;

  var loopObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting || loopFired) return;
      loopFired = true;

      loopSteps.forEach(function (step, i) {
        setTimeout(function () {
          step.classList.add('active');
        }, i * 150);
      });

      loopObserver.unobserve(loopSection);
    });
  }, { threshold: 0.3 });

  if (loopSection) loopObserver.observe(loopSection);
})();
```

- [ ] **Step 2: Verify in browser — full scroll test**

Open `public/landing.html` and scroll slowly from top to bottom. Expected:
- **Problem section**: fades up and into view when it enters the viewport
- **Loop section**: fades in, then each of the 5 steps lights up green one at a time with ~150ms stagger (fires once, does not reset on scroll back)
- **Features section**: fades in, then the 3 cards stagger in with 100ms delay between each
- **Open Source section**: fades in on scroll
- All animations fire exactly once — scrolling back up and down does not re-trigger

- [ ] **Step 3: Commit**

```bash
git add public/landing.html
git commit -m "feat: landing scroll reveals + loop highlight via IntersectionObserver"
```

---

### Task 6: Responsive CSS

**Files:**
- Modify: `public/landing.html` — append responsive media query block inside `<style>` before `</style>`

**Consumes:** All section classes from Tasks 2–4
**Produces:** Fully responsive layout at 768px breakpoint — all multi-column layouts collapse, hero type scales down, loop steps stack vertically

- [ ] **Step 1: Append the following inside `<style>` before `</style>`**

```css
/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  /* Hero */
  .cta-row { flex-direction: column; align-items: center; }
  .btn { width: 100%; max-width: 280px; justify-content: center; }

  /* Problem */
  .problem-grid {
    grid-template-columns: 1fr;
    gap: 32px;
  }

  /* Loop */
  .loop-steps {
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .loop-arrow {
    transform: rotate(90deg);
    margin: 0;
    padding: 2px 0;
  }
  .loop-step { width: 100%; max-width: 280px; }

  /* Features */
  .feature-cards { grid-template-columns: 1fr; }

  /* Footer */
  .footer-inner {
    flex-direction: column;
    gap: 14px;
    text-align: center;
  }
}

@media (max-width: 480px) {
  .mockup-frame img { height: 240px; }
  .problem { padding: 64px 20px; }
  .loop    { padding: 56px 20px; }
  .features { padding: 64px 20px; }
  .opensource { padding: 64px 20px; }
}
```

- [ ] **Step 2: Verify responsive layout**

Open `public/landing.html` in browser. Open DevTools → Toggle device toolbar → set width to 375px (iPhone).
Expected:
- CTAs stack vertically, full width
- Problem quote appears above body text (single column)
- Loop steps stack vertically with arrows rotated 90°
- Feature cards stack in a single column
- Footer items centered and stacked
- No horizontal scroll at any mobile width

- [ ] **Step 3: Final full review**

Check at three widths: 1280px, 768px, 375px. Verify:
- Fonts render correctly (Lora serif headings, DM Sans body)
- Orb animations are subtle and not distracting
- All picsum images load (check Network tab — no 404s)
- No console errors

- [ ] **Step 4: Commit**

```bash
git add public/landing.html
git commit -m "feat: landing responsive CSS — mobile layout at 768px and 480px"
```

---

## Self-Review

**Spec coverage:**
- ✅ Self-contained single HTML file at `public/landing.html`
- ✅ Inline CSS + vanilla JS only
- ✅ Google Fonts CDN (Lora + DM Sans)
- ✅ picsum.photos placeholder images with named seeds (not gray boxes)
- ✅ Dark hero with ambient orbs + browser mockup + load animation
- ✅ Off-white problem section (two-column, Lora quote)
- ✅ surface-2 loop section (5 steps, scroll-driven sequential highlight)
- ✅ White features section (3 cards with images, stagger reveal)
- ✅ Dark open source section (mirrors hero bookend, orbs reused)
- ✅ Minimal footer
- ✅ IntersectionObserver scroll reveals on all sections
- ✅ Reveal fires once only (unobserve after trigger)
- ✅ Responsive at 768px and 480px
- ✅ CTAs: `Open App` (primary) + `View on GitHub` (ghost) throughout
- ✅ All hrefs are `#` placeholder — copy intentionally placeholder per spec

**Placeholder scan:** No TBDs, no "implement later", no vague steps. Every step includes exact code.

**Type consistency:** CSS class names used in JS (`reveal`, `reveal-child`, `visible`, `loop-step`, `active`) match exactly what's defined in Task 1 and 3 CSS. `#loop` id defined in Task 3 HTML, referenced in Task 5 JS.

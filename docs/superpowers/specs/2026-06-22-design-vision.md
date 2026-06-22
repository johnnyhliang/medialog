# MediaLog — Design Vision & Inspiration Research

*Captured 2026-06-22 from community research across HN, Reddit, Product Hunt, and design references.*

---

## Core Design Philosophy

**Calm as a differentiator.** Against Notion's feature bloat and AI-chatbot-sidebar noise, MediaLog should feel quiet. Animation is functional, not decorative. AI works silently in the background (auto-embed, semantic search, auto-tag) — never interrupting.

**Retrieval over collection.** Every tool in the bookmark/PKM space solves capture. None solves coming back. MediaLog's identity: *a tool that makes you actually use what you saved.* Revisit, Digest, aging chips, semantic search — lean into all of it.

**Invisible interface.** Raycast principle: *"You think of a task and it is done before you reach for the mouse."* No open/close animation on the command palette. Keyboard-first not as a niche feature but as the baseline assumption.

---

## Aesthetic References

### Apps That Set the Bar
- **Linear** — dark gray/black background, Inter font, purple gradient accent, subtle motion. So influential it spawned a whole "Linear style" SaaS design trend.
- **Raycast** — invisible until needed, zero animation delay for repeated actions, calm.
- **iA Writer / Bear / Things 3** — focused writing environment DNA; calm, typographic, one-thing-at-a-time.
- **Craft** — beautiful cards, whitespace, tactile feel.

### Color Palette References (developer/ricing community)
The community has converged on named theme families. Each is an identity signal — people screenshot their setups with the theme name in the title.

| Theme | Vibe | Key Colors |
|---|---|---|
| **Catppuccin Mocha** | Warmly dark, soft pastels | #1e1e2e bg, lavender/mauve accents |
| **Tokyo Night** | Deep blue-purple, Neovim crowd | #1a1b26 bg, cyan/purple accents |
| **Nord** | Cold blue-gray, austere | #2e3440 bg, frost blue accents |
| **Rose Pine** | Muted purples, poetic | #191724 bg, rose/iris accents |
| **Gruvbox Dark** | Warm retro amber/brown | #282828 bg, yellow/orange accents |
| **Everforest** | Earthy muted greens | #2d353b bg, green accents |

Current MediaLog: warm off-white editorial (unnamed). Should stay as the light default.

### Visual Style Modes (2026 Trends)
- **Dark Glassmorphism** — frosted glass layers, translucent surfaces, backdrop blur, depth through layering. Moody and sophisticated. "Will define UI in 2026."
- **Neobrutalism** — raw, bold typography, stark contrast, thick borders, visible structure. Anti-polished. Popular in indie web.
- **Neumorphism** — soft 3D embossed elements. Fading but still referenced.
- **Functional minimalism** — fewer unnecessary decisions, not fewer elements. The current dominant approach in pro tools.

---

## Community Frustrations (What to Avoid / What to Solve)

### The Graveyard Problem
*"I bookmark to absolve guilt for not reading it at all."* — HN
*"Where my good intentions go to die."* — multiple users on Instapaper

MediaLog already attacks this with Revisit, Digest, aging chip. Keep doubling down.

### Predict-at-Capture-Time is Broken
Tools that require tagging/categorizing at save time fail: people save in a rush and never go back to organize. The "big bucket + search" workflow wins. MediaLog's flat topic model + semantic search is already right here.

### The Trust Vacuum (Post-Pocket, Post-Omnivore)
Pocket died July 2025. Omnivore acquired and shuttered. Self-hosted options gained significantly. Positioning MediaLog as personal/self-hosted is a real differentiator.

### Keyboard-First is Table Stakes
For developer-adjacent users, lack of keyboard shortcuts is a dealbreaker. MediaLog already has command palette + j/k nav. Keep building on this.

---

## Feature Opportunities (From Research)

### Immediate / High Signal
- **Full-text archiving** — #1 missing feature in self-hosted tools (Linkding, Wallabag are keyword-only). Prevents linkrot. Validates MediaLog as a *permanent* archive, not just a queue. This is Phase A gate.
- **Reader mode** — distraction-free reading of stored article text. iA Writer DNA.
- **Highlight / quote capture** — select text in reader → save as child entry. What Readwise Reader users pay $10/month for.

### Medium-Term
- **Browser extension** — seamless "Share to…" is what makes Karakeep win converts over bookmarklets.
- **Semantic links sidebar** — "Related entries" panel using existing `match_entries` RPC. Quick win.

### Aesthetic / Community-Facing
- **Named theme system** — Catppuccin Mocha, Tokyo Night, Nord, Rose Pine + the current light "Warm Parchment" default. Theme picker in Settings. People post screenshots → discovery on r/unixporn, r/PKMS, r/macsetups.
- **Visual style modes** — Neobrutalism and Glassmorphism as optional overlays on top of any color theme.

---

## Competitive Landscape (2025–2026 Self-Hosted)

| Tool | Strength | Weakness vs MediaLog |
|---|---|---|
| Raindrop.io | Polish, ML tagging | Not self-hosted, no semantic search |
| Readwise Reader | Full-text, highlights, RSS | $10/month, closed source |
| Linkding | Fast, minimal, 10k+ bookmark scale | Keyword search only, no notes |
| Karakeep | AI tagging, mobile apps, RSS | No semantic search, EU cookie issues |
| Readeck | Single binary, highlights, epub | No AI, no semantic search |
| Instapaper | Clean reader mode | Stagnant, no self-host, no search |
| Pinboard | Fast API, minimal | Maintainer concerns, no semantic search |

**MediaLog's moat:** semantic search + notes-first (not just bookmarks) + self-hosted + keyboard-driven + the retrieval loop (Revisit, Digest, aging chip). No other self-hosted tool has all of this.

---

## Recommended Build Order (Design Priorities)

1. **Theme system** — color palettes + visual style modes (neobrutalism / glassmorphism). Community hook, shapes every future screenshot.
2. **Full-text archiving** — Phase A gate. Biggest trust signal. Unlocks reader mode.
3. **Reader mode** — distraction-free reading with stored body text.
4. **Highlight layer** — quote capture from reader mode.
5. **Browser extension** — removes last capture friction point.
6. **Semantic links sidebar** — quick win, no new infra needed.
7. **SRS Revisit 2.0** — SM2 spaced repetition for the retention loop.
8. **MCP v2** — wire to Claude Desktop after the library is rich.

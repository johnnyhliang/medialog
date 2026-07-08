# Gains System — Quant · Dev · Interview

*A feed, not a syllabus. Pull one small thing from a track, do it, log it. There are no dates and no "behind." Missing a day costs nothing. The only rule is: on days you're alive, add a small plate; on dead days, hit the floor (see below) so the streak survives.*

---

## How this works

Three separate engines. They don't share time or feed off the same energy:

- **Quant** and **Dev** are *depth* tracks — compounding, curiosity-led, run in your freshest hour.
- **Interview** is a *drill* track — perishable pattern-maintenance, run when tired, kept lean.

Each track is a **menu**, not a checklist. You pull **one** small thing. It's fine if 90% of a menu is never touched — a fridge you grab from, not a to-do list that nags. When a menu item annoys/bores you, drop it and pull another.

**The dead-day floor** (for burnt-out days — each takes under 5 min, and it *fully counts*):
- Quant: 2 min of Zetamac, **or** read one paragraph of Harris.
- Dev: read one section heading of whatever's active in the Concept Bank.
- Interview: read (don't solve) one NeetCode solution.

Doing the floor on a bad day beats a perfect plan you bailed on. That's the whole philosophy.

---

## Track 1 — Quant Finance (daily feed)

Pull one from any strand. Strands run in parallel; you don't finish A before starting B.

### Strand A — Build (the order book → market maker)
*The project generates its own next reps. Each rung is one session.*

1. ✅ Core engine: one match rule, prints a trade *(banked)*
2. Print the book (bids/asks) after each order — watch it breathe *(current)*
3. Give orders a **size**; handle **partial fills**
4. Let one aggressive order **sweep multiple price levels**
5. Add order **cancellation**
6. Enforce real **price-time priority** (FIFO within each price)
7. Add a **market order** type (vs limit)
8. Track & print the **spread** and **mid price**
9. Log every trade; compute **VWAP** of the tape
10. Naive **market maker**: always quote bid = mid−1, ask = mid+1
11. Drive it with a **random-walk "true price"**; track **P&L + inventory**
12. Add an **informed trader** that trades when true price moved → watch the MM get **adversely selected** (the whole game, live, losing your money)
13. Add **inventory skew**: widen/shift quotes as inventory grows
14. **Profile** it; find the bottleneck
15. Swap the sorted-list book for **heaps / better structures**; re-measure
16. *(later)* rewrite the hot path in **C++/Rust**

### Strand B — Understand markets (read a little, produce a one-liner)
*Rep = read the small chunk **and** write one sentence / take. Consumption only counts with a produce stapled on.*

- Limit order book & price-time priority
- Market vs limit orders — who supplies vs demands liquidity
- The bid-ask spread — what sets its width
- **Adverse selection** (tie it to your MM bot bleeding money)
- Inventory risk
- Who's on the other side: market makers vs hedgers vs speculators vs retail
- One order type per rep: IOC, FOK, stop…
- "Providing liquidity" — what it actually earns and why *(the DRW phrase you started with)*
- Futures basics; contango vs backwardation
- Options: calls/puts, then **one Greek per rep** (delta → gamma → vega → theta)
- Implied vs realized volatility
- Read one Jane Street / Optiver blog post → 2-sentence takeaway
- Read the intro of Budish's batch-auction paper → form a one-line take

### Strand C — Quant reasoning (mental reps)
- 2 min Zetamac (mental math)
- One EV/probability puzzle from the green book
- "Make a market" solo game: estimate a quantity, set a tight two-sided market, then check how wrong you were

### Misc quant resources (menu — don't binge)
- **Larry Harris — *Trading and Exchanges*** (the microstructure bible; your Strand B backbone)
- **Hull — *Options, Futures, and Other Derivatives*** (derivatives/Greeks)
- **Lopez de Prado — *Advances in Financial ML*** (the researcher's craft; how not to fool yourself — later)
- **Ernie Chan — *Algorithmic Trading*** (hands-on strategies)
- **Zetamac** (zetamac.com) — daily mental math
- **Jane Street Tech Blog** — practitioner reading

---

## Track 2 — Development (flexible daily feed)

The daily dev thing is deliberately *misc* — pull from any direction:

- **A)** The next rung of a build project (the matching engine counts here too — it's dev *and* quant).
- **B)** A "one layer down" from your day: any "huh, how does that actually work" you hit → 60-second map-line, or a deeper dig if it grabs you. Capture these in medialog as menu items.
- **C)** The next small chunk of whatever's **active** in the Concept Bank below.

### Concept Bank
*Grow it 1–2 resources at a time. Only **Active** resources are in rotation. Everything else sits on the Shelf with zero obligation — capturing something there is not a promise to do it.*

| Resource | Status | Next small chunk |
|---|---|---|
| The Rust Book (doc.rust-lang.org/book) | **Active** | ch. 1 — install + hello world |
| Beej's Guide to Network Programming | **Active** | intro + what is a socket |
| CS:APP ch.12 — concurrency | Shelf | — |
| *Drepper* — What Every Programmer Should Know About Memory | Shelf | — |
| Kirk & Hwu — GPU / CUDA | Shelf | — |
| "Build Your Own X" / CodeCrafters (git, redis, interpreter) | Shelf | — |

*Rule: don't move something from Shelf → Active until an Active slot frees up (finished, or dropped). Two active max.*

> Note on your 4-week concurrency/memory/GPU plan: it's good low-latency-systems material and it's exactly the quant-dev overlap — I've parked it on the Shelf so you don't lose it. If the dated version is currently keeping you afloat, keep riding it; when it starts feeling like a syllabus you're behind on, pull its topics into this feed one chunk at a time instead.

---

## Track 3 — Interview Prep (the drill — separate, lean, tired-hours)

Perishable pattern work. Keep it warm year-round, intensify in the weeks before an interview. **Patterns over volume** — don't grind 500 random problems.

**DSA / patterns**
- **NeetCode** (NeetCode 150 / the pattern roadmap) — primary. 1–2 problems/session.
- **CSES.fi Problem Set** — clean, structured problems; pairs with…
- **Competitive Programming Handbook** — read the section matching the CSES topic you're on (reference, not cover-to-cover).
- **Coding Interview University** — use as a *checklist/reference* for gaps, not a grind.
- **FAANG question GitHub repos** — company-tagged practice near interview time.

**System design**
- **System Design Primer** — one concept per session (load balancing, caching, sharding…).

**Quant interview**
- **The green book** (*A Practical Guide to Quantitative Finance Interviews*) — one probability/brainteaser per session.
- **Zetamac** — daily mental math (shared with Quant Strand C).

---

## Capturing resources (without derailing)

*Capturing a resource is what lets you ignore it. The urge to open something now comes from the fear "I'll lose this" — writing it down kills that fear, which frees you to stay on the rep in front of you. Capture is the anti-distraction move.*

1. **Capture in 5 seconds, then go back.** One line + a 3-word "why" ("great TCP explanation," "for when I do options"). Do **not** open, skim, or file it — that evaluation *is* the distraction.
2. **It always lands on the Shelf, never Active.** Interesting ≠ now. Capture infinitely, activate scarcely (two-active cap holds).
3. **Let the Shelf be a graveyard.** Most captures never get touched — that's success, not debt. A fridge, not a reading list you owe.
4. **Evaluate only on a weekly 5-min glance.** The one time you look at the Shelf and maybe promote *one* thing, if a slot's open. Batching keeps decisions out of focus hours.
5. **One inbox.** medialog quick-note is built for this — don't scatter into bookmarks, tabs, and Notion too.

Dump fast → shelve by default → promote rarely → review weekly. "Interesting" and "now" stay fully decoupled, so pace survives.

---

## Gains Log

*Backward-looking. This is the pile behind you — it only grows. Add a line whenever you do a rep. Already in the bank:*

- Can state the one rule a matching engine runs on
- Built a working matching engine that prints a real trade
- Mapped how the browser renders a frame / the JS event loop / a bundler
- One-liners banked: rasterization, monads, Rust

```
Date        Track   What I added
----        -----   ------------
```

---

## Guardrails (so this stays play, not grind)

1. No dates, no "behind." A skipped day is not a debt.
2. One thing per track per day, max. More is allowed but never required.
3. Menus are fridges, not to-do lists. Untouched items owe you nothing.
4. Every "consume" gets a small "produce" stapled on (a note, a take, a toy).
5. Depth is measured "can I build/explain something I couldn't last month?" — never by drill metrics.
6. Come back and tell me what broke; I hand you the next single plate.

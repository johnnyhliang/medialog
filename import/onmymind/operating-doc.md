# Fernando's Operating Doc

A working system, not a to-do list. Built from the full conversation + uploaded strategy docs + sorted bookmarks. Every section below can be split into its own Notion/Obsidian page later — each top-level `##` is a page candidate.

**How to use this:** Open the [Daily Cockpit](#-daily-cockpit) every morning. Open the [Weekly Review](#-weekly-review-sunday-20-min) every Sunday. Everything else is reference — pull from it deliberately, don't try to read it all at once.

---

## Table of contents

1. [North Star](#-north-star)
2. [Active Priorities](#-active-priorities-the-only-5-things)
3. [Daily Cockpit](#-daily-cockpit)
4. [Weekly Review](#-weekly-review-sunday-20-min)
5. [The Big Decisions](#-the-big-decisions-not-yet-made)
6. [Project Backlog](#️-project-backlog)
7. [Career Pipeline](#-career-pipeline)
8. [YC Startup School Prep](#-yc-startup-school-prep)
9. [Domain Depth — Daily Rotation](#-domain-depth--daily-rotation)
10. [Income Streams](#-income-streams)
11. [Cold Outreach Playbook](#-cold-outreach-playbook)
12. [Digital Products Detail](#-digital-products-detail)
13. [Inbox](#-inbox)
14. [Anti-List](#-what-im-not-doing-the-anti-list)
15. [Mental health / overwhelm protocol](#-mental-health--overwhelm-protocol)
16. [Reference & Links](#-reference--links)

---

## ⭐ North Star

Read this first. Anything you're spending time on should map to one of these. If it doesn't, kill it.

1. **Land a systems / security / big-tech-SWE internship for Summer 2026.** Primary outcome. Includes startups doing infra work.
2. **Build a network of people who get me and who I get** — engineers, founders, scouts. Compounds for years, not days.
3. **Generate side income** ($500-2k/month sustainably) to cover rent + car without trading my best hours for it.
4. **Develop conversational depth across 5 domains** so I can talk to anyone in any room — Jensen Huang or another freshman.

**The filter for any new opportunity:** Does this advance #1, #2, #3, or #4? If not, defer or drop.

**The AI-resistance filter:** Work that isn't easily replaced by AI in 2026. Deep systems (kernels, drivers, distributed systems internals), security (offensive and defensive), performance engineering, hardware/firmware, anything where correctness matters and feedback loops require real-world signals.

**Things this is explicitly NOT optimizing for right now:**
- Becoming a founder this year
- Building a startup at YC scale immediately
- Maximum credentials/titles
- Being well-known on Twitter as an end in itself
- Prediction markets as a domain (real but too niche for your filter, and Synthesis is already a conflict)

---

## 🎯 Active Priorities (The Only 5 Things)

Hard rule: maximum 5 active priorities at any time. If you want to add a 6th, kill or pause one.

| # | Priority | Status | Why it matters | Next concrete action |
|---|---|---|---|---|
| 1 | **One current technical project** (security OR systems — see Decision 1) | 🟡 Not started | Live debugging stories for events + portfolio depth + signals exactly the skill target companies hire for | Make Decision 1 by [date]; spec the project by Sunday |
| 2 | **Portfolio polish + `/hi` page + GitHub cleanup** | 🟡 Partial | Makes existing work legible; no outreach or event works without this | Rewrite project descriptions with numbers; build /hi page; pin 6 repos with real READMEs |
| 3 | **Synthesis clarity conversation** | 🔴 Blocked on me | Frees up mental energy + decides framing for every other conversation | Send the clarifying message this week |
| 4 | **Daily domain reading (5-day rotation)** | 🔴 Not started | Conversational depth compounds; no other event prep matches its ROI | Start Monday with 30 min Matt Levine |
| 5 | **YC Startup School prep** (logistics + cards + target list + Project Demos application) | 🟡 Partial | Event prep is low effort high payoff if done early; rushed if done late | Apply to Project Demos NOW; order NFC + paper cards; build target company list |

Update this table at the Weekly Review. Move things in and out deliberately.

---

## 🌅 Daily Cockpit

Open this every morning. Takes 3 minutes. Build it as a Notion template you duplicate daily.

### Morning check-in
- [ ] What's the **one** thing that, if I do it today, makes today a win?
- [ ] What domain is today? (Mon=quant, Tue=finance, Wed=hardware, Thu=software, Fri=tech pulse)
- [ ] Any follow-ups outstanding from yesterday's conversations?
- [ ] What's my energy level realistically? (Adjust scope, don't fake it)

### Today's three blocks
Pick three. No more.
1. **Project block** (60-90 min on Active Priority #1)
2. **Domain reading block** (30 min, the day's domain — see rotation table)
3. **One small thing** (a follow-up email, a polish task, an outreach message)

### Captures
- New ideas, links, people met → throw into the [Inbox](#-inbox). Don't act on them today unless trivial (<2 min).

### End-of-day (1 minute)
- [ ] Did I do the one thing?
- [ ] One sentence on what I learned today (technical, social, or about myself):
- [ ] Tomorrow's one thing:

---

## 📅 Weekly Review (Sunday, 20 min)

The single highest-leverage 20 minutes of your week. Skip this and the system breaks within 2 weeks.

1. **Look at last week's Daily Cockpits.** What pattern do you see? Did the "one thing" get done most days?
2. **Active Priorities audit** — any priority that didn't move this week? Why? Is it really a priority, or is it stuck because the next action is undefined?
3. **Inbox sweep** — for each item in [Inbox](#-inbox): act, schedule, defer to backlog, or delete. Inbox to zero every Sunday.
4. **Cross-domain synthesis** — the 5 things you read this week (one per domain), do any connect? Write 2-3 sentences in [Insights Log](#insights-log-cross-domain). This is where original thinking lives.
5. **Next week's one big bet** — what's the one thing you want to have moved by next Sunday?
6. **Update the Active Priorities table.** Update the Career Pipeline tables. Update the Project Backlog if you've added or killed anything.
7. **Anti-list check** — did I do any of the things on the [Anti-List](#-what-im-not-doing-the-anti-list) this week? If yes, why?

---

## 🧠 The Big Decisions (Not Yet Made)

Decisions you're carrying around that are costing you mental cycles. Force a deadline on each. Defer is fine; *undecided forever* is the actual problem.

### Decision 1: Security vs systems for the technical project
**Why it matters:** Determines what you build for the next 4-8 weeks and which community you embed in.

**Deadline to decide:** [pick a date this week — within 5 days max]

**What you need to decide it:** Spend 2 hours reading in each direction, then commit.

**Security path:**
- Join Michigan CTF team; compete 1-2 events in next 3 weeks
- Pick one specific tool/writeup project (fuzzer, RE writeup, CVE hunt)
- Faster community building — security has a denser, more recognizable specific community
- Pipeline: Google Project Zero, Apple SEAR, Microsoft MSRC, Trail of Bits, Latacora, Doyensec, Chainguard
- AI-resistant ceiling: very high (adversarial environments)

**Systems path:**
- Pick one well-known hard project (Raft impl, query engine, fuzzer, kernel module, L7 proxy)
- Implement well in Rust or C, write up what you learned
- Deeper technical signal for infra roles, broader employer pool
- Pipeline: Modal, Oxide, Turbopuffer, Tigris, Cloudflare, Vercel, Neon, PlanetScale, Convex, Turso
- AI-resistant ceiling: very high (distributed systems internals)

**Decision-making question, asked honestly:** When you read the two paths above, which one pulls? Not which sounds more impressive — which one would you actually be excited to spend 60 hours on in the next month?

---

### Decision 2: Synthesis relationship status
**Why it matters:** Frees up framing; determines how heavily to lean on it in every conversation.

**Deadline:** This week. Non-negotiable.

**The message to send (template):**
> "Hey [name], hope you're doing well. I've been heads-down on classes but wanted to circle back on Synthesis. A few things: (1) I'd love to know what's most useful for me to pick up next if there's an active need, (2) I'm putting together materials for some applications and a YC event coming up — would it be okay to describe my work as [specific framing]? Wanted to make sure we're aligned. Happy to hop on a quick call if easier."

**Default if no response in 7 days:** Treat as past-tense. Reframe to "I built [specific systems] for Synthesis.trade earlier this year" — past tense, project-framed, completely defensible. Lead with technical artifact, not title.

**Honest re-read:** Almost nobody at the event will have heard of Synthesis, so the credential defense matters less than I originally framed. The bigger question this answers is *your* planning — do you have a live engagement to talk about or not.

---

### Decision 3: Income strategy (which ONE path, not all of them)
**Why it matters:** Splitting attention across 4 income paths = none happen.

**Options on the table:**
- A: Cold outreach for contract infra work ($50-80/hr, $3-15k projects)
- B: Digital products on Gumroad (Claude Code guide, EECS exam guides)
- C: Algora / OSS bounties (pure execution, no marketing)
- D: Micro-SaaS (README roaster, resume roaster — see [Digital Products Detail](#-digital-products-detail))

**Deadline:** End of this week.

**Recommended default:** Path A. Highest $ ceiling, best signal alignment with your career goals (contract clients become references, contract work becomes portfolio), uses your real differentiator (production infra experience). The cold outreach prompt and target list infrastructure already exists in your files.

**Bias-check question:** Are you avoiding Path A because it requires sales motion? If yes, that's the discomfort you should push into, not around.

---

### Decision 4: One project to be "the thing" publicly
**Why it matters:** Public surface area is currently near zero. Pick one project to be the thing you point at on Twitter, in your bio, on your resume's first project line.

**Candidates:**
- ContextOS (existing, real depth, AI-flavored which may or may not be a problem)
- pgolf (existing, niche but technically rich, low activation energy to v2)
- Magic Bot (existing, scale story is real, but it's old)
- The new technical project from Decision 1 (doesn't exist yet)
- mmgrep (the multimodal indexing CLI from your YC strategy doc — bigger scope)

**Deadline:** After Decision 1. The new project might be the answer; if so, this decision resolves itself.

**Test:** When someone Googles you and clicks one link, what should they land on?

---

## 🛠️ Project Backlog

Stuff you might build, ranked by alignment with North Star. Pull from here when an Active Priority slot opens. Don't touch otherwise. Re-rank during Weekly Review if priorities shift.

### Tier 1 — Highest alignment (systems / security path)
- **Raft implementation in Rust** with chaos testing. Well-trodden, instantly recognized by infra people, demonstrates distributed systems depth. Reference: the canonical Raft paper, Aphyr's Jepsen writeups.
- **Small query engine / SQLite-compatible toy DB.** Signals database internals depth. Reference: SQLite source, DuckDB, Cosco Christo's "Write your own database" series.
- **Fuzzer for a specific protocol or file format.** Security-flavored, real bug-finding potential. Reference: AFL++, libFuzzer docs.
- **L7 proxy / userspace networking thing.** Modern infra-flavored. Reference: Envoy internals, the io_uring docs.
- **CVE hunt + responsible disclosure on an OSS project.** One good writeup = real credential. Pick a smaller project where the maintainer is responsive.
- **mmgrep — multimodal indexing CLI.** From your YC strategy doc. Bigger scope (4-5 weeks), only do if you commit to YC-track and the local-first multimodal angle. Full spec in your `startup_school_strategy.md`.

### Tier 2 — Strong but secondary
- **pgolf v2** — polish, benchmark, public launch. Lowest activation energy because it exists. Could be the public-facing "thing" without building anything new.
- **ContextOS public launch** — README, demo video, announcement. Existing work, just packaging.
- **Hardware: custom keyboard or instrumentation tool.** Distinct, demoable, fun. Use as event flex if time allows. PCB NFC card could itself be the project scaled up.
- **Claude Code Skills + MCP servers pack.** From your digital products doc — has commercial angle (Product 2). Could double as portfolio + income.

### Tier 3 — Defer indefinitely (unless something fundamental changes)
- **Vertical jump tester.** Great product idea, scores 1/4 against current goals (network/connections/outcome/AI-resistant). Save for later — it could be a real startup someday.
- **Makerkit rebuild / any SaaS template.** Don't do this. Already covered why.
- **New consumer/status app ideas** from bookmarks (Proof, music taste app, Shelf, etc.). Defer until network signals make one viable.
- **Founding anything.** Not this year.

### Hold-the-line list (things you keep wanting to start; will not)
- New ambitious project right before the YC event
- Side project to "look productive"
- Anything that requires shipping in <2 weeks but isn't already 50% done
- A new framework/language project chosen because "I should learn X"

---

## 💼 Career Pipeline

### Target company list — Tier 1 (would actively want to work at)

For each: read their engineering blog, know their stack, know one specific thing they shipped recently. This is your "I've heard of you and respect what you're doing" capital. Aim to have ~5-8 you can speak about specifically when someone asks "what kind of company are you looking at?"

**Systems / infra**
- [ ] [Modal Labs](https://modal.com) — serverless GPU
- [ ] [Oxide Computer](https://oxide.computer) — vertically integrated server stack
- [ ] [Turbopuffer](https://turbopuffer.com) — serverless vector + full text search
- [ ] [Tigris Data](https://www.tigrisdata.com) — globally distributed S3-compatible storage
- [ ] [Cloudflare](https://cloudflare.com) — edge compute, networking
- [ ] [Vercel](https://vercel.com)
- [ ] [Neon](https://neon.tech) — serverless Postgres
- [ ] [PlanetScale](https://planetscale.com) — Vitess-based MySQL
- [ ] [Convex](https://convex.dev)
- [ ] [Turso](https://turso.tech) — distributed SQLite
- [ ] [Railway](https://railway.app)
- [ ] [Fly.io](https://fly.io)
- [ ] [Replit](https://replit.com)

**Security**
- [ ] [Trail of Bits](https://www.trailofbits.com)
- [ ] [Latacora](https://www.latacora.com)
- [ ] [Doyensec](https://www.doyensec.com)
- [ ] [Chainguard](https://www.chainguard.dev)
- [ ] Google Project Zero (long-shot but real)
- [ ] Apple SEAR
- [ ] Microsoft MSRC

**Trading / fintech infra**
- [ ] [Jane Street](https://www.janestreet.com/join-jane-street/position/8160791002/) — already in bookmarks
- [ ] Hudson River Trading
- [ ] Citadel Securities
- [ ] [Ramp](https://ramp.com)
- [ ] [Mercury](https://mercury.com)
- [ ] [PEAK6](https://careers.peak6.com/jobs/business-operation-services/chicago-illinois-united-states-of-america/software-engineering-intern-margins/JR104263) — bookmarked, SWE intern Margins role
- [ ] [Aquatic Capital](https://job-boards.greenhouse.io/aquaticcapitalmanagement/jobs/8489233002) — bookmarked

**Devtools**
- [ ] [Linear](https://linear.app)
- [ ] [Raycast](https://raycast.com)
- [ ] [Sentry](https://sentry.io)
- [ ] [PostHog](https://posthog.com)
- [ ] [Anthropic](https://anthropic.com) (Claude Code team specifically)

**Other to investigate**
- [ ] [Etched](https://jobs.ashbyhq.com/etched) — custom transformer ASIC, bookmarked
- [ ] [Astranis](https://job-boards.greenhouse.io/astranis/jobs/4681183006) — bookmarked
- [ ] [Vantage](https://www.vantage.sh/careers?ashby_jid=19c9753f-25be-4e76-af53-04717bdcc25b) — bookmarked
- [ ] [Gemini exchange](https://job-boards.greenhouse.io/embed/job_app?for=gemini&token=7875125) — bookmarked

### Active applications / outreach

| Company | Role | Status | Last touch | Next step |
|---|---|---|---|---|
| | | | | |

### People to reach out to (warm + cold)

| Name | Company | How I know them | Last touch | Next step |
|---|---|---|---|---|
| Ankit Gupta | YC | Michigan campus event | | Email re: Startup School follow-up |
| | | | | |

### Professor outreach (paid research at UMich)

Targets: systems, security, networking, databases, ML infrastructure labs. Goal: 15 professors total. Use the cold email template approach from your `cold-email-blitz-prompt.md`.

| Professor | Lab/area | Why fit | Email sent? | Response |
|---|---|---|---|---|
| | | | | |

### Scout program research
- [Contrary Capital](https://contrarycap.com) — venture scouts
- [Dorm Room Fund](https://www.dormroomfund.com) — student VC
- Soma Capital scouts
- Pear scouts
- Z Fellows

For each: find 2-3 current scouts, follow on Twitter, look for their pattern. Don't DM before the event (nothing to say yet). After the event, DM with a specific question if you met someone in scout-adjacent space.

---

## 🎤 YC Startup School Prep

Pulled from the strategy doc + adapted. Treat as a checklist. Aim to have most of this done >1 week before the event.

### Asymmetric moves (do these immediately, before everything else)
- [ ] **Apply to Project Demos slot** — career fair = thousands of people; demo slot = founders and YC partners at full attention. This is the single highest-ROI application you can submit.
- [ ] **Apply to Poster Sessions** if available
- [ ] **Email Ankit Gupta** — warm contact from Michigan campus event. Frame as follow-up: you got the invite, you're coming, 10 minutes if his schedule allows.

### Materials (Week 1-2)
- [ ] **One-liner finalized** — three versions, memorized cold:
  - Default: *"I'm a CS student at Michigan working on backend infra — currently production engineering on a high-throughput trading system serving tens of thousands of concurrent users. Looking for hard systems problems for next summer."*
  - Technical/founder: *"I work on the Redis and Mongo backend for a trading platform — the interesting part is the read-heavy, low-latency settlement side. I'm into systems and infra more broadly — Rust, C++, some Verilog work."*
  - Investor/scout: *"I'm a freshman at Michigan, been freelancing since 2020, USACO Gold, currently doing production infra work. I'm exploring scout positions and looking for high-leverage roles at infra/devtools startups."*
- [ ] **johnnyliang.me audit**: name + one-liner above fold, 4-6 projects with numbers each, photo (same as Twitter/LinkedIn), contact, /resume.pdf at stable URL
- [ ] **Rewrite project descriptions** with numbers and technical specificity:
  - ❌ "Discord bot for Magic: The Gathering"
  - ✅ "Real-time platform serving 40k+ concurrent users. Rust backend, custom rate limiting, [specific hard thing]"
  - ❌ "Production engineer at Synthesis"
  - ✅ "Production infrastructure for trading platform. Redis + MongoDB, sub-100ms settlement, [scale number]"
  - ❌ "ContextOS — Claude Code plugin for context optimization"
  - ✅ "Five-engine context window optimizer. [Specific technical claim]. Reduced context bloat by [X]%"
- [ ] **`/hi` page built** (separate from main site, NFC target, vCard download button)
  - Required: photo, name, one-liner, "currently" line, 4 links max (Twitter, GitHub, LinkedIn, johnnyliang.me), Save Contact button
  - <100 lines HTML, no animation, <300ms load on hotel wifi
- [ ] **Resume PDF current** at `johnnyliang.me/resume.pdf`
- [ ] **GitHub cleanup**: 6 pinned repos, top 3 have real READMEs with screenshots/benchmarks/install instructions

### Physical materials (Week 2-3)
- [ ] **50 paper cards** ordered from MOO or VistaPrint
- [ ] **10 NFC cards** programmed to `/hi` page (Popl, Linq, Mobilo, or blank from Amazon)
- [ ] **(Optional) 5 PCB NFC cards** as flex, bring for people you really click with — "I etched these myself" is the value
- [ ] Battery pack, comfortable shoes, notebook + pen, water bottle, snacks

### Stories — 60-second versions memorized
Practice out loud, ideally to a friend who'll tell you when you ramble.

- [ ] **"What are you working on?"** → the one-liner, then a hook ending with something you're curious about
- [ ] **"Most interesting thing you've built?"** → pre-decide one. Synthesis or Magic Bot for technical audiences; pgolf or ContextOS for AI/infra audiences. Don't pick on the fly.
- [ ] **"Hardest debugging story?"** → one specific vivid story. The pipelined LC-2K simulator. The rehash_and_grow recursion bug. Specific symptom, specific aha, specific fix.
- [ ] **"What do you want to do after graduation?"** → specific. *"I want to work on systems-level infrastructure — Modal, Oxide, Turbopuffer, Tigris come to mind. Eventually I'd like to start something in [area], but right now I want to learn how serious infra companies operate from the inside."*
- [ ] **"What are you looking for here?"** ← MOST IMPORTANT, must be specific. *"Two things: a summer 2026 internship at an infra-focused startup, and I'm exploring scout positions at funds like Contrary or DRF. If you know anyone at either, I'd love an intro."*
- [ ] **"How'd you get into this?"** → two-sentence origin: freelancing since 2020, USACO, Michigan, Synthesis happened because [reason].
- [ ] **"What classes are you taking?"** → EECS 281, 370, 270 with brief cool-project mention.
- [ ] **"What do you do for fun?"** → volleyball, cooking, card games. Don't say "I code."

### Research (Week 2)
- [ ] Target company list above populated and read
- [ ] If attendee list publishes: identify 5-10 specific people, prep one question each
- [ ] Scout program research: Contrary, DRF, Soma, Pear, Z Fellows — current scouts identified

### Social audit (this week)
- [ ] Twitter bio: leads with the 40k number and what you do
- [ ] Twitter: pinned tweet shows your best work, recent activity isn't dormant
- [ ] LinkedIn: headline current, photo matches Twitter/site, recent positions accurate
- [ ] Phone: vCard set up, all handles in notes for fast sharing

### Event-day execution
- **Target: 15-25 real conversations across 2 days, not 100 superficial ones.** 5 real → 2-3 follow-ups → 1 actual opportunity.
- **Lead with curiosity** ("What are you working on?"), not your pitch
- **Note one specific thing** about each person in your phone within 60 seconds of leaving
- **Ask the magic question**: "Who else here should I be talking to?"
- **Don't camp with people you already know** — #1 failure mode
- **Energy management**: 15-min breaks every 2-3 hours. The 30th conversation at 70% < 20 at 95%.

### The 48-hour follow-up (highest-ROI window of the entire process)
- [ ] Block 2-3 hours within 24 hours of event ending
- [ ] For every meaningful conversation: personalized message, specific reference, propose next step if relevant
- [ ] Tracking spreadsheet: name, company, where you met, what they're working on, follow-up Y/N, response Y/N, next step

### Audience-specific impress moves (from your strategy doc)
- **CS students**: depth and aesthetics. Local model doing something useful, live perf work (`perf`/flamegraph/samply), Verilog/FPGA hardware-software demos, weird-but-coherent personal site.
- **Founders**: velocity, taste, judgment. Live product with real users, sharp opinion on a specific market, visible compounding numbers, fast substantive replies.
- **The one move that works in every room**: be the person who calmly fixes the thing in front of the group in five minutes while explaining what they're doing. Can't manufacture the moment, can be ready for it.

---

## 📚 Domain Depth — Daily Rotation

30 minutes/day. The 5-day rotation. Goal: in 4 weeks, not embarrass yourself in any domain. In 3 months, ask genuinely sharp questions. In 6 months, original cross-domain insights.

### The rotation

| Day | Domain | Primary sources |
|---|---|---|
| Mon | Quant / trading | [Matt Levine's Money Stuff](https://www.bloomberg.com/account/newsletters/money-stuff) (daily, free), [QuantConnect](https://www.quantconnect.com) learning + Discord, [@quantian](https://x.com/quantian1), "Quantitative Trading" chapter summaries on [QuantStart](https://www.quantstart.com). For real depth: *Advances in Financial Machine Learning* by Marcos López de Prado (UMich library) |
| Tue | Finance / business | [Patrick Boyle YouTube](https://www.youtube.com/@PBoyle), [Acquired podcast](https://www.acquired.fm), [The Diff by Byrne Hobart](https://www.thediff.co), for VC: [@HarryStebbings](https://x.com/HarryStebbings) + 20VC podcast |
| Wed | Hardware / manufacturing | [Asianometry YouTube](https://www.youtube.com/@Asianometry) (best single resource), [Stratechery](https://stratechery.com) hardware posts, [@dylowen](https://x.com/dylowen), [@chipatologist](https://x.com/chipatologist). Supply chain: Flexport blog, [@typesfast](https://x.com/typesfast) (Ryan Petersen) |
| Thu | Software infra deep dives | [The Morning Paper](https://blog.acolyer.org) (Adrian Colyer, classic CS papers in plain English), [Julia Evans blog](https://jvns.ca), [@b0rk](https://x.com/b0rk), [@copyconstruct](https://x.com/copyconstruct), [Architecture Notes newsletter](https://newsletter.architecturenotes.co). Current: Changelog weekly, HN front page |
| Fri | Tech pulse / current events | [Stratechery](https://stratechery.com) free tier, [The Information](https://www.theinformation.com) (UMich library?), [Hacker News](https://news.ycombinator.com), [Risky.biz podcast](https://risky.biz), YC blog, [Lenny's Newsletter](https://www.lennysnewsletter.com) free tier, [This Week in Startups](https://thisweekinstartups.com) |

### Add-on sources for security/systems direction
- **If Decision 1 = security**: [LiveOverflow YouTube](https://www.youtube.com/@LiveOverflow), [Project Zero blog](https://googleprojectzero.blogspot.com), [CTFtime.org](https://ctftime.org), [HackTricks](https://book.hacktricks.xyz)
- **If Decision 1 = systems**: [Brendan Gregg](https://www.brendangregg.com), [Marc Brooker](https://brooker.co.za/blog/), [Aphyr / Jepsen](https://jepsen.io), [Murat Demirbas](http://muratbuffalo.blogspot.com)

### The second-level question practice
After every piece of content, write ONE question that isn't answered. Not "what does X mean" — more like "if X is true, why hasn't Y happened yet?" or "how does this interact with Z?" Add to Insights Log below.

### Insights log (cross-domain)
Sunday synthesis lives here. When two domains connect, write it down. The cross-domain pattern recognition is what makes you interesting in a room full of people who only know their own lane.

- [date] —
- [date] —

### The conversation trick (for events + everyday)
When you meet someone at any event, ask them to explain their domain to you and specifically ask **"what do outsiders always get wrong about your field?"** People love answering this question and the answers are exactly the insider knowledge that separates surface-level from depth. Write down what they said.

---

## 💰 Income Streams

Pick ONE for the next 4 weeks ([Decision 3](#decision-3-income-strategy-which-one-path-not-all-of-them)). Don't run more than one in parallel until something is proven.

### Path A — Cold outreach for contract infra work (RECOMMENDED DEFAULT)
- **Target rate:** $50-80/hr or $3-15k projects, 1-4 week scope
- **Audience:** Seed / Series A startups in fintech / devtools / infra / trading
- **Materials needed:** Portfolio (Active Priority #2) + a one-page "what I do" capabilities sheet
- **Cadence:** 5 emails/day, 4 weeks = 100 emails → expect 5-10 real conversations → 1-2 deals
- **Tracking:** spreadsheet (company / contact / specific observation / email sent / response / status)
- **Why this is the recommended default:** Highest $ ceiling. Best signal alignment with career goals. Contract clients become references. Contract work becomes portfolio. Uses your real differentiator (production infra experience). Sales motion is uncomfortable but builds a skill you need anyway.
- **Full playbook:** see [Cold Outreach Playbook](#-cold-outreach-playbook)

### Path B — Digital products on Gumroad
- **Product 1 candidate:** "The Systems Engineer's Claude Code Bible" — $29 PDF + configs bundle
- **Effort:** One weekend to write, ongoing distribution work
- **Realistic 3-month revenue:** $1-3k
- **Best if:** You want to build the Twitter audience anyway
- **Full breakdown:** see [Digital Products Detail](#-digital-products-detail)

### Path C — Algora / OSS bounties
- **Format:** Pick a project, work bounties
- **Effort:** Pure execution, no sales motion
- **Trade-off:** Lower hourly than contract work, but skill-building + portfolio is the side benefit
- **Best if:** You want pure technical work and zero sales discomfort

### Path D — Micro-SaaS (resume roaster / README roaster)
- **Effort:** 1-2 weekend MVP, then distribution work
- **Risk:** Could flop entirely; could also be the upside swing
- **Best if:** You're committed to also doing the Twitter audience-building motion

**Decision deadline:** End of this week. Commit. Re-evaluate after 4 weeks of full effort on the chosen path. If it's working, scale. If not, pivot to the next.

---

## 📧 Cold Outreach Playbook

From your `cold-email-blitz-prompt.md`. Activate this when you commit to Path A.

### Target list construction
Build 30-50 startups. Mix of:
- Recent/current YC batches (filter [ycombinator.com/companies](https://www.ycombinator.com/companies) by your verticals)
- Companies with public repos where you can identify specific technical issues (open issues, performance gaps, missing tests)
- Startups in fintech / dev tools / infra / trading where your background is directly relevant

For each target, find:
1. The right person to email (founder/CTO — not generic info@)
2. A specific technical observation you can reference (not "love what you're building")
3. A personalized email draft

### Email template skeleton
```
Subject: [specific technical observation or question, 5-7 words]

Hey [name],

[1 sentence: specific technical observation about their stack/repo/recent post — proves you actually looked]

I'm a freshman CS at Michigan currently doing production engineering on a prediction market platform (Redis + Mongo, ~40k concurrent). I've built [closest thing to what they need], and I'd love to take a [scoped, specific] piece of work off your plate this winter — $50-80/hr or fixed-price.

Some recent work: [1 specific link, not "here's my GitHub"]

Worth a 15-min call?

Fernando
```

### Tracking sheet columns
- Company | Person | Email | Date sent | Specific hook used | Response (Y/N) | Status | Next action | Notes

### Cadence
- 5 emails/day, every weekday
- Follow up once after 5 business days if no response — short, value-adding (a thought, a link, not "checking in")
- No third follow-up — move on

### Realistic numbers
- 100 emails → 10-20 responses → 5-10 real conversations → 1-2 deals
- One $5k contract pays for the whole quarter of effort

### Companion: professor cold emails
Same playbook for 15 UMich EECS professors in systems/security/networking/databases/ML infra. Different template (academic tone, specific paper reference, willingness to do unpaid work first to prove value).

---

## 💵 Digital Products Detail

From your `digital-products-deep-dive.md`. Activate when you commit to Path B (or alongside Path A if bandwidth allows).

### Product 1: "The Systems Engineer's Claude Code Bible" ($29)
**Format:** PDF/Markdown guide + config files bundle
**Platform:** [Gumroad](https://gumroad.com) (free until you sell, then 10% cut)
**Time to create:** One weekend (you already have the setup — just documenting it)
**Realistic revenue:** $1-5k over 3-6 months (50 sales × $29 × 0.9 = $1,305)

**What's in it:**
1. Multi-agent routing strategy (Claude Code vs Qwen CLI vs Bifrost; why routing Claude Code through Bifrost degrades responses; Gemini via repomix for orientation → Claude Code for execution; decision tree)
2. Context management (CLAUDE.md pattern, sub-50 lines, updated at session end; repomix for continuity; why most CLAUDE.md files are too long)
3. Config files (this is what people actually pay for): .cursorrules templates, CLAUDE.md templates per project type, shell aliases, MCP server configs, git hooks
4. Systems-specific prompting: getting Claude to write good C++/Rust (not web slop), memory-safe code, concurrency, code review on unsafe blocks, build system understanding
5. GPU workflow for ML: your pgolf pattern (edit local → push → pull on remote GPU → iterate), Kaggle T4 vs RunPod H100, when local works

**Why this sells:** The systems/infra angle is completely unserved in the Claude Code content market. Almost all existing content is web dev.

**Distribution:**
1. Post 5-7 free "snippets" on X over 1-2 weeks (mini-lessons that link to full guide)
2. Post on r/ClaudeAI, r/cursor, r/LocalLLaMA, HN — share genuine value in comments, link in bio
3. Dev.to / Hashnode long-form article version of one section

### Product 2: Claude Code Skills & MCP Servers Pack ($19-39)
**Format:** Private GitHub repo (access granted on purchase) or zip
**Time:** 1-2 weekends
**Realistic revenue:** $500-3k

**Contents:**
- Prebuilt skills: Rust project, C++ project, performance analysis, database migration, git workflow
- MCP servers: GitHub Issues → Implementation Plan, Codebase Health, Benchmark Runner

### Product 3: EECS Exam Survival Guides ($8-12 each)
**Format:** Well-designed PDFs
**Realistic revenue:** $500-2k per semester, recurring

**Specific guides:**
- "EECS 281: The Algorithm Cheat Sheet That Actually Helps"
- "EECS 370: Pipeline, Cache & VM in 10 Pages"
- "EECS 270: Verilog FSM Patterns for the Final"

**Distribution:** Post link in class GroupMes/Discords once per exam cycle. Sells through word of mouth.

**IMPORTANT:** No copyrighted course material. Write everything in your own words. Keep clean with Honor Code.

### Product 4: Micro-SaaS
Ideas ranked by feasibility:
- **A) GitHub README Roaster** ($3-5/use or $8/mo) — viral hook is the roast angle
- **B) Resume Roaster for Engineers** ($3/roast or $10/mo) — you already built the Chrome extension
- **C) PR Description Generator** (free + $5/mo pro)
- **D) Technical Interview Prep Tool** ($15/mo) — smaller market, higher price

Recommended: A or B. Build in a weekend, see if it sticks.

### The Twitter/X build-in-public funnel (distribution layer for everything)
**Cost:** $0 | **Time:** 15-30 min/day

- Week 1-2: 1-2 tweets/day about your actual workflow; engage genuinely with Claude Code/Cursor tweets
- Week 3-4: drop product hints, post snippets, see engagement
- Each product launch is a content event

**Why this works for you:** "Freshman in EECS who does production engineering and has a sophisticated AI coding workflow" is a genuinely interesting story. Age is a feature, not a bug.

---

## 📬 Inbox

Everything new lands here. Acted on / scheduled / deleted during Weekly Review. Never leave items > 1 week.

### Ideas
- 

### Links to read
- 

### People to contact
- 

### Questions to research
- 

### Stuff to think about
- 

---

## 🚫 What I'm NOT Doing (The Anti-List)

Equally important as the to-do list. When the urge comes back, re-read this.

- ❌ Rebuilding Makerkit or any other SaaS template
- ❌ Starting a new ambitious project <4 weeks before the YC event
- ❌ Building a vertical jump tester right now (great idea, wrong moment — save it)
- ❌ Pitching myself as a founder at the YC event
- ❌ Trying to ramp Twitter from zero in the week before the event
- ❌ Running 4 income streams in parallel
- ❌ Mass-blasting cold emails without personalization
- ❌ Building a project "just to have something"
- ❌ Optimizing my portfolio for the millionth time instead of doing the underlying work
- ❌ Talking about Synthesis with present-tense ownership until I get the clarifying conversation done
- ❌ Adding a 6th Active Priority
- ❌ Picking a new language/framework "to learn" instead of going deeper on Rust/C++/Python
- ❌ Pre-event DMs to attendees I don't know (low conversion, feels spammy)
- ❌ Bringing someone to "hype me up" at events (be alone, meet more people)
- ❌ Generic LinkedIn "amazing event!" posts after the event

---

## 🪞 Mental health / overwhelm protocol

If this whole doc feels like too much:
1. **Close it.** Open only the [Daily Cockpit](#-daily-cockpit).
2. Pick **one** thing for today. The one-thing rule overrides everything else in this doc.
3. Do that one thing.
4. Tomorrow, repeat.

The system exists to *reduce* decision fatigue, not add to it. If it's not doing that, you're using it wrong — strip it down further until it is.

**The honest truth:** You're a freshman doing more than 95% of people in your position. The overwhelm is real but it's the overwhelm of having too many good options, not of being behind. That's a much better problem to have than the alternative. Pace accordingly.

**When the comparison spiral hits:** the people you're comparing yourself to on Twitter have curated profiles, not lives. The ones who are actually further ahead than you have years on you, not skill. Time will fix that on its own as long as you keep shipping. The thing that won't fix itself is burning out at 19 because you tried to do everything at once.

**Things that aren't optional for mental health:**
- Sleep ≥7 hours
- Two 5v5 basketball sessions/week (already happening, protect this)
- Volleyball open gym (already happening, protect this)
- Church community involvement (already happening, protect this)
- One full day off per week (no projects, no email, no LinkedIn)

These compound just like the work does. Skipping them to "get more done" actively reduces total output within 2-3 weeks.

---

## 📎 Reference & Links

### Personal handles & links
- Site: [johnnyliang.me](https://johnnyliang.me)
- GitHub: [johnnyhliang](https://github.com/johnnyhliang)
- Email: jonliang@umich.edu

### Saved from bookmarks — Jobs & Internships
**Quant / trading**
- [Jane Street](https://www.janestreet.com/join-jane-street/position/8160791002/)
- [PEAK6 — SWE Intern, Margins (Chicago)](https://careers.peak6.com/jobs/business-operation-services/chicago-illinois-united-states-of-america/software-engineering-intern-margins/JR104263)
- [Aquatic Capital Management](https://job-boards.greenhouse.io/aquaticcapitalmanagement/jobs/8489233002)

**Startups / Infra / AI**
- [Gemini exchange](https://job-boards.greenhouse.io/embed/job_app?for=gemini&token=7875125)
- [Astranis](https://job-boards.greenhouse.io/astranis/jobs/4681183006)
- [Vantage](https://www.vantage.sh/careers?ashby_jid=19c9753f-25be-4e76-af53-04717bdcc25b)
- [Etched](https://jobs.ashbyhq.com/etched)

**Big Tech & Rotational Programs**
- [Capital One — Rotational Programs](https://www.wayup.com/i-Financial-Services-j-Exploring-Rotational-Programs-at-Capital-One-Capital-One-410502166565460/)
- [Google Careers on Air events](https://careersonair.withgoogle.com/events/fiti-nygswej)

**Events & forms**
- [FigFest 2026](https://applytofigfest2026.figma.site/)
- [Snowflake Summit](https://www.snowflake.com/en/summit/)

### Reading queue — high priority technical
- [Karpathy — Zero to Hero](https://karpathy.ai/zero-to-hero.html) (deep learning, foundational)
- [Vlad Feinberg blog](https://vladfeinberg.com/) (systems + ML)
- [Vercel Labs — Zero language launch](https://www.marktechpost.com/2026/05/17/vercel-labs-introduces-zero-a-systems-programming-language-designed-so-ai-agents-can-read-repair-and-ship-native-programs/)
- [BentoML — Kernel Optimization for LLM Inference](https://bentoml.com/llm/kernel-optimization/kernel-optimization-for-llm-inference)
- [Bifrost AGENTS.md](https://github.com/maximhq/bifrost/blob/main/AGENTS.md)
- [Gemini CLI → Antigravity CLI transition](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)

### Communities to be active in
- **If security path**: Michigan CTF team, picoCTF Discord, OFFENSIVE Discord servers
- **If systems path**: r/rust, r/programming, specific Discords (Rust GameDev, Tokio, etc.)
- HN (passive but useful — skim front page daily)
- r/LocalLLaMA (if continuing pgolf / ML systems work)
- One specific Discord per active domain

### Mental hygiene / inspiration reading (low-priority but worth keeping)
From your bookmarks, the personal-development side — keep these for off-hours, not work hours:
- [How to *Actually* Get an Internship (YouTube)](https://m.youtube.com/watch?v=j_KrWStXYDk)
- [3-4 Months Is All You Need (YouTube)](https://m.youtube.com/watch?v=EHvjV0Z4Hak)

### Things from bookmarks that are NOT this system's problem
Keep as personal hobbies, don't try to integrate into the work system:
- Basketball training videos, poker, chess, gaming, fitness, music, style, car mods
- These are life, not work. Protecting them = protecting mental health.

---

*Last updated: [today's date]*
*Next Weekly Review: [next Sunday]*

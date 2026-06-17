# Digital Products & Micro-SaaS Deep Dive
## Specifically for Fernando — $0 startup cost, $40k in credits, systems background

---

## THE MARKET RIGHT NOW

Claude Code hit $2.5B run rate. Cursor hit $2B. Developers are spending
like crazy on AI coding tools and STILL don't know how to use them well.
The market for "how to actually use these tools" is white-hot and undersupplied.

Meanwhile, the generic "100 ChatGPT prompts" market is dead. What sells
in 2026 is SPECIFICITY — niche workflows, battle-tested configs, and
opinionated setups from people who actually ship production code.

You have something 99% of digital product sellers don't: real production
experience with these tools AND systems-level technical depth.

---

## PRODUCT 1: "The Systems Engineer's Claude Code Bible"
**Format:** PDF/Markdown guide + config files bundle
**Price:** $29
**Platform:** Gumroad (free until you sell, then 10% cut)
**Time to create:** One weekend
**Revenue potential:** $1k-5k over 3-6 months

### What's in it:

Your actual setup, documented and explained:

1. **The multi-agent routing strategy**
   - When to use Claude Code directly vs Qwen CLI vs Bifrost
   - Why routing Claude Code through Bifrost degrades responses
   - How to use Gemini via repomix for orientation/planning before
     handing off to Claude Code for execution
   - Decision tree: which model for which task

2. **Context management that actually works**
   - Your CLAUDE.md pattern (sub-50-line, updated at session end)
   - repomix for context continuity across sessions
   - Why most people's CLAUDE.md files are too long and how to prune
   - Working-set tracking concepts from ContextOS applied to daily workflow

3. **The config files (this is what people actually pay for)**
   - Your .cursorrules / CLAUDE.md templates for different project types
   - Shell aliases and scripts for your workflow
   - MCP server configs
   - Git hooks for context management

4. **Systems-specific prompting**
   - How to get Claude to write good C++/Rust (not just web slop)
   - Prompting for memory-safe code, concurrency patterns, performance
   - Getting useful code review on unsafe blocks, lifetime issues, etc.
   - Making Claude understand build systems (CMake, Cargo workspaces, Makefiles)

5. **The GPU workflow for ML**
   - Your pgolf pattern: edit locally → push → pull on remote GPU → iterate
   - Managing Kaggle T4 vs RunPod H100 dispatch
   - When local (RTX 5060) works vs when you need cloud

### Why people would buy this:

Search "Claude Code workflow" on Twitter right now. Thousands of devs
posting their setups, getting tens of thousands of impressions. But
almost ALL of them are web developers. The systems/infra angle is
completely unserved. A Rust/C++/Go developer trying to figure out
Claude Code has almost no good resources.

### How to sell it:

1. Post 5-7 free "snippets" on X over 1-2 weeks
   - "How I route between Claude Code and Qwen for different tasks"
   - "My CLAUDE.md is 47 lines. Here's why yours should be too."
   - "Getting Claude to write actually-safe Rust (not just compilable Rust)"
   Each tweet is a mini-lesson that demonstrates expertise and links to
   the full guide.

2. Post on r/ClaudeAI, r/cursor, r/LocalLLaMA, HN
   Share genuine value in comments, link in bio.

3. Dev.to / Hashnode article
   Write a long-form version of one section, link to full product.

---

## PRODUCT 2: Claude Code Skills & MCP Servers Pack
**Format:** GitHub repo (private, access granted on purchase) or zip
**Price:** $19-39 depending on scope
**Platform:** Gumroad or Lemon Squeezy
**Time to create:** 1-2 weekends
**Revenue potential:** $500-3k over 3-6 months

### What's in it:

Prebuilt Claude Code skills (the /mnt/skills pattern) for specific workflows:

- **Rust project skill** — knows cargo workspace conventions, runs clippy,
  understands common crate patterns, generates proper error types
- **C++ project skill** — CMake-aware, sanitizer integration, knows how to
  set up GoogleTest, handles header/source file conventions
- **Performance analysis skill** — runs perf/flamegraph, interprets results,
  suggests optimizations with cache-line awareness
- **Database migration skill** — generates migrations for Postgres/SQLite,
  handles rollback logic, tests migration paths
- **Git workflow skill** — conventional commits, interactive rebase guidance,
  PR description generation from diff

Plus 2-3 MCP servers:

- **GitHub Issues → Implementation Plan MCP** — reads an issue, analyzes the
  repo structure, generates a scoped implementation plan
- **Codebase Health MCP** — runs static analysis tools, aggregates results,
  gives a "health score" with actionable items
- **Benchmark Runner MCP** — runs benchmarks, compares against baseline,
  formats results for PR comments

### Why this sells:

Claude Code skills are new and most devs haven't figured out how to write
good ones yet. The official docs are thin. You've been writing skills
already (ContextOS). Packaging your best ones is literally just
organizing what you've already built.

MCP servers are the hottest thing in the Claude Code ecosystem right now
(7.2k stars in trending). Every dev wants more MCPs but building them
from scratch is annoying. Pre-built ones that solve real problems sell.

---

## PRODUCT 3: EECS Exam Survival Guides
**Format:** PDF (well-designed, not just raw notes)
**Price:** $8-12 each
**Platform:** Gumroad, link posted in Michigan student groups
**Time to create:** 1 weekend per guide (you already have the material)
**Revenue potential:** $500-2k per semester, recurring every term

### Specific products:

- **"EECS 281: The Algorithm Cheat Sheet That Actually Helps"**
  Knapsack variants, union-find, grid DP, hash tables with linear probing,
  tombstone deletion — all the stuff you just studied, condensed into a
  visual reference guide. Not a textbook replacement — a "night before
  the exam" companion.

- **"EECS 370: Pipeline, Cache & VM in 10 Pages"**
  CLA timing analysis, loop unrolling + cache performance, pipeline hazards,
  virtual memory/paging. The stuff that confuses everyone, explained by
  someone who just took it.

- **"EECS 270: Verilog FSM Patterns for the Final"**
  TLC FSM, calculator FSM, testbench patterns. The practical Verilog
  that DE2-115/LabsLand assignments test on.

### Why this works:

Students won't pay for tutoring but they WILL pay $10 for a well-made
exam guide at 11pm the night before the final. The key is making it
genuinely better than free alternatives — more visual, better organized,
focused on the specific exam patterns at Michigan (not generic DSA).

You post the link in class GroupMes/Discords once per exam cycle.
It sells itself through word of mouth after that.

### Important:

Don't include any copyrighted course material (exam questions, homework
solutions, lecture slides). Write everything in your own words as
original study material. This keeps you clean with Honor Code.

---

## PRODUCT 4: Micro-SaaS Using Your Credits
**Format:** Web app
**Price:** Freemium ($0 free tier, $5-15/mo paid)
**Platform:** Vercel (free tier) + Supabase (free tier) + your AI credits
**Time to create:** 1-2 weekends for V1
**Revenue potential:** $0-5k/month (high variance, could be $0)

This is the bigger swing. Unlike the digital products above (which are
almost guaranteed to make SOME money), this could make nothing or could
be the thing that takes off.

### Ideas ranked by feasibility:

**A) GitHub README Roaster / Generator ($3-5 per use or $8/mo)**
Paste a GitHub repo URL → AI reads the repo → generates a professional
README with badges, architecture diagram description, installation
instructions, API docs. Or "roast mode" — brutally honest feedback on
what your README is missing. The roast angle is the viral hook.
Your AI credits cover inference. Vercel free tier covers hosting.
Supabase free tier covers auth + usage tracking.

**B) Resume Roaster for Engineers ($3/roast or $10/mo)**
Upload resume PDF → AI gives brutally honest feedback calibrated to
SWE/infra roles. Not generic "add more action verbs" — specific feedback
like "your bullet about Redis doesn't quantify the performance improvement"
or "this reads like a junior dev resume despite your experience level."
You literally built a resume-tailoring Chrome extension already.
Repackage that knowledge into a standalone tool.

**C) PR Description Generator (GitHub App, free + $5/mo pro)**
Install GitHub App → on PR open → AI reads the diff + linked issues →
generates a well-structured PR description with summary, changes list,
testing notes, and reviewer guidance. Free for public repos, $5/mo for
private. This is the one that could compound through GitHub Marketplace
distribution, but it's also the most competitive space.

**D) Technical Interview Prep Tool ($15/mo)**
AI-generated practice problems calibrated to specific companies and roles.
Not LeetCode — systems design, architecture, and "tell me about a time"
behavioral questions with AI-generated feedback on your answers.
Uses your AI credits for inference. Higher price point but smaller market.

### My recommendation: Start with A or B.

They're the fastest to build, the easiest to make viral (the "roast"
angle is inherently shareable — people screenshot and post their roasts),
and they have clear monetization. Build it in a weekend, launch it,
see if it sticks.

---

## PRODUCT 5: The Twitter/X Build-in-Public Funnel
**Format:** Not a product — it's the distribution layer for everything above
**Cost:** $0
**Time:** 15-30 min/day

This is critical. None of the above products sell without distribution,
and your distribution at $0 marketing budget is your own content.

### The playbook:

**Week 1-2: Establish the account**
- Post 1-2 tweets/day about your actual workflow
- Topics that perform: "Today I learned X about Claude Code",
  "Why I stopped using X and switched to Y", "My setup for [specific task]"
- Engage with Claude Code / Cursor / AI coding tweets (reply with
  genuine insights, not generic "great thread!")
- Follow and engage with: @alexalbert__, @borismcherny, @mcaborern,
  people posting about Claude Code workflows

**Week 3-4: Start dropping product hints**
- "Writing up my full Claude Code setup for systems programming.
   Would anyone actually want this?"
- Post a snippet from the guide, see engagement
- If it resonates → launch the product with a tweet thread

**Ongoing: Each product launch is a content event**
- Tweet thread breaking down what the product is + free preview
- QRT your own launch tweet with interesting angles
- Post the "results" — "$X in first week" transparency builds trust

### Why this works for you specifically:

The "freshman in EECS who does production engineering and has a
sophisticated AI coding workflow" is a genuinely interesting story.
People on X love underdogs who are technically legit. Your age and
experience level is a FEATURE for content, not a bug — "19-year-old
production engineer shares his Claude Code setup" is more clickable
than "senior dev shares his Claude Code setup."

---

## THE PRIORITY ORDER

1. **This weekend:** Write the Claude Code guide (Product 1).
   You already have the setup — you're just documenting it. Ship it
   Sunday night. Post about it Monday.

2. **Next week:** Package one EECS exam guide (Product 3) if
   there are upcoming summer exams or save for fall.

3. **Ongoing:** Post on X daily. This compounds and feeds everything.

4. **When you have momentum:** Build the micro-SaaS (Product 4).
   Wait until you've validated that people care about your content
   before investing time in a bigger build.

5. **If Product 1 sells well:** Ship the Skills/MCP pack (Product 2)
   as a follow-up product to the same audience.

---

## FINANCIAL REALITY CHECK

Let's be honest about numbers:

- Product 1 at $29, 50 sales in 3 months = $1,305 (after Gumroad's cut)
- Product 3 at $10, 100 sales per semester = $900
- Total from digital products alone: ~$2,000 in first 3 months

That's not life-changing money. But it's:
- More than the boba shop alone
- Stackable on top of the boba shop
- Building an asset (audience, products, reputation) that compounds
- Potentially much more if something goes viral

The micro-SaaS (Product 4) is the one that could actually change the
trajectory — if the README Roaster or Resume Roaster catches on and
gets 500+ paying users, that's $2.5k-5k/month. But that's a bet, not
a guarantee.

The safe play: boba shop + digital products + professor emails.
The upside play: add the micro-SaaS on top.
Do both.

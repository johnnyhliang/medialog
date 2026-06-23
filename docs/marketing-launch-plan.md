# MediaLog Marketing and Launch Plan

Date: 2026-06-23

## Purpose

This document defines how MediaLog should be positioned, simplified, launched, and measured if it is eventually shipped as a serious public product.

The intent is not to create a hype-driven launch. The goal is to earn credible attention from people who genuinely need the tool: serious learners, students, researchers, engineers, readers, and builders with too many saved links, notes, files, feeds, and AI conversations.

## Product Thesis

MediaLog should not be marketed as a generic productivity dashboard, AI notes app, or Notion replacement.

The strongest thesis is:

> MediaLog helps people who save too much and retain too little turn captured information into reviewed, remembered, and synthesized knowledge.

The product loop is:

```text
Capture -> Triage -> Consume -> Retain -> Synthesize
```

Every launch-facing feature should strengthen that loop. Anything outside the loop should be hidden, removed, or treated as an advanced module.

## Positioning

### Primary Positioning

Use this:

> An open-source memory system for people who save too much and remember too little.

Alternative short versions:

- `Open-source Readwise/Obsidian alternative for saved knowledge.`
- `Capture links, triage them, revisit them, and synthesize what matters.`
- `A retention-first knowledge base for serious self-learners.`

### What To Avoid

Avoid:

- `AI second brain`
- `Productivity OS`
- `Notion replacement`
- `All-in-one dashboard`
- `Personal command center`
- `Life operating system`

Those phrases make the product sound general, overbuilt, and interchangeable with dozens of AI-generated apps.

## Ethical Marketing Rules

MediaLog should be marketed aggressively only where the product is real. Do not create a gap between promise and shipped behavior.

Rules:

1. Do not claim features that are not shipped.
2. Do not claim open source without a real license file.
3. Do not link to fake pricing, docs, GitHub, privacy, or legal pages.
4. Do not say "AI-powered" as the main value proposition.
5. Do not block export, deletion, or portability behind payment.
6. Do not use dark patterns around import, trial, cancellation, or data retention.
7. Do not imply that the app replaces judgment, studying, reading, or thinking.

The honest pitch is stronger:

> MediaLog gives saved information a workflow: every item gets captured, sorted, revisited, and turned into usable notes.

## Public Product Scope

The public version should be narrower than the private personal app. A focused product will travel better than a broad dashboard.

### Core Features To Ship Publicly

These should be polished and central:

- Quick capture for links, notes, files, and AI conversations.
- Inbox triage with keyboard-first review.
- Flat topics, tags, status, and pinning.
- Bulk import from common messy sources.
- Full-text mirror and reader mode.
- Highlights and takeaways.
- SRS/revisit scheduling.
- Daily or weekly digest.
- Semantic search and related entries.
- Topic synthesis docs.
- Markdown export and GitHub/plain-text backup.
- Mobile PWA capture and review.
- Visible save, sync, index, and backup health.

### Hide, Remove, Or Move To Labs

These features distract from the public story unless they are explicitly reframed as optional modules:

- Market widgets.
- Weather and clock widgets.
- Opportunity radar.
- Applications tracker.
- Company/program settings.
- Instagram/Reels ingestion.
- Generic quick links dashboard.
- MCP server.
- Wayback bulk archiver.
- Full RSS reader UI, unless feeds are just treated as another capture source.

The most important strategic fork is the Applications tracker. It is useful, but it changes the category from "knowledge retention system" to "personal command center." For a clean launch, keep it out of the primary product.

## Production Readiness Bar

Do not publicly launch until the following are true:

- Landing page only claims shipped features.
- `LICENSE` exists and matches the open-source claim.
- README includes screenshots, demo, quickstart, self-host guide, architecture, and roadmap.
- Hosted demo or seeded demo account exists.
- Import flow works well enough for real messy data.
- Export flow works and is easy to find.
- Mobile capture works reliably.
- SRS/revisit works.
- Semantic search works or is clearly marked experimental.
- Topic synthesis works or is clearly marked experimental.
- Save/index/backup failures are visible and recoverable.
- Privacy and data deletion story is clear.
- AI and embedding usage have rate limits or cost controls.
- Edge functions and RLS have had a security review.
- At least 5 beta users would be annoyed if the project disappeared.

## Timeline To Traction

### Phase 1: Private Proof, 0-2 Months Before Launch

Goal:

- 10-30 serious beta users.
- 3-5 weekly users.
- 2-3 strong testimonials.
- 1 polished 60-second demo video.
- Public repo that looks credible.

Primary work:

- Recruit students, researchers, engineers, heavy readers, and self-learners.
- Watch onboarding sessions.
- Fix import, capture, and first-review friction.
- Measure whether users return for review.
- Collect quotes around the actual pain: saved links, forgotten reading, messy AI chats, abandoned notes.

Exit criteria:

- Users can describe the product back in one sentence.
- Users import real content, not just toy data.
- Users complete at least one review loop.
- At least a few users ask for improvements instead of politely saying it is cool.

### Phase 2: Open-Source Launch, Launch Week

Goal:

- 100-500 GitHub stars.
- 500-5,000 site visits.
- 50-300 signups or self-host attempts.
- 5-30 active users after two weeks.
- 1-3 meaningful reposts, writeups, newsletters, or community mentions.

Launch assets:

- README with screenshots and GIF/video.
- Architecture documentation or architecture section.
- Self-host guide.
- Demo account or seeded demo mode.
- Launch post.
- Comparison page or section: Readwise, Pocket/Raindrop, Obsidian, Notion.
- Privacy/export page.

Launch surfaces:

- GitHub.
- Hacker News `Show HN`.
- Product Hunt.
- Reddit communities around productivity, self-hosting, PKM, Obsidian, students, and reading.
- Discords/Slacks for builders, students, researchers, and open-source tools.
- Personal Twitter/X, LinkedIn, and technical blog.
- Direct outreach to newsletter authors who cover open-source productivity or learning tools.

### Phase 3: Post-Launch Validation, 1-3 Months After Launch

Goal:

- Learn whether the project has real pull or only launch curiosity.

Good signs:

- Users import real libraries.
- Users ask for import/export improvements.
- Users file issues without being prompted.
- Someone writes that MediaLog replaced part of their Pocket, Readwise, Obsidian, or notes workflow.
- Contributors appear.
- Users return weekly for digest/revisit.

Bad signs:

- Many stars but no active usage.
- People say "cool project" but do not import anything.
- Everyone asks how it differs from Notion or Readwise.
- Onboarding takes too long.
- AI costs money but does not create decisive user value.

Primary work:

- Fix onboarding.
- Improve importers.
- Improve review retention.
- Publish technical and product writeups.
- Turn repeated support questions into docs.

### Phase 4: Durable Attention, 6-12 Months

Credible outcomes:

- 1,000-5,000 GitHub stars.
- 100+ real active users.
- 10+ outside contributors or meaningful issue reporters.
- Newsletter/blog coverage.
- Product Hunt/Hacker News/reddit visibility.
- First hosted-plan revenue, if monetized.

If these do not happen, the project can still be resume-valuable if it has strong engineering artifacts, clear usage metrics, and serious writing.

## Anti-Flop Checklist

MediaLog is likely to flop if people admire it but do not move their real saved content into it. The launch must reduce that risk.

Checklist:

- The landing page explains the pain in one screen.
- The demo shows the complete loop in under 60 seconds.
- The first user action is capture/import, not configuration.
- Import supports at least one high-pain migration source well.
- Users can get value without configuring AI.
- Users can export before they commit.
- The app has a sample dataset or demo mode.
- The repo communicates maturity: tests, migrations, security notes, docs.
- Side features do not confuse the core story.
- The first review session feels useful, not like chores.

## Launch Story

The best public story is founder-led and concrete:

> I built MediaLog because my browser tabs, Apple Notes, Obsidian vault, feeds, files, and AI chats became a junk drawer. Saving was easy, but remembering was not. MediaLog is my attempt to close the loop: capture everything, sort it into topics, read it, revisit it with spacing, synthesize it into topic docs, and export everything as Markdown.

This story is more credible than startup-style hype because it explains the real wound and the real workflow.

## Demo Script

The launch demo should show:

1. Capture a link from browser or mobile.
2. Show it landing in Inbox.
3. Sort it into a topic.
4. Open reader mode.
5. Highlight or add a takeaway.
6. Mark it active or done.
7. Show revisit/SRS scheduling.
8. Show semantic search finding it later.
9. Show topic synthesis doc pulling the knowledge together.
10. Export the topic as Markdown.

The demo must not depend on market widgets, weather, opportunity tracking, or unrelated dashboard features.

## Content Plan

Write in public before and after launch.

High-leverage posts:

- `Why saved links become graveyards`
- `A source is not a system`
- `Building an open-source Readwise/Obsidian alternative with Supabase`
- `Designing a capture -> triage -> retain loop`
- `Why MediaLog uses flat topics instead of folders`
- `How MediaLog exports everything as Markdown`
- `What I learned importing thousands of old notes and tabs`
- `The engineering behind semantic search for a personal knowledge base`
- `How to make AI useful in a notes app without making it the product`

The strongest posts should include screenshots, real examples, tradeoffs, and mistakes.

## Distribution Plan

### Pre-Launch

- Build a waitlist only after the demo is compelling.
- Recruit beta users manually.
- Post progress clips, not vague build-in-public updates.
- Ask specific communities for feedback on workflows, not "would you use this?"

### Launch Week

Suggested order:

1. Publish the GitHub repo and docs.
2. Publish the main launch essay.
3. Post `Show HN`.
4. Share in relevant subreddits and communities with a non-spammy, technical writeup.
5. Launch on Product Hunt after the repo and demo already have some credibility.
6. Direct-message newsletter writers or open-source/productivity curators with a concise note.

### Post-Launch

- Reply to every serious issue.
- Ship fixes publicly.
- Publish a launch retrospective.
- Publish real metrics, including disappointments.
- Convert user questions into docs.
- Release small improvements weekly for the first month.

## Metrics

### Product Metrics

- Weekly active users.
- Imported entries per user.
- Inbox items sorted.
- Review sessions completed.
- Revisit/SRS completions.
- Entries with takeaways/highlights.
- Topic docs created or updated.
- Exports completed.
- Users returning after 7, 14, and 30 days.

### Open-Source Metrics

- GitHub stars.
- Forks.
- Issues opened by outsiders.
- Pull requests from outsiders.
- Self-host installs or deployment clicks.
- Documentation page views.
- Discussions/comments with real use cases.

### Resume Metrics

- Active users.
- Retention.
- Public technical posts.
- Architecture/security/performance writeups.
- Real migration/import scale.
- Test coverage and CI reliability.
- Contributors.
- Uptime or operational notes for hosted version.

Stars alone are not enough. The strongest resume story is retained users plus production-grade engineering.

## Monetization

The least scummy monetization model is:

- Free/open-source self-host core.
- Paid hosted convenience.
- Paid storage/backup/sync limits.
- Paid AI compute for semantic search, synthesis, and triage.
- Student discount or generous free tier.

Do not charge for:

- Export.
- Deletion.
- Basic data access.
- Self-hosting.
- Leaving the product.

The value users pay for should be convenience, reliability, storage, and compute, not lock-in.

## Product Decisions Before Launch

Decide explicitly:

1. Is MediaLog open-source first, hosted SaaS first, or open-core?
2. Are feeds a capture source or a full reader?
3. Is AI optional enhancement or central product promise?
4. Are applications/opportunities removed, hidden, or spun out?
5. Is MCP a developer feature, a future AI-agent feature, or omitted from public launch?
6. What is the default demo dataset?
7. What is the exact free vs paid boundary?
8. What migration source is the flagship import story?

Recommended answers:

- Open-core: self-hostable core plus paid hosted convenience.
- Feeds are a capture source, not the main product.
- AI is optional enhancement, not the headline.
- Applications/opportunities are hidden from launch.
- MCP is omitted from launch copy.
- Demo dataset should show realistic learning/research content.
- Export is always free.
- Flagship import should be Chrome tabs, Pocket/Raindrop, Readwise, Obsidian, or Apple Notes, whichever is most reliable.

## Resume Narrative

If MediaLog gets users:

> Built and launched an open-source knowledge-retention system with capture, import, reader mode, spaced repetition, semantic search, AI topic synthesis, Supabase/Postgres auth and RLS, edge functions, PWA capture flows, Markdown export, and production-grade reliability.

If MediaLog does not get many users:

> Built a production-grade open-source personal knowledge system and documented the product, architecture, security, import, AI, and retention-design tradeoffs in public.

Both are useful. The first is a product story. The second is an engineering story.

## Final Recommendation

Do not launch MediaLog as a broad personal dashboard.

Launch it as a focused open-source knowledge retention system:

```text
Save less blindly.
Sort what matters.
Read with intent.
Revisit on schedule.
Synthesize into durable notes.
Export anytime.
```

That is coherent, useful, and defensible. It also gives the project the best chance at open-source attention without becoming scummy.

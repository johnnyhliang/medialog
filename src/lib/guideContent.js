// In-app user guide. Plain markdown so it stays easy to edit in one place and
// renders through the same MarkdownView as everything else. Update freely — this
// is the living "how I actually use MediaLog" reference, not fixed copy.

export const GUIDE_MARKDOWN = `# How to use MediaLog

MediaLog is your **fourth bucket** — the place for things to *remember / read / reference*.
Calendar holds your time, tasks hold your to-dos, a tracker holds your metrics. This holds
the "I want to remember this" inputs that otherwise rot in open browser tabs.

The whole point is to turn a scrappy pile of links into **structured knowledge with takeaways
you can defend** — without it becoming another Obsidian mess.

---

## The loop (the actual habit)

\`CAPTURE → TRIAGE → CONSUME → RETAIN → SYNTHESIZE\`

1. **Capture cheaply.** Paste a link, answer *"what's worth remembering about this?"* in one
   line. That sentence is a contract with future-you. It lands in **Inbox**. Don't try to
   understand it now — capture and understanding are different steps.
2. **Triage daily.** Hit **Sort Inbox** once a day. Assign each item to a **topic** + a **tag**,
   and decide its difficulty (tag hard ones \`#deep\`). Nothing is "learned" until it's placed
   in a context.
3. **Consume** the resource. For hard things, use an LLM to lower the activation energy first
   (see below).
4. **Retain.** The **Revisit** feed resurfaces least-recently-seen entries so they don't rot.
5. **Synthesize.** Once a topic has 3–4 entries, open its **master doc** and write a few
   sentences connecting them with \`[[\` embeds. This is where links become *your* understanding.

---

## Organizing: topics + tags

- **One entry = one topic.** No subfolders — nesting is what creates the mess.
- **The topic is the area of life it belongs to**, not the format. A video, a paper, and a book
  about ML all live in \`ML\`.
- **Tags are the cross-cutting layer:** media kind (\`#video\` \`#paper\` \`#book\` \`#article\`),
  state (\`#deep\` \`#want-to-try\` \`#research\`), or themes that span topics.
- **Don't make a topic until you have ~3 entries for it.** Until then it lives in
  \`Misc / Interesting\`. The moment a theme emerges there, promote it to its own topic.

### Suggested starting topics
\`ML\` · \`CS\` · \`Systems\` · \`Finance\` · \`Stories\` · \`Misc / Interesting\` ·
\`Skills\` (how-tos) · \`Purchases / Wishlist\` (things you're deciding to buy)

---

## What goes where — worked examples

| You found… | Topic | Tags | Status |
|---|---|---|---|
| A dense ML paper | \`ML\` | \`#paper #deep\` | backlog → active |
| An electric skateboard you might buy | \`Purchases / Wishlist\` | \`#research\` | active until you decide |
| A video on handwritten signatures | \`Skills\` | \`#video #want-to-try\` | backlog |
| An interesting philosophy article | \`Philosophy\` or \`Misc / Interesting\` | \`#article\` | backlog |
| A storyline / story idea | \`Stories\` | — | the note *is* the idea |

**Misc is not a junk drawer.** It's a holding pen with a promotion rule.

---

## Status = your progress tracker

Every entry has a status: **backlog → active → done.**

- **backlog** — queued, not started.
- **active** — you're working through it *right now*. Keep only **one hard thing active** at a
  time. Two active = you finish neither.
- **done** — *only* once you've written a real takeaway (see the Check rule).

The **Progress** view shows per-topic status counts — that's your dashboard for "what am I
actually learning across all my pursuits."

---

## Hard things: using an LLM well

The LLM's job is to make a hard resource *survivable to start* — not to produce your takeaways.

1. Before reading, ask it: *"What's the one core claim in plain language? What do I need to
   already know to follow it?"* (Missing prerequisites is the real reason hard things stall.)
2. Then ask it to *walk you through it as a strong generalist new to the subfield.*
3. **You** read the real thing with that scaffolding.
4. Write your draft takeaway, then optionally paste it back: *"where am I wrong or vague?"*

Never let it write the takeaway for you — the act of writing it is the learning.

---

## Writing a valid takeaway (the Check rule)

A takeaway isn't a summary. In the entry note, force it through three lines:

- **Claim:** what is now true that I didn't know before? (one line)
- **So what:** why does it matter / what does it change for me?
- **Check:** could I explain this to someone — or is it fake-understanding?

**If you can't write the Check line, it isn't done.** Leave status \`active\`, not \`done\`.
That single rule is the difference between "I logged 200 links" and "I learned 200 things."

---

## Capturing fast

- **Quick-add** anywhere for a link + one-line why.
- **iOS Shortcut** to capture from your phone's share sheet (see Settings / setup docs).
- **Bulk Import** — paste a wall of URLs, they all land in Inbox for triage.
- In the note editor, use the **formatting bar** (Bold / Heading / List / Link) instead of
  typing markdown symbols by hand — especially on mobile.

---

## The one-sentence version

> The LLM lowers the cost of *starting* hard things. The why-prompt, status, and Check line
> raise the cost of *fake-finishing* them. The living doc is where it becomes real knowledge.
`

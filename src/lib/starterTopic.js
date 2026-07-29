// The "Start Here" topic seeded on an empty account. It teaches by BEING a
// worked example: real entries, real notes, real links — so a new user reads a
// populated topic instead of clicking through an empty-state tour. The guide
// stays a reference; this is the tutorial.
//
// Same shape as feedStarterPack / interviewSeed: plain data + one seed fn, so
// the content is editable without touching a migration.

export const STARTER_TOPIC_NAME = 'Start Here'

export const STARTER_ENTRIES = [
  {
    note: `**This topic is the tutorial.** Everything you're looking at is a normal entry — you can edit it, delete it, or delete the whole topic when you're done. Nothing here is special-cased.

An entry is a URL, a note, or both. Its title is derived from whatever you wrote, so you never have to name things.`,
  },
  {
    url: 'https://en.wikipedia.org/wiki/Zettelkasten',
    note: `**Entries can just be a link.** Paste a URL with no note and MediaLog fetches the title for you.

The point of the Inbox is that you paste first and decide where it goes later — capture should never make you stop and think about filing.`,
  },
  {
    note: `**Sort the Inbox when you have a minute, not when you capture.** Anything you save without picking a topic lands in Inbox; the home card tells you how many are waiting.

Sorting is the only chore this app asks of you, and it's the one that makes everything else — search, digest, resurfacing — actually work.`,
  },
  {
    note: `**Search understands meaning, not just words.** Every note you write is chunked and embedded in the background, so searching "why did that deploy break" finds the note where you wrote "rollback failed, bad migration" — no shared keywords required.

This runs automatically on save. You never trigger it.`,
  },
  {
    note: `**Reading is for things with chapters.** A book, a course, a long paper — those become *deep topics*, which track sections, remember where you stopped, and collect takeaways as you go.

Regular topics are subject buckets. Deep topics are one resource you're working through. Different jobs, so they live in different views.`,
  },
  {
    note: `**The digest is the payoff.** It resurfaces what you actually wrote — what you've been circling, what went quiet, what connects to what.

It deliberately skips interview problems and deep-topic sections, since curriculum you're grinding through isn't a signal about what's on your mind.`,
  },
  {
    note: `**Make it yours.** Themes live in Settings (four palettes, two styles). The right rail has weather, your feeds, and a *tools & links* shelf you can edit — give each link a note describing what it does, so you can find it later by what it's for rather than what it's called.

When this topic has served its purpose, delete it. That's the intended ending.`,
  },
]

// Seeds the starter topic. Returns the topic row, or null if the account
// already has content (never overwrite a real library).
export async function seedStarterTopic(supabase, { createTopic, createEntry }) {
  const { data: existing } = await supabase
    .from('topics')
    .select('id')
    .eq('name', STARTER_TOPIC_NAME)
    .limit(1)
  if (existing?.length) return null

  const topic = await createTopic(supabase, STARTER_TOPIC_NAME)
  // Sequential, not parallel: entries are ordered by created_at, and the notes
  // above read as a sequence.
  for (const e of STARTER_ENTRIES) {
    await createEntry(supabase, { topicId: topic.id, url: e.url ?? null, note: e.note })
  }
  return topic
}

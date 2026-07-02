// Curated starter sources. kind 'reddit' feeds are polled server-side only,
// with min_score filtering out anything below the day's genuinely good posts.

export const STARTER_PACK = [
  // ── tech pulse (pre-filtered by points) ──
  { name: 'Hacker News (150+ pts)', url: 'https://hnrss.org/newest?points=150', category: 'tech news', kind: 'rss' },
  { name: 'Lobsters', url: 'https://lobste.rs/rss', category: 'tech news', kind: 'rss' },

  // ── indie writers ──
  { name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', category: 'writers', kind: 'rss' },
  { name: 'Dan Luu', url: 'https://danluu.com/atom.xml', category: 'writers', kind: 'rss' },
  { name: 'Julia Evans', url: 'https://jvns.ca/atom.xml', category: 'writers', kind: 'rss' },
  { name: 'fasterthanli.me', url: 'https://fasterthanli.me/index.xml', category: 'writers', kind: 'rss' },
  { name: 'brandur.org', url: 'https://brandur.org/articles.atom', category: 'writers', kind: 'rss' },
  { name: 'rachelbythebay', url: 'https://rachelbythebay.com/w/atom.xml', category: 'writers', kind: 'rss' },
  { name: 'matklad', url: 'https://matklad.github.io/feed.xml', category: 'writers', kind: 'rss' },
  { name: 'Bartosz Ciechanowski', url: 'https://ciechanow.ski/atom.xml', category: 'writers', kind: 'rss' },
  { name: 'Hillel Wayne', url: 'https://buttondown.com/hillelwayne/rss', category: 'writers', kind: 'rss' },

  // ── system design / courses ──
  { name: 'ByteByteGo', url: 'https://blog.bytebytego.com/feed', category: 'system design', kind: 'rss' },

  // ── papers ──
  { name: 'arXiv cs.LG+AI+CL', url: 'https://rss.arxiv.org/rss/cs.LG+cs.AI+cs.CL', category: 'papers', kind: 'rss' },

  // ── dev communities (score-gated) ──
  { name: 'r/ExperiencedDevs', url: 'https://www.reddit.com/r/ExperiencedDevs', category: 'dev', kind: 'reddit', min_score: 200 },
  { name: 'r/MachineLearning', url: 'https://www.reddit.com/r/MachineLearning', category: 'dev', kind: 'reddit', min_score: 100 },

  // ── interests (score-gated) ──
  { name: 'r/ValorantCompetitive', url: 'https://www.reddit.com/r/ValorantCompetitive', category: 'interests', kind: 'reddit', min_score: 500 },
  { name: 'r/guitarlessons', url: 'https://www.reddit.com/r/guitarlessons', category: 'interests', kind: 'reddit', min_score: 150 },
  { name: 'r/hardware', url: 'https://www.reddit.com/r/hardware', category: 'interests', kind: 'reddit', min_score: 400 },
  { name: 'r/buildapcsales', url: 'https://www.reddit.com/r/buildapcsales', category: 'interests', kind: 'reddit', min_score: 200 },
  { name: 'r/suggestmeabook', url: 'https://www.reddit.com/r/suggestmeabook', category: 'interests', kind: 'reddit', min_score: 400 },

  // ── languages (score-gated, lower bar — smaller subs) ──
  { name: 'r/Korean', url: 'https://www.reddit.com/r/Korean', category: 'languages', kind: 'reddit', min_score: 50 },
  { name: 'r/ChineseLanguage', url: 'https://www.reddit.com/r/ChineseLanguage', category: 'languages', kind: 'reddit', min_score: 50 },
]

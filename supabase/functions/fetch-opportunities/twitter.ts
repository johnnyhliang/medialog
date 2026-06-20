import type { Opportunity } from './hn.ts'

const QUERY = [
  '(hiring OR "google form" OR "forms.gle" OR fellowship OR cohort OR "new grad" OR internship OR opportunity OR "looking for" OR "apply here")',
  '(SWE OR engineer OR quant OR researcher OR software OR data OR ML OR AI OR product OR VC)',
  'lang:en -is:retweet -is:reply',
].join(' ')

function emojiCount(text: string): number {
  return (text.match(/\p{Emoji_Presentation}/gu) ?? []).length
}

function isHighQuality(tweet: any, author: any): boolean {
  if (emojiCount(tweet.text) > 3) return false
  if ((author?.public_metrics?.followers_count ?? 0) < 50) return false
  const createdAt = author?.created_at ? new Date(author.created_at) : null
  if (createdAt) {
    const ageMs = Date.now() - createdAt.getTime()
    if (ageMs < 1000 * 60 * 60 * 24 * 180) return false // account < 6 months old
  }
  const tweetAge = Date.now() - new Date(tweet.created_at).getTime()
  if (tweetAge > 1000 * 60 * 60 * 48) return false // older than 48h
  return true
}

export async function fetchTwitter(): Promise<Opportunity[]> {
  const authToken = Deno.env.get('TWITTER_AUTH_TOKEN')
  if (!authToken) {
    console.warn('TWITTER_AUTH_TOKEN not set — skipping Twitter')
    return []
  }

  const params = new URLSearchParams({
    query: QUERY,
    max_results: '50',
    'tweet.fields': 'created_at,author_id,text',
    expansions: 'author_id',
    'user.fields': 'created_at,public_metrics,username',
  })

  let res: Response
  try {
    res = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
      headers: {
        Cookie: `auth_token=${authToken}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'x-twitter-client-language': 'en',
      },
    })
  } catch (e) {
    console.error('Twitter fetch network error:', e)
    return []
  }

  if (res.status === 401) {
    console.error('TWITTER_AUTH_EXPIRED — update TWITTER_AUTH_TOKEN secret')
    return []
  }
  if (!res.ok) {
    console.error(`Twitter fetch failed: ${res.status}`)
    return []
  }

  const json = await res.json()
  const tweets: any[] = json.data ?? []
  const users: Record<string, any> = {}
  for (const u of json.includes?.users ?? []) users[u.id] = u

  return tweets
    .filter((t) => isHighQuality(t, users[t.author_id]))
    .map((t) => {
      const author = users[t.author_id]
      const handle = author?.username ?? null
      return {
        source: 'twitter',
        company: null,
        title: t.text.slice(0, 100),
        body: t.text,
        url: handle ? `https://twitter.com/${handle}/status/${t.id}` : `https://twitter.com/i/web/status/${t.id}`,
        author: handle ? `@${handle}` : null,
        posted_at: t.created_at,
        tags: ['twitter'],
      }
    })
}

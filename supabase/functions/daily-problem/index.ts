// Today's LeetCode daily challenge.
//
// This exists for exactly one reason: leetcode.com/graphql answers 200 to a
// browser but sends no Access-Control-Allow-Origin, so the page cannot read it.
// Codeforces DOES send `*` — but its problemset endpoint is 2.25 MB / 11,347
// problems, which is not a thing to download for a three-row card, so those
// picks are a curated static list on the client instead (src/lib/practice.js).
// Nothing else here needs a server.
//
// Deliberately no database: this is one public fact about today, identical for
// every user. Storing it would mean a table, a cron, and a staleness question,
// to cache something that costs one small request.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json', ...extra },
  })

const QUERY = `query {
  activeDailyCodingChallengeQuestion {
    date
    link
    question { title titleSlug difficulty topicTags { name } }
  }
}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // LeetCode 403s a bare fetch with no UA.
        'user-agent': 'Mozilla/5.0 (compatible; medialog/1.0)',
      },
      body: JSON.stringify({ query: QUERY }),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return json({ problem: null, error: `leetcode ${res.status}` }, 200)

    const body = await res.json()
    const d = body?.data?.activeDailyCodingChallengeQuestion
    if (!d?.question) return json({ problem: null, error: 'unexpected shape' }, 200)

    return json(
      {
        problem: {
          source: 'leetcode',
          date: d.date,
          title: d.question.title,
          difficulty: (d.question.difficulty || '').toLowerCase(),
          tags: (d.question.topicTags ?? []).map((t: { name: string }) => t.name).slice(0, 3),
          url: `https://leetcode.com${d.link}`,
        },
      },
      200,
      // The daily rolls at 00:00 UTC. An hour of CDN cache is free and keeps a
      // page refresh from re-hitting LeetCode.
      { 'cache-control': 'public, max-age=3600' },
    )
  } catch (e) {
    // Never a non-200: the card treats a missing problem as "no daily today"
    // and still renders its static picks. A practice widget must not be able to
    // break Explore.
    return json({ problem: null, error: String(e) }, 200)
  }
})

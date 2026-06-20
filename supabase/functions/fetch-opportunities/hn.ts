export type Opportunity = {
  source: string
  company: string | null
  title: string
  body: string | null
  url: string
  author: string | null
  posted_at: string | null
  tags: string[]
}

export async function fetchHN(): Promise<Opportunity[]> {
  const searchRes = await fetch(
    'https://hn.algolia.com/api/v1/search?query=Ask+HN+Who+is+hiring&tags=story,ask_hn&hitsPerPage=1'
  )
  if (!searchRes.ok) return []
  const searchJson = await searchRes.json()
  const threadId = searchJson?.hits?.[0]?.objectID
  if (!threadId) return []

  const threadRes = await fetch(
    `https://hacker-news.firebaseio.com/v0/item/${threadId}.json`
  )
  if (!threadRes.ok) return []
  const thread = await threadRes.json()
  if (!thread?.kids?.length) return []

  const commentIds: number[] = thread.kids.slice(0, 100)
  const settled = await Promise.allSettled(
    commentIds.map((id) =>
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then((r) => r.json())
    )
  )

  return settled
    .filter(
      (r): r is PromiseFulfilledResult<any> =>
        r.status === 'fulfilled' && r.value?.text
    )
    .map((r) => {
      const item = r.value
      const text = item.text
        .replace(/<[^>]+>/g, ' ')
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .trim()
      const firstLine = text.split('\n')[0].slice(0, 150)
      const companyMatch = firstLine.match(/^([\w][\w\s,\.]+?)\s*[|\-–]/)
      return {
        source: 'hn',
        company: companyMatch?.[1]?.trim() ?? null,
        title: firstLine,
        body: text.slice(0, 1000),
        url: `https://news.ycombinator.com/item?id=${item.id}`,
        author: item.by ?? null,
        posted_at: item.time ? new Date(item.time * 1000).toISOString() : null,
        tags: ['hn'],
      }
    })
}

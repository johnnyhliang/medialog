import type { Opportunity } from './hn.ts'

export async function fetchGithub(): Promise<Opportunity[]> {
  try {
    const r = await fetch(
      'https://gh-trending-api.herokuapp.com/repositories?since=daily',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if (!r.ok) return []
    const repos: any[] = await r.json()
    return repos.slice(0, 10).map((repo) => ({
      source: 'github',
      company: repo.author ?? null,
      title: `${repo.name} — ${repo.description ?? 'trending repo'}`,
      body: repo.description ?? null,
      url: repo.url ?? `https://github.com/${repo.author}/${repo.name}`,
      author: repo.author ?? null,
      posted_at: new Date().toISOString(),
      tags: ['github-trending', repo.language?.toLowerCase()].filter(Boolean) as string[],
    }))
  } catch (e) {
    console.error('GitHub trending fetch error:', e)
    return []
  }
}

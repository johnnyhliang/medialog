import type { Opportunity } from './hn.ts'

type CompanyConfig = {
  slug: string
  name: string
  ats: 'greenhouse' | 'lever' | 'ashby'
  tags?: string[]
}

const COMPANIES: CompanyConfig[] = [
  { slug: 'anthropic', name: 'Anthropic', ats: 'greenhouse', tags: ['ai', 'research'] },
  { slug: 'openai', name: 'OpenAI', ats: 'greenhouse', tags: ['ai', 'research'] },
  { slug: 'cohere', name: 'Cohere', ats: 'greenhouse', tags: ['ai'] },
  { slug: 'mistral', name: 'Mistral', ats: 'ashby', tags: ['ai'] },
  { slug: 'together-ai', name: 'Together AI', ats: 'ashby', tags: ['ai'] },
  { slug: 'perplexity-ai', name: 'Perplexity', ats: 'ashby', tags: ['ai'] },
  { slug: 'stripe', name: 'Stripe', ats: 'greenhouse', tags: ['startup'] },
  { slug: 'linear', name: 'Linear', ats: 'ashby', tags: ['startup'] },
  { slug: 'vercel', name: 'Vercel', ats: 'ashby', tags: ['startup'] },
  { slug: 'anduril', name: 'Anduril', ats: 'greenhouse', tags: ['startup'] },
  { slug: 'figma', name: 'Figma', ats: 'greenhouse', tags: ['startup'] },
  { slug: 'notion', name: 'Notion', ats: 'lever', tags: ['startup'] },
  { slug: 'google', name: 'Google', ats: 'greenhouse', tags: ['big-tech'] },
  { slug: 'meta', name: 'Meta', ats: 'greenhouse', tags: ['big-tech'] },
  { slug: 'apple', name: 'Apple', ats: 'greenhouse', tags: ['big-tech'] },
  { slug: 'amazon-dev-center-u-s', name: 'Amazon', ats: 'greenhouse', tags: ['big-tech'] },
  { slug: 'microsoft', name: 'Microsoft', ats: 'greenhouse', tags: ['big-tech'] },
  { slug: 'two-sigma', name: 'Two Sigma', ats: 'greenhouse', tags: ['quant'] },
  { slug: 'citadel', name: 'Citadel', ats: 'greenhouse', tags: ['quant'] },
  { slug: 'hudson-river-trading', name: 'HRT', ats: 'ashby', tags: ['quant'] },
  { slug: 'optiver', name: 'Optiver', ats: 'greenhouse', tags: ['quant'] },
]

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
}

async function fetchGreenhouse(c: CompanyConfig): Promise<Opportunity[]> {
  const r = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs?content=true`
  )
  if (!r.ok) return []
  const json = await r.json()
  return (json.jobs ?? []).map((j: any) => ({
    source: 'greenhouse',
    company: c.name,
    title: j.title,
    body: j.content ? stripHtml(j.content) : null,
    url: j.absolute_url,
    author: null,
    posted_at: j.updated_at ?? null,
    tags: c.tags ?? [],
  }))
}

async function fetchLever(c: CompanyConfig): Promise<Opportunity[]> {
  const r = await fetch(`https://api.lever.co/v0/postings/${c.slug}?mode=json`)
  if (!r.ok) return []
  const json = await r.json()
  return (json ?? []).map((j: any) => ({
    source: 'lever',
    company: c.name,
    title: j.text,
    body: j.description ? stripHtml(j.description) : null,
    url: j.hostedUrl,
    author: null,
    posted_at: j.createdAt ? new Date(j.createdAt).toISOString() : null,
    tags: c.tags ?? [],
  }))
}

async function fetchAshby(c: CompanyConfig): Promise<Opportunity[]> {
  const r = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${c.slug}`)
  if (!r.ok) return []
  const json = await r.json()
  return (json.jobPostings ?? []).map((j: any) => ({
    source: 'ashby',
    company: c.name,
    title: j.title,
    body: j.descriptionHtml ? stripHtml(j.descriptionHtml) : null,
    url: j.jobUrl,
    author: null,
    posted_at: j.publishedDate ?? null,
    tags: c.tags ?? [],
  }))
}

export async function fetchCareers(): Promise<Opportunity[]> {
  const results = await Promise.allSettled(
    COMPANIES.map((c) => {
      if (c.ats === 'greenhouse') return fetchGreenhouse(c)
      if (c.ats === 'lever') return fetchLever(c)
      return fetchAshby(c)
    })
  )
  return results
    .filter((r): r is PromiseFulfilledResult<Opportunity[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
}

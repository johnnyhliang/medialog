import type { Opportunity } from './hn.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type CompanyConfig = {
  slug: string
  name: string
  ats: 'greenhouse' | 'lever' | 'ashby'
  tags?: string[]
}

// Fallback if DB is empty or unreachable
const FALLBACK_COMPANIES: CompanyConfig[] = [
  { slug: 'anthropic',             name: 'Anthropic',   ats: 'greenhouse', tags: ['ai','research'] },
  { slug: 'openai',                name: 'OpenAI',      ats: 'greenhouse', tags: ['ai','research'] },
  { slug: 'stripe',                name: 'Stripe',      ats: 'greenhouse', tags: ['startup'] },
  { slug: 'two-sigma',             name: 'Two Sigma',   ats: 'greenhouse', tags: ['quant'] },
  { slug: 'citadel',               name: 'Citadel',     ats: 'greenhouse', tags: ['quant'] },
  { slug: 'hudson-river-trading',  name: 'HRT',         ats: 'ashby',      tags: ['quant'] },
]

async function loadCompanies(): Promise<CompanyConfig[]> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data, error } = await supabase
      .from('companies')
      .select('slug, name, ats, tags')
      .eq('enabled', true)
    if (error || !data?.length) return FALLBACK_COMPANIES
    return data as CompanyConfig[]
  } catch {
    return FALLBACK_COMPANIES
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
}

async function fetchGreenhouse(c: CompanyConfig): Promise<Opportunity[]> {
  const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs?content=true`)
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
  const companies = await loadCompanies()
  const results = await Promise.allSettled(
    companies.map((c) => {
      if (c.ats === 'greenhouse') return fetchGreenhouse(c)
      if (c.ats === 'lever') return fetchLever(c)
      return fetchAshby(c)
    })
  )
  return results
    .filter((r): r is PromiseFulfilledResult<Opportunity[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
}

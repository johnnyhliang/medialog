import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchHN } from './hn.ts'
import { fetchCareers } from './careers.ts'
import { fetchTwitter } from './twitter.ts'
import { fetchGithub } from './github.ts'
import type { Opportunity } from './hn.ts'

// Strict student-level keywords matched against title only (for structured career pages)
const STUDENT_TITLE_KEYWORDS = [
  'intern', 'internship', 'fellowship', 'fellow', 'new grad', 'new graduate',
  'entry level', 'entry-level', 'early career', 'university', 'student',
  'cohort', 'rotational', 'explore', 'focus', 'step', 'university grad',
  'associate', 'junior',
]

// Broader keywords for unstructured sources (HN, Twitter) matched against full text
const BROAD_KEYWORDS = [
  'intern', 'internship', 'new grad', 'entry level', 'fellowship', 'cohort',
  'quant', 'research', 'swe', 'vc', 'explore', 'focus', 'step', 'university',
  'phd', 'hiring', 'opportunity', 'apply', 'forms.gle', 'google form',
]

// Exclude senior/leadership titles that slip through on structured career pages
const EXCLUDE_TITLE_KEYWORDS = [
  'senior', 'staff', 'principal', 'lead ', 'head of', 'director', 'manager',
  'vp ', 'vice president', 'partner', 'distinguished',
]

function matchesRoleFilter(item: Opportunity): boolean {
  const title = item.title.toLowerCase()
  const fullText = `${item.title} ${item.body ?? ''}`.toLowerCase()

  // Structured career-page sources: match title against student keywords, exclude senior titles
  const isCareerSource = ['greenhouse', 'lever', 'ashby'].includes(item.source)
  if (isCareerSource) {
    if (EXCLUDE_TITLE_KEYWORDS.some((k) => title.includes(k))) return false
    return STUDENT_TITLE_KEYWORDS.some((k) => title.includes(k))
  }

  // Unstructured sources (HN, Twitter): broader full-text match
  return BROAD_KEYWORDS.some((k) => fullText.includes(k))
}

serve(async (req) => {
  // Guard: only accept calls from pg_cron (which sends X-Cron-Secret)
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret) {
    const incoming = req.headers.get('X-Cron-Secret')
    if (incoming !== cronSecret) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const [hn, careers, twitter, github] = await Promise.allSettled([
    fetchHN(),
    fetchCareers(),
    fetchTwitter(supabase),
    fetchGithub(),
  ])

  const all: Opportunity[] = [
    ...(hn.status === 'fulfilled' ? hn.value : []),
    ...(careers.status === 'fulfilled' ? careers.value : []),
    ...(twitter.status === 'fulfilled' ? twitter.value : []),
    ...(github.status === 'fulfilled' ? github.value : []),
  ]

  // GitHub skips role filter — it's a weak signal source, we want all trending repos
  const filtered = all.filter(
    (item) => item.source === 'github' || matchesRoleFilter(item)
  )

  let inserted = 0
  if (filtered.length > 0) {
    const { error, count } = await supabase
      .from('opportunities')
      .upsert(filtered, { onConflict: 'source,url', ignoreDuplicates: true, count: 'exact' })
    if (error) console.error('upsert error:', error)
    else inserted = count ?? 0
  }

  const sourceCounts = {
    hn: hn.status === 'fulfilled' ? hn.value.length : 'error',
    careers: careers.status === 'fulfilled' ? careers.value.length : 'error',
    twitter: twitter.status === 'fulfilled' ? twitter.value.length : 'error',
    github: github.status === 'fulfilled' ? github.value.length : 'error',
  }

  return new Response(
    JSON.stringify({ fetched: all.length, filtered: filtered.length, inserted, sources: sourceCounts }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchHN } from './hn.ts'
import { fetchCareers } from './careers.ts'
import { fetchTwitter } from './twitter.ts'
import { fetchGithub } from './github.ts'
import type { Opportunity } from './hn.ts'

const ROLE_KEYWORDS = [
  'intern', 'internship', 'new grad', 'entry level', 'fellowship', 'cohort',
  'quant', 'research', 'software engineer', 'swe', 'product', 'vc', 'analyst',
  'explore', 'focus', 'step', 'university', 'phd', 'ml', 'ai', 'data',
  'programmer', 'developer', 'engineer', 'hiring', 'opportunity', 'apply',
  'forms.gle', 'google form',
]

function matchesRoleFilter(item: Opportunity): boolean {
  const text = `${item.title} ${item.body ?? ''}`.toLowerCase()
  return ROLE_KEYWORDS.some((k) => text.includes(k))
}

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const [hn, careers, twitter, github] = await Promise.allSettled([
    fetchHN(),
    fetchCareers(),
    fetchTwitter(),
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

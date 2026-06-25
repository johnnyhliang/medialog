import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchHN } from './hn.ts'
import { fetchTwitter } from './twitter.ts'
import { fetchGithub } from './github.ts'
import type { Opportunity } from './hn.ts'

// Broader keywords for unstructured sources (HN, Twitter) matched against full text
const BROAD_KEYWORDS = [
  'intern', 'internship', 'new grad', 'entry level', 'fellowship', 'cohort',
  'quant', 'research', 'swe', 'vc', 'explore', 'focus', 'step', 'university',
  'phd', 'hiring', 'opportunity', 'apply', 'forms.gle', 'google form',
]

function matchesRoleFilter(item: Opportunity): boolean {
  const fullText = `${item.title} ${item.body ?? ''}`.toLowerCase()
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

  const [hn, twitter, github] = await Promise.allSettled([
    fetchHN(),
    fetchTwitter(supabase),
    fetchGithub(),
  ])

  const githubItems: Opportunity[] = github.status === 'fulfilled' ? github.value : []
  const otherItems: Opportunity[] = [
    ...(hn.status === 'fulfilled' ? hn.value : []),
    ...(twitter.status === 'fulfilled' ? twitter.value : []),
  ]

  const filtered: Opportunity[] = [
    ...githubItems, // GitHub boards already filtered to internship/fellowship rows
    ...otherItems.filter(matchesRoleFilter),
  ]

  let inserted = 0
  if (filtered.length > 0) {
    const { error, count } = await supabase
      .from('opportunities')
      .upsert(filtered, { onConflict: 'source,url', ignoreDuplicates: true, count: 'exact' })
    if (error) console.error('upsert error:', error)
    else inserted = count ?? 0
  }

  // Clean up stale github entries not in this fetch (excluding user-saved items)
  if (githubItems.length > 0) {
    const currentUrlSet = new Set(githubItems.map((i) => i.url))
    const { data: existingGithub } = await supabase
      .from('opportunities')
      .select('id, url')
      .eq('source', 'github')
      .eq('is_saved', false)
    if (existingGithub) {
      const staleIds = existingGithub
        .filter((e) => !currentUrlSet.has(e.url))
        .map((e) => e.id)
      if (staleIds.length > 0) {
        await supabase.from('opportunities').delete().in('id', staleIds)
        console.log(`cleaned up ${staleIds.length} stale github entries`)
      }
    }
  }

  const sourceCounts = {
    hn: hn.status === 'fulfilled' ? hn.value.length : 'error',
    twitter: twitter.status === 'fulfilled' ? twitter.value.length : 'error',
    github: githubItems.length,
  }

  return new Response(
    JSON.stringify({ fetched: filtered.length + otherItems.filter(i => !matchesRoleFilter(i)).length, filtered: filtered.length, inserted, sources: sourceCounts }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

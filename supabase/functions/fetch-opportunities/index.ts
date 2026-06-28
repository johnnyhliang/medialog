import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchGithub } from './github.ts'
import type { Opportunity } from './hn.ts'

serve(async (req) => {

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const github = await fetchGithub().catch(() => [] as Opportunity[])
  const filtered: Opportunity[] = github

  let inserted = 0
  if (filtered.length > 0) {
    const { error, count } = await supabase
      .from('opportunities')
      .upsert(filtered, { onConflict: 'source,url', ignoreDuplicates: true, count: 'exact' })
    if (error) console.error('upsert error:', error)
    else inserted = count ?? 0
  }

  // Clean up stale github entries not in this fetch (excluding user-saved items)
  if (github.length > 0) {
    const currentUrlSet = new Set(github.map((i) => i.url))
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

  return new Response(
    JSON.stringify({ fetched: github.length, filtered: filtered.length, inserted }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

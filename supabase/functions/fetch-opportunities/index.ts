import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchGithub } from './github.ts'
import { fetchHN, type Opportunity } from './hn.ts'
import { fetchCareers } from './careers.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // github.ts was the only source ever called. hn.ts and careers.ts were
  // written, exported and then never imported — and the front end had already
  // been built for them: SOURCE_COLORS in src/lib/opportunities.jsx carries
  // chips for greenhouse/lever/ashby, which only careers.ts can produce. One
  // wire short, again.
  //
  // twitter.ts stays unwired on purpose. It depends on a session cookie, is
  // ToS-gray, and src/lib/modules.js already parks it behind a founder-only
  // module that is off by default. Retiring an experiment should not erase it.
  //
  // allSettled, not all: one source failing must not cost the others their run.
  const [github, hn, careers] = await Promise.all([
    fetchGithub().catch((e) => { console.error('github source failed:', e); return [] as Opportunity[] }),
    fetchHN().catch((e) => { console.error('hn source failed:', e); return [] as Opportunity[] }),
    fetchCareers().catch((e) => { console.error('careers source failed:', e); return [] as Opportunity[] }),
  ])
  console.log(`sources: github=${github.length} hn=${hn.length} careers=${careers.length}`)
  const filtered: Opportunity[] = [...github, ...hn, ...careers]

  let inserted = 0
  if (filtered.length > 0) {
    const { error, count } = await supabase
      .from('opportunities')
      .upsert(filtered, { onConflict: 'source,url', ignoreDuplicates: true, count: 'exact' })
    if (error) console.error('upsert error:', error)
    else inserted = count ?? 0
  }

  // Clean up stale github entries not in this fetch (excluding user-saved items).
  //
  // Still github-only: hn and careers have no reaper yet, so their rows persist.
  // They upsert on (source,url) with ignoreDuplicates, so they accumulate rather
  // than duplicate — acceptable for now, and noted rather than silently assumed.
  //
  // The saved-item guard used to be `.eq('is_saved', false)` on `opportunities`.
  // That column still exists (migration 0013) but migration 0044 moved the real
  // per-user state to `opportunity_state` and only COPIED the values across — it
  // never dropped the legacy column, and nothing has written to it since. So an
  // item saved today sets opportunity_state.is_saved while opportunities.is_saved
  // stays false, and this reaper deleted it the moment it fell out of the GitHub
  // fetch. Saved items disappearing, with nothing reporting it.
  if (github.length > 0) {
    const currentUrlSet = new Set(github.map((i) => i.url))
    const { data: savedRows } = await supabase
      .from('opportunity_state')
      .select('opportunity_id')
      .eq('is_saved', true)
    // Saved by ANY user: the board is global, so one row can be saved by someone
    // else. Deleting it would take it out from under them.
    const savedIds = new Set((savedRows ?? []).map((r) => r.opportunity_id))
    const { data: existingGithub } = await supabase
      .from('opportunities')
      .select('id, url')
      .eq('source', 'github')
    if (existingGithub) {
      const staleIds = existingGithub
        .filter((e) => !currentUrlSet.has(e.url) && !savedIds.has(e.id))
        .map((e) => e.id)
      if (staleIds.length > 0) {
        await supabase.from('opportunities').delete().in('id', staleIds)
        console.log(`cleaned up ${staleIds.length} stale github entries`)
      }
    }
  }

  return new Response(
    JSON.stringify({ fetched: github.length, filtered: filtered.length, inserted }),
    { headers: { ...cors, 'Content-Type': 'application/json' } }
  )
})

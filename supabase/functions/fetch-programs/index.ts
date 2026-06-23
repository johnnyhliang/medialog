import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPEN_PATTERNS = [
  /apply now/i,
  /applications\s+(are\s+)?open/i,
  /forms\.gle/i,
  /now accepting/i,
  /submit your application/i,
]

const DEADLINE_PATTERN = /deadline[:\s]+(\w+ \d+,?\s*\d{4})/i

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

  const { data: programs, error } = await supabase.from('programs').select('*')
  if (error || !programs?.length) {
    return new Response(JSON.stringify({ error: error?.message ?? 'no programs' }), { status: 200 })
  }

  const results: { name: string; window_open: boolean; deadline: string | null }[] = []

  const today = new Date().toISOString().split('T')[0]

  for (const program of programs) {
    try {
      const r = await fetch(program.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      })
      if (!r.ok) continue
      const text = await r.text()
      const wasOpen: boolean = program.window_open
      const deadlineMatch = text.match(DEADLINE_PATTERN)
      const deadline: string | null = deadlineMatch
        ? (() => {
            try { return new Date(deadlineMatch[1]).toISOString().split('T')[0] }
            catch { return program.deadline }
          })()
        : program.deadline

      // Deadline in the past overrides page-content detection
      const deadlinePassed = deadline && deadline < today
      const isOpen = !deadlinePassed && OPEN_PATTERNS.some((p) => p.test(text))

      await supabase
        .from('programs')
        .update({ window_open: isOpen, deadline, last_checked: new Date().toISOString() })
        .eq('id', program.id)

      if (isOpen && !wasOpen) {
        // Window just opened — insert synthetic opportunity
        await supabase.from('opportunities').upsert(
          {
            source: 'program-alert',
            company: program.company,
            title: `${program.name} — applications open`,
            body: program.notes ?? null,
            url: program.url,
            author: null,
            posted_at: new Date().toISOString(),
            tags: ['program-alert', program.category ?? 'program'],
          },
          { onConflict: 'source,url', ignoreDuplicates: false }
        )
      } else if (!isOpen && wasOpen) {
        // Window just closed — remove the stale alert
        await supabase.from('opportunities')
          .delete()
          .eq('source', 'program-alert')
          .eq('url', program.url)
      }

      results.push({ name: program.name, window_open: isOpen, deadline })
    } catch (e) {
      console.error(`fetch-programs error for ${program.name}:`, e)
    }
  }

  return new Response(JSON.stringify({ checked: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

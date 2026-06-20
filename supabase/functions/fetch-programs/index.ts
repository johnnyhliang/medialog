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

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: programs, error } = await supabase.from('programs').select('*')
  if (error || !programs?.length) {
    return new Response(JSON.stringify({ error: error?.message ?? 'no programs' }), { status: 200 })
  }

  const results: { name: string; window_open: boolean; deadline: string | null }[] = []

  for (const program of programs) {
    try {
      const r = await fetch(program.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      })
      if (!r.ok) continue
      const text = await r.text()
      const wasOpen: boolean = program.window_open
      const isOpen = OPEN_PATTERNS.some((p) => p.test(text))
      const deadlineMatch = text.match(DEADLINE_PATTERN)
      const deadline: string | null = deadlineMatch
        ? (() => {
            try { return new Date(deadlineMatch[1]).toISOString().split('T')[0] }
            catch { return program.deadline }
          })()
        : program.deadline

      await supabase
        .from('programs')
        .update({ window_open: isOpen, deadline, last_checked: new Date().toISOString() })
        .eq('id', program.id)

      // Insert synthetic opportunity when window flips open
      if (isOpen && !wasOpen) {
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

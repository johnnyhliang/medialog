import { createClient } from 'jsr:@supabase/supabase-js@2'
// The logic lives in handler.ts so it is reachable from vitest; this file holds
// only what needs the Deno runtime (the `jsr:` client, env, Deno.serve).
import { handleCapture } from './handler.ts'

Deno.serve((req) =>
  handleCapture(req, {
    supabase: createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    ),
    env: (key: string) => Deno.env.get(key),
  })
)

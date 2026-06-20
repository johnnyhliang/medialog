import { createClient } from '@supabase/supabase-js'

export function loadConfig(env = process.env) {
  const supabaseUrl = env.MCP_SUPABASE_URL || env.VITE_SUPABASE_URL
  const supabaseKey =
    env.MCP_SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.MCP_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase configuration. Set MCP_SUPABASE_URL and MCP_SUPABASE_SERVICE_ROLE_KEY (or equivalent VITE_/SUPABASE env vars).',
    )
  }

  return {
    supabaseUrl,
    supabaseKey,
  }
}

export function createSupabaseClient(env = process.env) {
  const { supabaseUrl, supabaseKey } = loadConfig(env)
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

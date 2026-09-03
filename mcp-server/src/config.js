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
    // Writes need an explicit owner. A service-role key has no auth.uid(), so
    // the column defaults that fill user_id in the browser produce null here
    // and every insert fails the NOT NULL constraint. Reads do not need it.
    userId: env.MCP_USER_ID || null,
  }
}

export function loadUserId(env = process.env) {
  return loadConfig(env).userId
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

// Client wrapper for the `ai` edge function. Best-effort: never throws — a
// failed or malformed AI response returns null so the UI can fall back to
// "no suggestion" rather than break.
export async function callAI(supabase, { system, prompt, messages, json = false, model } = {}) {
  try {
    const body = messages
      ? { messages, json, model }
      : { system, prompt, json, model }
    const { data, error } = await supabase.functions.invoke('ai', { body })
    if (error || !data) return null
    return data.content ?? null
  } catch {
    return null
  }
}

// Parse JSON from a model response, tolerating surrounding prose.
export function parseJSON(text) {
  if (!text || typeof text !== 'string') return null
  try {
    return JSON.parse(text)
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      try { return JSON.parse(m[0]) } catch { return null }
    }
    return null
  }
}

// Run a structured (JSON) classification prompt; returns the parsed object or null.
export async function classify(supabase, { system, prompt, model } = {}) {
  const text = await callAI(supabase, { system, prompt, json: true, model })
  return parseJSON(text)
}

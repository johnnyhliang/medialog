# MediaLog Plan 7 — AI Infrastructure (provider-agnostic LLM proxy)

> **For agentic workers:** subagent-driven-development or executing-plans. Checkbox steps.

**Goal:** A server-side LLM proxy the AI features build on — provider-agnostic (OpenAI-compatible `/chat/completions`), default OpenRouter, swappable to Groq/Cerebras via one secret. Plus a client wrapper with safe JSON parsing.

**Design constraint (from the user):** free/small models lose context and can't infer vague intent. So every AI call is a **pre-programmed, structured template** — constrained choices, strict JSON output, explicit rubrics, per-item stateless calls, confidence-gated, human-confirmed. The proxy itself is generic; the *prompts* (Plans 8–9) carry the rigidity. `temperature: 0` for determinism.

**Not Claude/Anthropic** — the user chose a free OpenAI-compatible provider; no Anthropic SDK code.

**Tech Stack:** Supabase Edge Function (Deno) + existing client.

---

## File Structure
```
supabase/functions/ai/index.ts   — Deno proxy to an OpenAI-compatible chat endpoint
src/lib/ai.js                     — callAI, classify, parseJSON
src/lib/ai.test.js
docs/ai-setup.md                  — provider/secret setup (OpenRouter default)
```

## Secrets (user-set, Supabase)
- `AI_BASE_URL` (e.g. `https://openrouter.ai/api/v1`)
- `AI_API_KEY` (the provider key)
- `AI_MODEL` (e.g. `meta-llama/llama-3.3-70b-instruct:free`)

---

## Task 1: `ai` edge function (manual deploy)
**Files:** Create `supabase/functions/ai/index.ts`

Deployed WITH JWT verification (default) so only the authenticated user can spend quota.

- [ ] **Step 1: Implement `supabase/functions/ai/index.ts`**
```ts
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors })

  const body = await req.json().catch(() => null)
  if (!body || (!body.messages && !body.prompt)) {
    return json({ error: 'missing prompt or messages' }, 400)
  }

  const baseUrl = Deno.env.get('AI_BASE_URL')
  const apiKey = Deno.env.get('AI_API_KEY')
  const model = body.model || Deno.env.get('AI_MODEL')
  if (!baseUrl || !apiKey || !model) return json({ error: 'AI provider not configured' }, 500)

  const messages = body.messages || [
    ...(body.system ? [{ role: 'system', content: body.system }] : []),
    { role: 'user', content: body.prompt },
  ]
  const payload = { model, messages, temperature: 0 }
  if (body.json) payload.response_format = { type: 'json_object' }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)
    let res
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) {
      const text = await res.text()
      return json({ error: `provider ${res.status}`, detail: text.slice(0, 500) }, 502)
    }
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content ?? null
    return json({ content })
  } catch (e) {
    return json({ error: 'request failed', detail: String(e).slice(0, 200) }, 502)
  }
})

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
```
- [ ] **Step 2: Commit**
```bash
git add supabase/functions/ai/index.ts
git commit -m "feat: add provider-agnostic AI edge function"
```
- [ ] **Step 3 (USER): set secrets + deploy**
```bash
supabase secrets set AI_BASE_URL=https://openrouter.ai/api/v1
supabase secrets set AI_API_KEY=<your-openrouter-key>
supabase secrets set AI_MODEL=meta-llama/llama-3.3-70b-instruct:free
supabase functions deploy ai
```
(JWT verification ON — no `--no-verify-jwt`.)

---

## Task 2: client wrapper (TDD)
**Files:** Create `src/lib/ai.js`, `src/lib/ai.test.js`

- [ ] **Step 1: Write `src/lib/ai.test.js`**
```js
import { describe, test, expect, vi } from 'vitest'
import { callAI, classify, parseJSON } from './ai.js'

function mockClient(response) {
  return { functions: { invoke: vi.fn(() => Promise.resolve(response)) } }
}

describe('parseJSON', () => {
  test('parses clean json', () => {
    expect(parseJSON('{"a":1}')).toEqual({ a: 1 })
  })
  test('extracts json embedded in surrounding text', () => {
    expect(parseJSON('Sure! {"a":1} done')).toEqual({ a: 1 })
  })
  test('returns null on garbage', () => {
    expect(parseJSON('not json')).toBeNull()
    expect(parseJSON('')).toBeNull()
    expect(parseJSON(null)).toBeNull()
  })
})

describe('callAI', () => {
  test('returns content and sends prompt body', async () => {
    const client = mockClient({ data: { content: 'hello' }, error: null })
    const result = await callAI(client, { prompt: 'hi', system: 'sys' })
    expect(client.functions.invoke).toHaveBeenCalledWith('ai', {
      body: { system: 'sys', prompt: 'hi', json: false, model: undefined },
    })
    expect(result).toBe('hello')
  })
  test('returns null on error (never throws)', async () => {
    const client = mockClient({ data: null, error: { message: 'boom' } })
    expect(await callAI(client, { prompt: 'hi' })).toBeNull()
  })
})

describe('classify', () => {
  test('returns parsed JSON from a json call', async () => {
    const client = mockClient({ data: { content: '{"topic":"AI"}' }, error: null })
    const result = await classify(client, { system: 'rules', prompt: 'entry' })
    expect(client.functions.invoke).toHaveBeenCalledWith('ai', {
      body: { system: 'rules', prompt: 'entry', json: true, model: undefined },
    })
    expect(result).toEqual({ topic: 'AI' })
  })
  test('returns null when the model output is not valid json', async () => {
    const client = mockClient({ data: { content: 'no idea' }, error: null })
    expect(await classify(client, { system: 's', prompt: 'p' })).toBeNull()
  })
})
```
- [ ] **Step 2: Run `npm test -- ai` → FAIL.**
- [ ] **Step 3: Implement `src/lib/ai.js`**
```js
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
```
- [ ] **Step 4: Run `npm test -- ai` → PASS.** Then full suite + build.
- [ ] **Step 5: Commit**
```bash
git add src/lib/ai.js src/lib/ai.test.js
git commit -m "feat: add AI client wrapper with safe JSON parsing"
```

---

## Task 3: setup doc
**Files:** Create `docs/ai-setup.md` — provider options (OpenRouter default, Groq, Cerebras base URLs), how to set the three secrets, recommended free models, and a curl smoke test. Commit.

## Done criteria
- `npm test` green; build green.
- USER: secrets set + `ai` deployed; curl smoke test returns content. Ready for Plan 8 (LLM-assisted bulk import) to call `classify`.

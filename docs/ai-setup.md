# AI setup (provider-agnostic)

MediaLog's AI features call a Supabase Edge Function (`ai`) that proxies an
**OpenAI-compatible `/chat/completions`** endpoint. Pick any provider; switch by
changing one secret. The model is used as a constrained, JSON-output classifier —
prompts carry the rules, so a small/free model is fine.

## Set the secrets

```bash
# OpenRouter (default/recommended)
supabase secrets set AI_BASE_URL=https://openrouter.ai/api/v1
supabase secrets set AI_API_KEY=<your-openrouter-key>
supabase secrets set AI_MODEL=meta-llama/llama-3.3-70b-instruct:free

# Groq (fast, free tier)
#   AI_BASE_URL=https://api.groq.com/openai/v1
#   AI_MODEL=llama-3.3-70b-versatile

# Cerebras (fastest, free tier)
#   AI_BASE_URL=https://api.cerebras.ai/v1
#   AI_MODEL=llama-3.3-70b
```

Pick a **70B-class instruct model** where possible — it follows the structured
prompts and JSON-output rules far more reliably than small models.

## Deploy (JWT-protected — only you can spend quota)

```bash
supabase functions deploy ai
```

Do **not** pass `--no-verify-jwt`: the function should require your login.

## Smoke test

```bash
curl -X POST "https://<project-ref>.functions.supabase.co/ai" \
  -H "Authorization: Bearer <your-supabase-anon-or-session-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Reply with the single word: ok"}'
```

Expected: `{"content":"ok"}` (or similar). A `500 AI provider not configured`
means a secret is missing; a `502 provider ...` surfaces the upstream error.

## Notes
- `temperature: 0` is forced for determinism.
- `{"json": true}` in the body asks the provider for JSON-object output.
- The client wrapper (`src/lib/ai.js`) never throws — a failed/malformed response
  becomes `null`, so the UI degrades to "no suggestion" rather than breaking.

// One sentence in: either a question to answer or a dated task to capture.
//
// The assistant panel is one box. "what did I conclude about market making?"
// and "email the 370 staff about office hours by Friday" arrive through the
// same textarea, and the user should not have to tell the app which is which.
// This runs the sentence through the `ai` edge function the app is already
// authenticated for — no endpoint, no token, no new attack surface — and hands
// back a route plus, for a capture, something the user can check before it is
// written.
//
// The routing decision and the field extraction are ONE call on purpose. Two
// would double the latency and the cost of every message typed into the panel,
// and the model needs the same sentence for both.
//
// Two rules the rest of this file exists to enforce:
//
//   1. The model NEVER emits a timestamp. It returns a bare 'YYYY-MM-DD' and
//      `endOfLocalDay` converts it. A model-authored ISO instant would be in
//      whatever zone the model felt like, and `new Date('2026-09-11')` is UTC
//      midnight — the previous day for everyone west of Greenwich. The date the
//      user dictated must be the date that lands on the agenda.
//
//   2. Nothing here is trusted. A model can return last March, month 19, or a
//      5,000-character title. Anything that fails validation is dropped rather
//      than written, because a wrong deadline is worse than no deadline: it
//      surfaces on the agenda as truth and nobody re-checks it.

import { classify } from './ai.js'
import { localDateString } from './timezone.js'

// Long enough for a real one-line task, short enough that a model that decided
// to echo the whole prompt back cannot become an entry title.
const MAX_TITLE = 200

// A deadline further out than this is a parse failure, not a plan. It is the
// shape a hallucinated year ('2126-03-04') takes, and dropping it costs the
// user one manual date entry while keeping it poisons the agenda for a century.
const MAX_DAYS_AHEAD = 730

// `system` states today's date and the user's IANA zone because without both
// "by Friday" has no referent — the model would resolve it against its own
// training cutoff and be wrong by years, silently.
export function buildSystemPrompt(todayStr, tz) {
  return [
    'You route one message from a personal knowledge app and, when it is a task, extract it. Reply with JSON only.',
    `Today is ${todayStr}. The user is in the IANA timezone ${tz}.`,
    'Resolve every relative date ("Friday", "tomorrow", "end of the month") against that date in that timezone.',
    'Fields:',
    '- "intent": "capture" ONLY when the message is the user telling themselves to DO something — an instruction, a reminder, an errand, usually with a deadline. "ask" for everything else: questions, requests to search or summarise their own notes, observations, and anything you are unsure about.',
    '- "title": for a capture, the task as a short imperative phrase under 200 characters. Keep the concrete details (names, counts, subjects). Drop the date words. Null for an ask.',
    '- "due_at": the deadline as a plain calendar date "YYYY-MM-DD", or null if the message names no deadline. Never output a time, a timezone, or a timestamp.',
    '- "estimate_minutes": a whole number of minutes if the message states or clearly implies a duration, otherwise null.',
    'When in doubt, answer "ask". A question written into someone\'s task list is a wrong row they must find and delete; a task treated as a question costs them one retry.',
    'Never invent a deadline that is not in the message. Never return a date before today.',
    'Example: {"intent":"capture","title":"Email the 370 staff about office hours","due_at":"2026-09-11","estimate_minutes":30}',
    'Example: {"intent":"ask","title":null,"due_at":null,"estimate_minutes":null}',
  ].join('\n')
}

// A calendar date the model actually meant, or null.
//
// The round-trip through Date.UTC is the check that matters: '2026-02-31' and
// '2026-19-04' both match the regex and both normalise to some other day. Only
// a string that comes back identical was a real date.
export function validateDueDate(value, todayStr) {
  if (typeof value !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return null
  const [y, mo, d] = [+m[1], +m[2], +m[3]]
  const utc = Date.UTC(y, mo - 1, d)
  if (localDateString(new Date(utc), 'UTC') !== `${m[1]}-${m[2]}-${m[3]}`) return null
  // Compared as strings on purpose: both sides are already the calendar day in
  // the user's zone, so there is no instant to get wrong. A date in the past is
  // a misparse — nobody dictates a deadline that has already gone by.
  if (value.trim() < todayStr) return null
  const todayUtc = Date.UTC(+todayStr.slice(0, 4), +todayStr.slice(5, 7) - 1, +todayStr.slice(8, 10))
  if ((utc - todayUtc) / 86400000 > MAX_DAYS_AHEAD) return null
  return value.trim()
}

export function validateEstimate(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const n = Math.round(value)
  // A week of solid work is already beyond what a one-sentence capture can mean.
  if (n < 1 || n > 60 * 24 * 7) return null
  return n
}

// Returns { intent: 'ask' } or { intent: 'capture', title, dueDate, estimateMinutes }.
//
// EVERY uncertain path ends at 'ask'. `classify` returns null for a provider
// error, a timeout, malformed JSON, and — the likely common case here — an `ai`
// function with no provider configured at all, which answers 500. In all of
// those the message is still the user's words and still gets answered; the only
// thing lost is the shortcut. A wrong 'capture' instead writes a row into the
// backlog that the user has to notice and delete, and it poisons whats_next.
export async function routeMessage(supabase, text, { tz, now = new Date() } = {}) {
  const ASK = { intent: 'ask' }
  const raw = String(text || '').trim()
  if (!raw || !supabase || !tz) return ASK
  const todayStr = localDateString(now, tz)

  const result = await classify(supabase, {
    system: buildSystemPrompt(todayStr, tz),
    prompt: raw,
  })
  if (!result || typeof result !== 'object') return ASK
  if (result.intent !== 'capture') return ASK

  const title = typeof result.title === 'string' ? result.title.trim() : ''
  // A capture we cannot name is not a capture. Answering the message is the
  // safe half of the fork, so that is where a refused title lands.
  if (!title || title.length > MAX_TITLE) return ASK

  return {
    intent: 'capture',
    title,
    // A bad date does not discard a good title: the user still gets the task,
    // just undated, and the date field is right there to fill in.
    dueDate: validateDueDate(result.due_at, todayStr),
    estimateMinutes: validateEstimate(result.estimate_minutes),
  }
}

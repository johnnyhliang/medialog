// Drafting a `next_action` from what a topic already contains.
// manager-scope.md §9, the last thing built and the narrowest possible use of a
// model in this app.
//
// THE RULE: suggest, never decide. §9 is explicit — "an agent that ranks your
// life is wrong often enough that you stop trusting it, at which point it is
// worse than nothing." So this function drafts ONE line into an editable field
// and nothing more. It never writes to the database, never picks which topic
// matters, never reorders the Manager, and never fires on its own. Everything
// here is pure; the call site owns the (explicit, user-initiated) request.

const MAX_LEN = 120
const RECENT_ENTRIES = 8
const RECENT_STEPS = 6

export const DRAFT_SYSTEM = [
  'You write the single next physical action for a project, in the style of a',
  'terse personal note-to-self. Rules:',
  '- Reply with ONE line, under 100 characters, no quotes, no trailing period.',
  '- It must be a concrete action someone can start in under a minute, not a',
  '  goal, not a theme, not advice.',
  '- Start with a verb.',
  '- Use ONLY what the context gives you. Do not invent chapter numbers, file',
  '  names, dates, tools or people that are not mentioned.',
  '- If the context is too thin to name a real action, reply exactly: UNCLEAR',
].join('\n')

/**
 * The prompt. Deliberately small: the unchecked steps and the newest entry
 * titles, and nothing else.
 *
 * The master doc is NOT sent whole. It can run to hundreds of lines (the seeded
 * plan is 27 steps plus prose), most of it is context the model will happily
 * pattern-match into a plausible-sounding action that is not actually next, and
 * a bigger prompt here buys a worse suggestion at a higher price.
 */
export function buildDraftPrompt({ topic, entries = [], steps = [] } = {}) {
  const name = topic?.name ?? 'Untitled'
  const open = steps.filter((s) => !s.checked).slice(0, RECENT_STEPS).map((s) => s.text)
  const done = steps.filter((s) => s.checked)

  const recent = entries
    .filter((e) => e && !e.deleted_at && e.title)
    .slice(0, RECENT_ENTRIES)
    .map((e) => `- [${e.status ?? 'none'}] ${e.title}`)

  const lines = [`Project: ${name}`]
  if (done.length || open.length) {
    lines.push(`Plan: ${done.length} of ${done.length + open.length} steps done.`)
  }
  if (open.length) lines.push('Next unfinished steps:', ...open.map((s) => `- ${s}`))
  if (recent.length) lines.push('Recent items in this project:', ...recent)
  lines.push('', 'The single next action:')
  return { system: DRAFT_SYSTEM, prompt: lines.join('\n') }
}

/**
 * True when there is genuinely nothing to draft from.
 *
 * Checked before spending a request. An empty topic produces a confident,
 * generic suggestion ("Review your notes and plan next steps") which is exactly
 * the output that teaches you to stop trusting the button.
 */
export function hasDraftContext({ entries = [], steps = [] } = {}) {
  return steps.some((s) => !s.checked) || entries.some((e) => e?.title)
}

/**
 * Clean a model reply into one usable line, or null.
 *
 * Rejects rather than repairs anything suspicious. A bad draft that reaches the
 * input costs more than no draft at all: the user has to notice it is wrong,
 * and the whole feature is worth having only if its output can be trusted at a
 * glance.
 */
export function cleanDraft(text) {
  if (!text || typeof text !== 'string') return null
  let line = text.trim().split('\n').map((l) => l.trim()).find(Boolean)
  if (!line) return null
  if (/^UNCLEAR$/i.test(line)) return null

  // Strip the shapes models add unbidden: leading bullets/numbering, wrapping
  // quotes, and a "Next action:" restatement of the question.
  line = line
    .replace(/^[-*•]\s*/, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/^(the\s+)?(single\s+)?next\s+action:?\s*/i, '')
    .replace(/^["'“”](.*)["'“”]$/, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.$/, '')

  if (!line) return null
  // A paragraph means it ignored the instruction; truncating one would produce
  // a confident half-sentence, which reads worse than nothing.
  if (line.length > MAX_LEN) return null
  return line
}

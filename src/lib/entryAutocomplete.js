import { autocompletion } from '@codemirror/autocomplete'
import { fuzzyFind } from './fuzzyFind.js'

export function filterCandidates(query, candidates, { scope, currentTopicId }) {
  const scoped = scope === 'all'
    ? candidates
    : candidates.filter((c) => c.topicId === currentTopicId)
  return fuzzyFind(query, scoped, ['title'])
}

// CodeMirror completion source: triggers after "[[".
export function makeEntryCompletion(getCandidates, getScopeCtx) {
  function source(context) {
    const before = context.matchBefore(/\[\[([^\]]*)$/)
    if (!before) return null
    const query = before.text.slice(2) // strip the "[["
    if (!context.explicit && before.from === before.to) return null

    const ctx = getScopeCtx()
    const matches = filterCandidates(query, getCandidates(), ctx).slice(0, 20)

    return {
      from: before.from,
      options: matches.map((c) => ({
        label: c.title,
        detail: ctx.scope === 'all' ? c.topicName : undefined,
        apply: `[[entry:${c.id}]]`,
      })),
    }
  }
  return autocompletion({ override: [source] })
}

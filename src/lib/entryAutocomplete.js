import { autocompletion } from '@codemirror/autocomplete'
import { fuzzyFind } from './fuzzyFind.js'
import { parseHeadings } from './headingSlug.js'

export function filterCandidates(query, candidates, { scope, currentTopicId }) {
  const scoped = scope === 'all'
    ? candidates
    : candidates.filter((c) => c.topicId === currentTopicId)
  return fuzzyFind(query, scoped, ['title'])
}

// CodeMirror completion source: "[[#" → headings in the current doc, "[[" → entries.
export function makeEntryCompletion(getCandidates, getScopeCtx, getDocText = () => '') {
  function source(context) {
    // [[#query → heading references (handled before entry embeds; never falls through)
    const headingBefore = context.matchBefore(/\[\[#([^\]]*)$/)
    if (headingBefore) {
      const q = headingBefore.text.slice(3).trim().toLowerCase()
      const headings = parseHeadings(getDocText())
      const matches = headings
        .filter((h) => !q || h.text.toLowerCase().includes(q) || h.slug.includes(q))
        .slice(0, 20)
      if (!matches.length) return null
      return {
        from: headingBefore.from,
        filter: false,
        options: matches.map((h) => ({
          label: h.text,
          detail: `#${h.slug}`,
          apply: `[${h.text}](#${h.slug})`,
          type: 'heading',
        })),
      }
    }

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

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { staticPicks } from '../lib/practice.js'

// Three practice problems, in Explore. See src/lib/practice.js for why only one
// of them is fetched.
//
// Three rows, fixed. The brief was "only a few, not too many", and the reason
// that is the right brief: a list of twenty problems is a backlog, and a
// backlog is a thing you owe. Three is a suggestion you can decline by
// scrolling past.
//
// No "solved" state, no streak, no completion tracking. Those belong to the
// interview tracker, which already models patterns and problems properly. This
// is a doorway, not a second progress system — the app has seven already.

const SOURCE_LABEL = { leetcode: 'LeetCode', cses: 'CSES', codeforces: 'Codeforces' }

export default function PracticeCard({ supabase, timezone }) {
  const [daily, setDaily] = useState(null)
  const picks = staticPicks(new Date(), timezone)

  useEffect(() => {
    let cancelled = false
    supabase.functions
      .invoke('daily-problem')
      .then(({ data }) => { if (!cancelled && data?.problem) setDaily(data.problem) })
      // Silent: the two static picks still render. A practice widget must never
      // be able to break Explore, so there is no toast and no error row.
      .catch(() => {})
    return () => { cancelled = true }
  }, [supabase])

  const rows = daily
    ? [{ source: 'leetcode', title: daily.title, url: daily.url, meta: daily.difficulty }, ...picks]
    : picks

  return (
    <section className="practice">
      <div className="practice-head">
        <span className="practice-title">practice</span>
        <span className="practice-sub muted">
          {daily ? "today's daily, plus two from the canon" : 'two from the canon'}
        </span>
      </div>
      <ul className="practice-list">
        {rows.map((row) => (
          <li key={`${row.source}-${row.url}`} className="practice-row">
            <span className={`practice-source practice-source--${row.source}`}>
              {SOURCE_LABEL[row.source]}
            </span>
            <a href={row.url} target="_blank" rel="noreferrer" className="practice-link">
              {row.title}
              <ExternalLink size={10} />
            </a>
            {row.meta && <span className="practice-meta muted">{row.meta}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

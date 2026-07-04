import { useEffect, useState } from 'react'

// Surfaces highlights saved 30+ days ago so past reading pays interest.
// Rotation is seeded by the date: the picks stay stable all day, then
// change tomorrow — a reason to come back, not a slot machine.

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

function dailyPicks(rows, n) {
  if (rows.length <= n) return rows
  const seed = Math.floor(Date.now() / (24 * 60 * 60 * 1000))
  const picked = []
  const pool = [...rows]
  let s = seed
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) % 2147483648
    picked.push(pool.splice(s % pool.length, 1)[0])
  }
  return picked
}

function monthYear(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export default function ResurfaceWidget({ supabase, onOpenEntry }) {
  const [picks, setPicks] = useState(null)

  useEffect(() => {
    const cutoff = new Date(Date.now() - THIRTY_DAYS).toISOString()
    supabase
      .from('highlights')
      .select('id, text, created_at, entries(id, title, url)')
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(200)
      .then(({ data }) => setPicks(dailyPicks(data ?? [], 2)))
  }, [supabase])

  if (!picks || picks.length === 0) return null

  return (
    <div className="rsf-widget">
      <p className="kw-label">from your archive</p>
      {picks.map((h) => (
        <button
          key={h.id}
          className="rsf-card"
          onClick={() => h.entries && onOpenEntry?.(h.entries)}
          title={h.entries?.title || ''}
        >
          <blockquote className="rsf-quote">{h.text}</blockquote>
          <span className="rsf-source">
            {h.entries?.title || 'untitled'} · saved {monthYear(h.created_at)}
          </span>
        </button>
      ))}
      <div className="kw-divider" />
    </div>
  )
}

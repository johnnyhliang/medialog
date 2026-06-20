import { useEffect, useState } from 'react'

export default function DeadlineAlertBanner({ supabase }) {
  const [programs, setPrograms] = useState([])
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_programs') ?? '[]') }
    catch { return [] }
  })

  useEffect(() => {
    supabase.from('programs').select('*').eq('window_open', true)
      .then(({ data }) => { if (data) setPrograms(data) })
  }, [supabase])

  function dismiss(id) {
    const next = [...dismissed, id]
    setDismissed(next)
    localStorage.setItem('dismissed_programs', JSON.stringify(next))
  }

  const visible = programs
    .filter((p) => !dismissed.includes(p.id))
    .sort((a, b) => {
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    })

  if (!visible.length) return null

  return (
    <div className="deadline-banner">
      {visible.map((p) => (
        <div key={p.id} className="deadline-banner-row">
          <span className="deadline-bell">🔔</span>
          <a href={p.url} target="_blank" rel="noreferrer" className="deadline-name">
            {p.name}
            {p.deadline
              ? ` — deadline ${new Date(p.deadline + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              : ' — applications open'}
          </a>
          <button className="deadline-dismiss" onClick={() => dismiss(p.id)}>×</button>
        </div>
      ))}
    </div>
  )
}

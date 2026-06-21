import { useEffect, useState, useCallback } from 'react'

export default function KeywordsTab({ supabase }) {
  const [keywords, setKeywords] = useState([])
  const [userId, setUserId] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const { data } = await supabase
      .from('user_configs')
      .select('radar_keywords')
      .eq('user_id', user.id)
      .maybeSingle()
    if (data) setKeywords(data.radar_keywords ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function save(next) {
    setKeywords(next)
    await supabase.from('user_configs').update({ radar_keywords: next }).eq('user_id', userId)
  }

  async function add(e) {
    e.preventDefault()
    const kw = input.trim().toLowerCase()
    if (!kw || keywords.includes(kw)) return
    await save([...keywords, kw])
    setInput('')
  }

  async function remove(kw) {
    await save(keywords.filter((k) => k !== kw))
  }

  if (loading) return <p className="kw-empty">Loading…</p>

  return (
    <div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', marginBottom: 12 }}>
        Twitter source searches for tweets containing any of these keywords. Editing takes effect on the next hourly fetch.
      </p>
      <div className="settings-keywords-list">
        {keywords.map((kw) => (
          <span key={kw} className="settings-keyword-chip">
            {kw}
            <button className="settings-keyword-remove" onClick={() => remove(kw)}>×</button>
          </span>
        ))}
        {keywords.length === 0 && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>No keywords yet.</span>}
      </div>
      <form className="settings-keyword-add" onSubmit={add}>
        <input
          placeholder="keyword or phrase…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>
    </div>
  )
}

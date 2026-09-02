import { useEffect, useState, useCallback } from 'react'
import { getRadarKeywords, updateRadarKeywords } from '../../lib/db/userConfig.js'

// Saves on change, not behind a Save button. The write reverts its own optimistic
// update on failure — see ProgramsTab for why.
//
// The read goes through getRadarKeywords, which selects that column ALONE. This
// tab used to read the row it needed via a query it wrote itself; the same row
// holds github_token and twitter_auth_token, and a keyword-chip list has no
// reason to hold a credential in component state.
export default function KeywordsTab({ supabase, addToast = () => {} }) {
  const [keywords, setKeywords] = useState([])
  const [userId, setUserId] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const config = await getRadarKeywords(supabase)
      // null means signed out, which is a state and not a failure — render the
      // empty list rather than an error.
      if (config) {
        setUserId(config.userId)
        setKeywords(config.keywords)
      }
    } catch (e) {
      // Caught, not rethrown: load is also the revert path below.
      addToast(`Couldn’t load keywords: ${e.message}`, 'error')
    }
    setLoading(false)
    // addToast is deliberately not a dependency: it is only read on the failure
    // path, and listing it would re-run the load on every render where the
    // parent hands down a fresh closure — a query storm in exchange for a
    // dependency that can never change what the load does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function save(next) {
    setKeywords(next)
    try {
      await updateRadarKeywords(supabase, userId, next)
      return true
    } catch (e) {
      addToast(`Couldn’t save: ${e.message}`, 'error')
      await load()
      return false
    }
  }

  async function add(e) {
    e.preventDefault()
    const kw = input.trim().toLowerCase()
    if (!kw || keywords.includes(kw)) return
    // Only clear the input once the keyword is actually persisted, so a failed
    // save doesn't also lose what was typed.
    if (await save([...keywords, kw])) setInput('')
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

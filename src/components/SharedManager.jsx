import { useEffect, useState } from 'react'
import { ExternalLink, Copy, Check, Lock } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { listShares, removeShare, shareUrl } from '../lib/db/sharing.js'

// Central manager for everything you've made public. A row here IS the public
// state — "Make private" deletes the registry row, so the link 404s instantly.
export default function SharedManager() {
  const [shares, setShares] = useState(null)
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    listShares(supabase).then(setShares).catch(() => setShares([]))
  }, [])

  async function copy(slug) {
    await navigator.clipboard?.writeText(shareUrl(slug))
    setCopied(slug)
    setTimeout(() => setCopied(null), 1500)
  }

  async function makePrivate(slug) {
    setShares((prev) => prev.filter((s) => s.slug !== slug))
    try { await removeShare(supabase, slug) } catch { listShares(supabase).then(setShares) }
  }

  if (shares === null) return <section><h2>Public sharing</h2><p className="muted">Loading…</p></section>

  return (
    <section>
      <h2>Public sharing</h2>
      <p className="muted" style={{ margin: '0 0 16px', fontSize: 13 }}>
        Everything you’ve made public. Shared pages are fully rendered and read-only.
        Nothing is public until you share it, and “Make private” takes it off this list immediately.
      </p>

      {shares.length === 0 ? (
        <p className="muted">Nothing shared yet. Use the share button on any entry to create a public link.</p>
      ) : (
        <div className="shares-list">
          {shares.map((s) => (
            <div key={s.slug} className="share-row">
              <div className="share-row-info">
                <span className="share-row-title">{s.title || 'Untitled'}</span>
                <a className="share-row-url" href={shareUrl(s.slug)} target="_blank" rel="noopener noreferrer">
                  /s/{s.slug} <ExternalLink size={11} />
                </a>
                <span className="share-row-meta muted">{s.kind} · shared {new Date(s.created_at).toLocaleDateString()}</span>
              </div>
              <div className="share-row-actions">
                <button className="btn-small btn-ghost" onClick={() => copy(s.slug)}>
                  {copied === s.slug ? <Check size={13} /> : <Copy size={13} />} {copied === s.slug ? 'Copied' : 'Copy'}
                </button>
                <button className="btn-small btn-ghost" onClick={() => makePrivate(s.slug)} title="Make private (removes the public link)">
                  <Lock size={13} /> Make private
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

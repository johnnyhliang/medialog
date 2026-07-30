import { useEffect, useState } from 'react'
import { listCaptureTokens, createCaptureToken, revokeCaptureToken } from '../../lib/db/captureTokens.js'

// Mint and revoke per-user capture tokens.
//
// Replaces VITE_CAPTURE_SECRET, which was inlined into the client bundle at build
// time and shared by every user. The plaintext token exists only in the response
// of createCaptureToken — once this component's `fresh` state clears, it is
// unrecoverable, same as a GitHub PAT.

const bookmarkletFor = (baseUrl, token) =>
  `(function(){var u=location.href,t=document.title;fetch('${baseUrl}/functions/v1/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'${token}',url:u,note:t})}).then(function(r){return r.json()}).then(function(d){var m=document.createElement('div');m.textContent=d.duplicate?'Already saved ✓':'Saved ✓';m.style.cssText='position:fixed;top:16px;right:16px;background:#222;color:#fff;padding:8px 16px;border-radius:6px;font:14px sans-serif;z-index:999999';document.body.appendChild(m);setTimeout(function(){m.remove()},2500)}).catch(function(){alert('MediaLog: save failed')})})()`

export default function CaptureTokensTab({ supabase, addToast }) {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  // The one-time plaintext. Held in state only; never persisted.
  const [fresh, setFresh] = useState(null)

  const baseUrl = import.meta.env.VITE_SUPABASE_URL

  useEffect(() => {
    listCaptureTokens(supabase)
      .then(setTokens)
      .catch(() => setTokens([]))
      .finally(() => setLoading(false))
  }, [supabase])

  async function handleCreate(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const row = await createCaptureToken(supabase, label.trim() || null)
      setFresh(row)
      setTokens((prev) => [{ ...row, token: undefined }, ...prev])
      setLabel('')
    } catch (err) {
      addToast?.(err.message, 'error')
    }
    setBusy(false)
  }

  async function handleRevoke(t) {
    setTokens((prev) => prev.filter((x) => x.id !== t.id))
    if (fresh?.id === t.id) setFresh(null)
    try {
      await revokeCaptureToken(supabase, t.id)
    } catch (err) {
      addToast?.(err.message, 'error')
      listCaptureTokens(supabase).then(setTokens).catch(() => {})
    }
  }

  function copy(text, what) {
    navigator.clipboard.writeText(text)
    addToast?.(`${what} copied`, 'success')
  }

  return (
    <section>
      <h2>Capture tokens</h2>
      <div className="card">
        <p className="muted">
          One token per device or shortcut. Each identifies your account to the capture
          endpoint, so nothing shared is baked into the app itself. Revoke a token and
          that device stops working immediately — the rest keep going.
        </p>

        {fresh && (
          <div className="ct-fresh">
            <p className="ct-fresh-warn">
              Copy this now — it is shown once and cannot be recovered.
            </p>
            <code className="ct-token">{fresh.token}</code>
            <div className="ct-fresh-actions">
              <button onClick={() => copy(fresh.token, 'Token')}>copy token</button>
              <button onClick={() => copy(bookmarkletFor(baseUrl, fresh.token), 'Bookmarklet')}>
                copy bookmarklet
              </button>
              <button onClick={() => copy(
                JSON.stringify({ token: fresh.token, url: '[URLs]', note: '[Name]' }),
                'Shortcut body'
              )}>copy shortcut JSON</button>
              <button onClick={() => setFresh(null)}>done</button>
            </div>
            <ol className="ct-hint">
              <li><strong>Bookmarklet:</strong> copy it, make a new browser bookmark, and paste
                the code as the bookmark&rsquo;s <em>URL</em>. Click it on any page to save.</li>
              <li><strong>iOS Shortcut:</strong> copy the shortcut JSON into the Request Body
                field of the &ldquo;Get Contents of URL&rdquo; action.</li>
              <li>Delete any older bookmark or shortcut — tokens you replace should be revoked
                below.</li>
            </ol>
          </div>
        )}

        <form className="ct-create" onSubmit={handleCreate}>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="what is this for? (iPhone, laptop, extension…)"
            aria-label="token label"
          />
          <button type="submit" disabled={busy}>{busy ? 'creating…' : 'new token'}</button>
        </form>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="muted">No tokens yet. Create one to use the bookmarklet or iOS Shortcut.</p>
        ) : (
          <ul className="ct-list">
            {tokens.map((t) => (
              <li key={t.id} className="ct-row">
                <span>
                  <span className="ct-label">{t.label || 'untitled'}</span>
                  <span className="ct-meta">
                    created {new Date(t.created_at).toLocaleDateString()}
                    {t.last_used_at
                      ? ` · last used ${new Date(t.last_used_at).toLocaleDateString()}`
                      : ' · never used'}
                  </span>
                </span>
                <button className="ct-revoke" onClick={() => handleRevoke(t)}>revoke</button>
              </li>
            ))}
          </ul>
        )}

        {import.meta.env.VITE_CAPTURE_SECRET && (
          <p className="ct-legacy">
            <strong>Legacy secret still active.</strong> <code>VITE_CAPTURE_SECRET</code> is set,
            which means it is compiled into this page&rsquo;s JavaScript and shared by every
            visitor. Once your devices use tokens, unset both it and the{' '}
            <code>CAPTURE_SECRET</code> Supabase secret — that is what actually closes the hole.
          </p>
        )}
      </div>
    </section>
  )
}

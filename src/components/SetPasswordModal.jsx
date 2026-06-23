import { useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

function passwordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: 'transparent' }
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: 'weak', color: '#d9534f' }
  if (score <= 2) return { score, label: 'fair', color: '#e8a838' }
  if (score <= 3) return { score, label: 'good', color: '#5b9bd5' }
  return { score, label: 'strong', color: '#3D5A4A' }
}

export default function SetPasswordModal({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const strength = passwordStrength(password)
  const mismatch = confirm && password !== confirm

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => onDone?.(), 1200)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '16px',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '10px', padding: '28px 24px', width: '100%', maxWidth: '360px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <p style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px', letterSpacing: '-.02em' }}>
          set your password
        </p>
        <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 20px' }}>
          you signed in via a reset link — set a password to use next time.
        </p>

        {done ? (
          <p style={{ color: 'var(--done)', fontSize: '14px', textAlign: 'center' }}>
            password set ✓
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <input
                type="password"
                placeholder="new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: '6px',
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)', fontSize: '14px', boxSizing: 'border-box',
                }}
              />
              {password && (
                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    flex: 1, height: '3px', borderRadius: '2px',
                    background: 'var(--border)', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: '2px',
                      width: `${(strength.score / 4) * 100}%`,
                      background: strength.color,
                      transition: 'width 0.2s, background 0.2s',
                    }} />
                  </div>
                  <span style={{ fontSize: '11px', color: strength.color, minWidth: '40px' }}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>
            <input
              type="password"
              placeholder="confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '6px',
                border: `1px solid ${mismatch ? '#d9534f' : 'var(--border)'}`,
                background: 'var(--bg)', color: 'var(--text)', fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
            {error && <p style={{ color: '#d9534f', fontSize: '12px', margin: 0 }}>{error}</p>}
            <button
              type="submit"
              disabled={loading || !password || !confirm}
              style={{
                padding: '10px', borderRadius: '6px', border: 'none',
                background: 'var(--accent)', color: '#fff', fontSize: '14px',
                fontWeight: 600, cursor: 'pointer', marginTop: '4px',
                opacity: (loading || !password || !confirm) ? 0.6 : 1,
              }}
            >
              {loading ? 'saving…' : 'set password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

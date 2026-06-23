import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient.js'

export default function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false)
  const [mode, setMode] = useState('auth') // 'auth' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      if (session) window.location.replace('/app')
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  function openAuth(initialMode = 'signin') {
    setMode(initialMode)
    setError('')
    setConfirmed(false)
    setAuthOpen(true)
  }

  async function handleSubmit() {
    setError('')
    setLoading(true)
    // Try sign in first. If credentials are wrong for an existing account that's a real error.
    // If the account doesn't exist, Supabase returns the same "Invalid login credentials" —
    // disambiguate by attempting sign up and checking the response.
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
    if (!signInErr) { setLoading(false); return } // success → onAuthStateChange redirects

    if (signInErr.message === 'Invalid login credentials') {
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + '/app' },
      })
      if (!signUpErr) { setConfirmed(true) }
      else if (signUpErr.message.toLowerCase().includes('already registered')) {
        setError('Wrong password.')
      } else {
        setError(signUpErr.message)
      }
    } else {
      setError(signInErr.message)
    }
    setLoading(false)
  }

  async function sendReset() {
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/app',
    })
    setLoading(false)
    if (err) setError(err.message)
    else setConfirmed(true)
  }

  async function signInGitHub() {
    setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin + '/app' },
    })
    if (err) setError(err.message)
  }

  return (
    <>
      {/* ── Nav ── */}
      <nav className="nav">
        <span className="nav-brand">medialog</span>
        <div className="nav-center">
          <a href="#">pricing</a>
          <a href="#opensource">open source</a>
          <a href="https://github.com" target="_blank" rel="noopener">github</a>
          <a href="#">docs</a>
        </div>
        <div className="nav-right">
          <a href="#" onClick={(e) => { e.preventDefault(); openAuth('signin') }}>sign in</a>
          <a href="#" onClick={(e) => { e.preventDefault(); openAuth('signup') }} className="nav-signup">sign up →</a>
        </div>
      </nav>

      {/* auth modal */}
      <div
        className={`auth-overlay${authOpen ? ' open' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) setAuthOpen(false) }}
      >
        <div className="auth-modal">
          <button className="auth-close" onClick={() => setAuthOpen(false)}>×</button>
          <p className="auth-title">medialog.</p>
          {confirmed ? (
            <p className="auth-sent">
              {mode === 'reset' ? 'check your email for a password reset link ✓' : 'check your email to confirm your account ✓'}
            </p>
          ) : mode === 'reset' ? (
            <>
              <p className="auth-sub">enter your email and we'll send a reset link.</p>
              <input
                className="auth-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && email) sendReset() }}
              />
              <button className="auth-btn-magic" onClick={sendReset} disabled={loading || !email}>
                {loading ? '…' : 'send reset link'}
              </button>
              <button className="auth-link" onClick={() => { setMode('auth'); setError('') }}>
                back to sign in
              </button>
              {error && <p className="auth-error">{error}</p>}
            </>
          ) : (
            <>
              <p className="auth-sub">sign in or create an account.</p>
              <input
                className="auth-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
              />
              <input
                className="auth-input"
                type="password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
              />
              <button className="auth-btn-magic" onClick={handleSubmit} disabled={loading || !email || !password}>
                {loading ? '…' : 'continue'}
              </button>
              <button className="auth-link" onClick={() => { setMode('reset'); setError('') }}>
                forgot password?
              </button>
              <div className="auth-divider">or</div>
              <button className="auth-btn-github" onClick={signInGitHub}>
                continue with github
              </button>
              {error && <p className="auth-error">{error}</p>}
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════
           § 1  HERO  — centered Notion-style
      ══════════════════════════════════════ */}
      <section className="hero">
        <p className="hero-eyebrow">
          <span className="hero-eyebrow-dot"></span>
          personal knowledge, revisited
        </p>
        <h1 className="hero-display">medialog.</h1>
        <p className="hero-tagline">for people who save too much and retain too little. capture, triage, consume, retain.</p>
        <div className="hero-cta">
          <a href="#" onClick={(e) => { e.preventDefault(); openAuth('signup') }} className="btn-primary">get started free →</a>
          <a href="https://github.com" target="_blank" rel="noopener" className="btn-link">github ↗</a>
        </div>
      </section>

      {/* hero mockup — bleeds edge to edge below text */}
      <div className="hero-mockup-outer">
        <div className="hero-mockup-glow"></div>
        <div className="hero-mockup">
          <svg viewBox="0 0 1100 520" fill="none" preserveAspectRatio="xMidYMin slice">
            <rect width="1100" height="520" fill="#F2EDE3"/>
            {/* sidebar */}
            <rect width="200" height="520" fill="#EAE4D8"/>
            <rect x="200" width="1" height="520" fill="#DDD7CB"/>
            <rect x="20" y="32" width="72" height="7" rx="2" fill="#A89E92"/>
            {/* nav items */}
            <rect x="12" y="56" width="176" height="30" rx="3" fill="rgba(61,90,74,0.09)"/>
            <rect x="12" y="56" width="3" height="30" rx="1" fill="#3D5A4A"/>
            <rect x="26" y="66" width="60" height="7" rx="2" fill="#3D5A4A"/>
            <rect x="26" y="96" width="80" height="7" rx="2" fill="#A89E92"/>
            <rect x="26" y="114" width="68" height="7" rx="2" fill="#A89E92"/>
            <rect x="26" y="132" width="92" height="7" rx="2" fill="#A89E92"/>
            <rect x="26" y="150" width="64" height="7" rx="2" fill="#A89E92"/>
            <rect x="26" y="168" width="76" height="7" rx="2" fill="#A89E92"/>
            <rect x="26" y="186" width="56" height="7" rx="2" fill="#A89E92"/>
            {/* separator */}
            <rect x="12" y="210" width="176" height="1" fill="#DDD7CB"/>
            <rect x="26" y="224" width="48" height="6" rx="2" fill="#C9C4B8"/>
            <rect x="26" y="240" width="88" height="6" rx="2" fill="#C9C4B8"/>
            <rect x="26" y="256" width="72" height="6" rx="2" fill="#C9C4B8"/>
            {/* topbar */}
            <rect x="200" y="0" width="900" height="44" fill="#F8F5EE"/>
            <rect x="220" y="16" width="100" height="8" rx="2" fill="#A89E92"/>
            <rect x="920" y="12" width="156" height="20" rx="3" fill="#3D5A4A"/>
            <rect x="932" y="17" width="132" height="10" rx="2" fill="rgba(255,255,255,0.6)"/>
            <rect x="200" y="44" width="900" height="1" fill="#DDD7CB"/>
            {/* content header */}
            <rect x="220" y="60" width="80" height="8" rx="2" fill="#7A7264"/>
            <rect x="220" y="80" width="880" height="1" fill="#DDD7CB" opacity=".6"/>
            {/* entry rows */}
            {/* row 1 */}
            <rect x="220" y="92" width="460" height="8" rx="2" fill="#1C1A15" opacity=".65"/>
            <rect x="220" y="106" width="280" height="6" rx="2" fill="#A89E92"/>
            <rect x="980" y="93" width="96" height="18" rx="9" fill="#C8D8D0"/>
            <rect x="990" y="98" width="76" height="8" rx="2" fill="#3D5A4A"/>
            <rect x="220" y="124" width="876" height="1" fill="#DDD7CB" opacity=".45"/>
            {/* row 2 highlighted */}
            <rect x="200" y="125" width="900" height="52" fill="rgba(61,90,74,0.05)"/>
            <rect x="200" y="125" width="3" height="52" fill="#3D5A4A"/>
            <rect x="220" y="137" width="380" height="8" rx="2" fill="#1C1A15" opacity=".82"/>
            <rect x="220" y="151" width="200" height="6" rx="2" fill="#3D5A4A" opacity=".5"/>
            <rect x="980" y="138" width="96" height="18" rx="9" fill="#3D5A4A"/>
            <rect x="992" y="143" width="72" height="8" rx="2" fill="rgba(255,255,255,0.7)"/>
            <rect x="220" y="177" width="876" height="1" fill="#DDD7CB" opacity=".4"/>
            {/* row 3 */}
            <rect x="220" y="189" width="320" height="8" rx="2" fill="#1C1A15" opacity=".55"/>
            <rect x="220" y="203" width="220" height="6" rx="2" fill="#A89E92"/>
            <rect x="980" y="190" width="96" height="18" rx="9" fill="#F2EDE3"/>
            <rect x="988" y="195" width="80" height="8" rx="2" fill="#A89E92"/>
            <rect x="220" y="221" width="876" height="1" fill="#DDD7CB" opacity=".35"/>
            {/* row 4 */}
            <rect x="220" y="233" width="500" height="8" rx="2" fill="#1C1A15" opacity=".45"/>
            <rect x="220" y="247" width="180" height="6" rx="2" fill="#A89E92"/>
            <rect x="980" y="234" width="96" height="18" rx="9" fill="#F2EDE3"/>
            <rect x="988" y="239" width="80" height="8" rx="2" fill="#A89E92"/>
            <rect x="220" y="265" width="876" height="1" fill="#DDD7CB" opacity=".28"/>
            {/* row 5 */}
            <rect x="220" y="277" width="260" height="8" rx="2" fill="#1C1A15" opacity=".35"/>
            <rect x="220" y="291" width="160" height="6" rx="2" fill="#C9C4B8"/>
            <rect x="220" y="309" width="876" height="1" fill="#DDD7CB" opacity=".2"/>
            {/* detail panel bottom half */}
            <rect x="220" y="320" width="876" height="200" fill="#F8F5EE"/>
            <rect x="220" y="320" width="876" height="1" fill="#DDD7CB"/>
            <rect x="240" y="344" width="260" height="10" rx="2" fill="#1C1A15" opacity=".5"/>
            <rect x="240" y="364" width="600" height="6" rx="2" fill="#C9C4B8"/>
            <rect x="240" y="376" width="540" height="6" rx="2" fill="#C9C4B8"/>
            <rect x="240" y="388" width="480" height="6" rx="2" fill="#C9C4B8"/>
            {/* metadata sidebar of detail */}
            <rect x="240" y="412" width="1" height="60" fill="#DDD7CB"/>
            <rect x="254" y="416" width="64" height="6" rx="2" fill="#A89E92"/>
            <rect x="330" y="416" width="100" height="6" rx="2" fill="#C9C4B8"/>
            <rect x="254" y="430" width="64" height="6" rx="2" fill="#A89E92"/>
            <rect x="330" y="430" width="64" height="6" rx="2" fill="#C9C4B8"/>
            <rect x="254" y="444" width="64" height="6" rx="2" fill="#A89E92"/>
            <rect x="330" y="444" width="80" height="6" rx="2" fill="#3D5A4A" opacity=".6"/>
            {/* status bar */}
            <rect y="500" width="1100" height="20" fill="#F2EDE3"/>
            <rect y="500" width="1100" height="1" fill="#DDD7CB"/>
            <rect x="220" y="508" width="96" height="5" rx="2" fill="#C9C4B8"/>
            <rect x="900" y="507" width="180" height="6" rx="2" fill="#EAE4D8"/>
          </svg>
        </div>
      </div>

      {/* ══════════════════════════════════════
           § 2  STATS  — kernel.sh-style strip
      ══════════════════════════════════════ */}
      <div className="stats">
        <div className="stat-item">
          <div className="stat-value">5</div>
          <div className="stat-label">stages in the loop</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">mit</div>
          <div className="stat-label">open source license</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">.md</div>
          <div className="stat-label">plain markdown export</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">∞</div>
          <div className="stat-label">self-hostable, your data</div>
        </div>
      </div>

      {/* ══════════════════════════════════════
           § 3  FEATURES  — alternating blocks
      ══════════════════════════════════════ */}
      <section className="features">

        {/* capture + triage */}
        <div className="feat-block">
          <div className="feat-text">
            <p className="feat-stage">capture → triage</p>
            <h3 className="feat-head">everything in.<br/>nothing unsorted.</h3>
            <p className="feat-copy">paste a link, type a note, bulk import from pocket or notion. inbox forces triage — every item gets a topic before it disappears.</p>
          </div>
          <div className="feat-visual">
            <svg viewBox="0 0 480 360" fill="none" preserveAspectRatio="xMidYMid slice">
              <rect width="480" height="360" fill="#EAE4D8"/>
              {/* inbox card */}
              <rect x="32" y="40" width="416" height="280" rx="4" fill="#F8F5EE" stroke="#DDD7CB" strokeWidth="1"/>
              <rect x="32" y="40" width="416" height="36" rx="4" fill="#F2EDE3"/>
              <rect x="32" y="64" width="416" height="12" fill="#F2EDE3"/>
              <rect x="48" y="52" width="56" height="6" rx="2" fill="#A89E92"/>
              <rect x="380" y="50" width="52" height="18" rx="3" fill="#3D5A4A"/>
              <rect x="388" y="55" width="36" height="8" rx="2" fill="rgba(255,255,255,0.65)"/>
              {/* items */}
              <rect x="48" y="92" width="360" height="8" rx="2" fill="#1C1A15" opacity=".7"/>
              <rect x="48" y="106" width="240" height="6" rx="2" fill="#A89E92"/>
              <rect x="388" y="92" width="48" height="18" rx="9" fill="#EAE4D8" stroke="#DDD7CB" strokeWidth="1"/>
              <rect x="396" y="97" width="32" height="8" rx="2" fill="#A89E92"/>
              <rect x="48" y="126" width="400" height="1" fill="#DDD7CB" opacity=".6"/>
              {/* item 2 — highlighted/active */}
              <rect x="32" y="127" width="416" height="48" fill="rgba(61,90,74,0.04)"/>
              <rect x="32" y="127" width="3" height="48" fill="#3D5A4A"/>
              <rect x="48" y="139" width="280" height="8" rx="2" fill="#1C1A15" opacity=".8"/>
              <rect x="48" y="153" width="160" height="6" rx="2" fill="#3D5A4A" opacity=".5"/>
              <rect x="388" y="139" width="48" height="18" rx="9" fill="#3D5A4A"/>
              <rect x="396" y="144" width="32" height="8" rx="2" fill="rgba(255,255,255,0.7)"/>
              <rect x="48" y="175" width="400" height="1" fill="#DDD7CB" opacity=".45"/>
              {/* item 3 */}
              <rect x="48" y="187" width="300" height="8" rx="2" fill="#1C1A15" opacity=".55"/>
              <rect x="48" y="201" width="180" height="6" rx="2" fill="#A89E92"/>
              <rect x="388" y="187" width="48" height="18" rx="9" fill="#EAE4D8" stroke="#DDD7CB" strokeWidth="1"/>
              <rect x="396" y="192" width="32" height="8" rx="2" fill="#A89E92"/>
              <rect x="48" y="221" width="400" height="1" fill="#DDD7CB" opacity=".35"/>
              {/* item 4 */}
              <rect x="48" y="233" width="200" height="8" rx="2" fill="#1C1A15" opacity=".4"/>
              <rect x="48" y="247" width="120" height="6" rx="2" fill="#C9C4B8"/>
              <rect x="388" y="233" width="48" height="18" rx="9" fill="#EAE4D8" stroke="#DDD7CB" strokeWidth="1"/>
              <rect x="396" y="238" width="32" height="8" rx="2" fill="#C9C4B8"/>
              <rect x="48" y="267" width="400" height="1" fill="#DDD7CB" opacity=".25"/>
              {/* triage prompt at bottom */}
              <rect x="48" y="284" width="200" height="24" rx="3" fill="#F2EDE3" stroke="#DDD7CB" strokeWidth="1"/>
              <rect x="60" y="292" width="80" height="8" rx="2" fill="#A89E92"/>
              <rect x="268" y="284" width="80" height="24" rx="3" fill="#3D5A4A"/>
              <rect x="278" y="292" width="60" height="8" rx="2" fill="rgba(255,255,255,0.65)"/>
            </svg>
          </div>
        </div>

        {/* consume + retain */}
        <div className="feat-block reverse">
          <div className="feat-text">
            <p className="feat-stage">consume → retain</p>
            <h3 className="feat-head">read it once.<br/>remember it longer.</h3>
            <p className="feat-copy">reader mode strips distractions. srs scheduling resurfaces entries at the right interval — so what you read doesn't evaporate.</p>
          </div>
          <div className="feat-visual">
            <svg viewBox="0 0 480 360" fill="none" preserveAspectRatio="xMidYMid slice">
              <rect width="480" height="360" fill="#F2EDE3"/>
              {/* reader card */}
              <rect x="52" y="32" width="376" height="296" rx="4" fill="#F8F5EE" stroke="#DDD7CB" strokeWidth="1"/>
              {/* reader topbar */}
              <rect x="52" y="32" width="376" height="36" rx="4" fill="#EAE4D8"/>
              <rect x="52" y="56" width="376" height="12" fill="#EAE4D8"/>
              <rect x="68" y="46" width="80" height="6" rx="2" fill="#A89E92"/>
              {/* breadcrumb-style status */}
              <rect x="348" y="44" width="64" height="16" rx="8" fill="#3D5A4A"/>
              <rect x="356" y="49" width="48" height="6" rx="2" fill="rgba(255,255,255,0.7)"/>
              {/* article title */}
              <rect x="68" y="80" width="300" height="10" rx="2" fill="#1C1A15" opacity=".75"/>
              <rect x="68" y="96" width="220" height="8" rx="2" fill="#1C1A15" opacity=".6"/>
              {/* meta line */}
              <rect x="68" y="116" width="80" height="6" rx="2" fill="#A89E92"/>
              <rect x="156" y="116" width="4" height="6" rx="2" fill="#DDD7CB"/>
              <rect x="168" y="116" width="60" height="6" rx="2" fill="#A89E92"/>
              <rect x="68" y="132" width="340" height="1" fill="#DDD7CB" opacity=".6"/>
              {/* body text */}
              <rect x="68" y="148" width="340" height="6" rx="2" fill="#C9C4B8"/>
              <rect x="68" y="160" width="320" height="6" rx="2" fill="#C9C4B8"/>
              <rect x="68" y="172" width="340" height="6" rx="2" fill="#C9C4B8"/>
              <rect x="68" y="184" width="280" height="6" rx="2" fill="#C9C4B8"/>
              <rect x="68" y="204" width="340" height="6" rx="2" fill="#C9C4B8"/>
              <rect x="68" y="216" width="300" height="6" rx="2" fill="#C9C4B8"/>
              <rect x="68" y="228" width="340" height="6" rx="2" fill="#C9C4B8"/>
              {/* revisit schedule panel */}
              <rect x="68" y="256" width="340" height="60" rx="3" fill="#EAE4D8"/>
              <rect x="80" y="268" width="72" height="6" rx="2" fill="#A89E92"/>
              <rect x="80" y="282" width="120" height="8" rx="2" fill="#3D5A4A" opacity=".7"/>
              <rect x="300" y="264" width="96" height="20" rx="3" fill="#3D5A4A"/>
              <rect x="312" y="270" width="72" height="8" rx="2" fill="rgba(255,255,255,0.65)"/>
              <rect x="300" y="290" width="96" height="16" rx="3" fill="#F2EDE3" stroke="#DDD7CB" strokeWidth="1"/>
              <rect x="312" y="295" width="72" height="6" rx="2" fill="#A89E92"/>
            </svg>
          </div>
        </div>

        {/* synthesize */}
        <div className="feat-block">
          <div className="feat-text">
            <p className="feat-stage">synthesize</p>
            <h3 className="feat-head">your topics<br/>write themselves.</h3>
            <p className="feat-copy">a running document per topic, built from every entry you've consumed. a reference that grows as you read, not one you have to maintain.</p>
          </div>
          <div className="feat-visual">
            <svg viewBox="0 0 480 360" fill="none" preserveAspectRatio="xMidYMid slice">
              <rect width="480" height="360" fill="#EAE4D8"/>
              {/* topic doc */}
              <rect x="32" y="32" width="416" height="296" rx="4" fill="#F8F5EE" stroke="#DDD7CB" strokeWidth="1"/>
              <rect x="32" y="32" width="416" height="40" rx="4" fill="#F2EDE3"/>
              <rect x="32" y="60" width="416" height="12" fill="#F2EDE3"/>
              <rect x="48" y="48" width="100" height="7" rx="2" fill="#A89E92"/>
              {/* doc content */}
              <rect x="48" y="88" width="200" height="10" rx="2" fill="#1C1A15" opacity=".7"/>
              <rect x="48" y="106" width="380" height="6" rx="2" fill="#C9C4B8"/>
              <rect x="48" y="118" width="360" height="6" rx="2" fill="#C9C4B8"/>
              <rect x="48" y="130" width="340" height="6" rx="2" fill="#C9C4B8"/>
              <rect x="48" y="142" width="280" height="6" rx="2" fill="#C9C4B8"/>
              {/* subheading */}
              <rect x="48" y="162" width="140" height="8" rx="2" fill="#1C1A15" opacity=".55"/>
              <rect x="48" y="178" width="380" height="6" rx="2" fill="#C9C4B8"/>
              <rect x="48" y="190" width="320" height="6" rx="2" fill="#C9C4B8"/>
              <rect x="48" y="202" width="360" height="6" rx="2" fill="#C9C4B8"/>
              {/* sources list */}
              <rect x="48" y="226" width="380" height="1" fill="#DDD7CB"/>
              <rect x="48" y="238" width="64" height="6" rx="2" fill="#A89E92"/>
              {/* source chips */}
              <rect x="48" y="254" width="120" height="20" rx="10" fill="#EAE4D8" stroke="#DDD7CB" strokeWidth="1"/>
              <rect x="60" y="260" width="96" height="8" rx="2" fill="#A89E92"/>
              <rect x="180" y="254" width="120" height="20" rx="10" fill="#EAE4D8" stroke="#DDD7CB" strokeWidth="1"/>
              <rect x="192" y="260" width="96" height="8" rx="2" fill="#A89E92"/>
              <rect x="312" y="254" width="120" height="20" rx="10" fill="#EAE4D8" stroke="#DDD7CB" strokeWidth="1"/>
              <rect x="324" y="260" width="96" height="8" rx="2" fill="#A89E92"/>
              {/* add entry indicator */}
              <rect x="48" y="292" width="180" height="24" rx="3" fill="#3D5A4A" opacity=".08" stroke="#3D5A4A" strokeWidth="1" strokeOpacity=".3"/>
              <rect x="60" y="300" width="100" height="8" rx="2" fill="#3D5A4A" opacity=".5"/>
            </svg>
          </div>
        </div>

      </section>

      {/* ══════════════════════════════════════
           § 4  QUOTE  — centered
      ══════════════════════════════════════ */}
      <section className="quote-section">
        <p className="quote-text">"a source is not a system."</p>
        <p className="quote-cap">notion stores. obsidian links. pocket saves. none of them surface things back to you on a schedule. that's the gap medialog fills.</p>
      </section>

      {/* ══════════════════════════════════════
           § 5  MIGRATION  — 2×2 grid
      ══════════════════════════════════════ */}
      <section className="migration">
        <p className="migration-eyebrow">coming from another tool?</p>
        <div className="migration-grid">
          <div className="mig-card">
            <p className="mig-from">from notion</p>
            <p className="mig-head">your database<br/>was never a workflow.</p>
            <p className="mig-copy">pages sit unread, databases grow without purpose. medialog exports plain markdown — bring your content and actually use it.</p>
          </div>
          <div className="mig-card">
            <p className="mig-from">from obsidian</p>
            <p className="mig-head">links aren't<br/>the same as retention.</p>
            <p className="mig-copy">obsidian builds a beautiful graph. but when did you last open a note you didn't explicitly link to? medialog adds the temporal layer.</p>
          </div>
          <div className="mig-card">
            <p className="mig-from">from logseq</p>
            <p className="mig-head">daily notes don't<br/>scale backward.</p>
            <p className="mig-copy">great for capture, hard to revisit systematically. medialog gives your daily links a topic home and a revisit schedule.</p>
          </div>
          <div className="mig-card">
            <p className="mig-from">from pocket / raindrop / onenote</p>
            <p className="mig-head">a save button<br/>isn't a reading plan.</p>
            <p className="mig-copy">you've saved thousands of links. medialog forces triage and schedules revisits so your saved links actually get read.</p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
           § 6  OPEN SOURCE  — left headline + right list
      ══════════════════════════════════════ */}
      <section className="opensource" id="opensource">
        <div className="os-left">
          <div>
            <h2 className="os-headline">built<br/>in the<br/>open.</h2>
            <p className="os-sub">your data stays yours. full source on github, plain markdown export, one-afternoon self-host. no enterprise gate, no proprietary format.</p>
          </div>
        </div>
        <div className="os-right">
          <a href="https://github.com" target="_blank" rel="noopener" className="os-row" style={{textDecoration:'none',color:'inherit'}}>
            <span className="os-name">mit license</span>
            <span className="os-desc">full source on github. fork it, self-host it, no enterprise gate.</span>
            <span className="os-link">github →</span>
          </a>
          <div className="os-row">
            <span className="os-name">plain markdown export</span>
            <span className="os-desc">yaml frontmatter per entry. obsidian-compatible. your data leaves as cleanly as it arrived.</span>
          </div>
          <div className="os-row">
            <span className="os-name">postgres under the hood</span>
            <span className="os-desc">supabase means a real db you can query directly — not a vendor blob.</span>
          </div>
          <div className="os-row">
            <span className="os-name">self-hostable</span>
            <span className="os-desc">one supabase project, one static host. deploy in an afternoon.</span>
          </div>
          <div className="os-row">
            <span className="os-name">no lock-in</span>
            <span className="os-desc">stop using medialog tomorrow, leave with everything. no proprietary format, ever.</span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
           § 7  CTA STRIP  — centered on dark
      ══════════════════════════════════════ */}
      <div className="cta-strip">
        <p className="cta-display">start logging<br/>what matters.</p>
        <p className="cta-note">free. mit licensed. export everything, anytime.</p>
        <a href="#" onClick={(e) => { e.preventDefault(); openAuth('signup') }} className="btn-cream">get started →</a>
      </div>

      {/* ══════════════════════════════════════
           § 8  FOOTER
      ══════════════════════════════════════ */}
      <footer className="footer">
        <div><div className="footer-brand">ml</div></div>
        <div>
          <p className="footer-col-title">product</p>
          <div className="footer-links">
            <a href="/app">open app</a>
            <a href="#">pricing</a>
            <a href="#">docs</a>
            <a href="#opensource">open source</a>
          </div>
        </div>
        <div>
          <p className="footer-col-title">follow</p>
          <div className="footer-links">
            <a href="https://github.com" target="_blank" rel="noopener">github</a>
            <a href="#" target="_blank" rel="noopener">twitter / x</a>
          </div>
        </div>
        <div>
          <p className="footer-col-title">legal</p>
          <div className="footer-links">
            <a href="#">mit license</a>
            <a href="#">privacy</a>
          </div>
        </div>
        <div className="footer-copy">© 2026 medialog</div>
      </footer>
    </>
  )
}

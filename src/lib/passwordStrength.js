// Password strength meter, shared by the landing page (index.html bundle) and
// the in-app SetPasswordModal (app.html bundle). Both pages had a byte-identical
// copy; keeping one source means the meter can never drift between "sign up"
// and "change your password", which would look like a bug to the user.
//
// This is a plain ES module with no React/DOM/Supabase imports precisely so it
// can be pulled into either bundle — Rollup inlines a copy per entry point.
//
// Scoring is deliberately lenient (length twice, then character classes) so the
// bar moves early and often; it's encouragement, not a policy gate. The actual
// minimum (8 chars) is enforced at submit time by the callers.
export function passwordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: 'transparent' }
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: 'weak', color: 'var(--pw-weak)' }
  if (score <= 2) return { score, label: 'fair', color: 'var(--pw-fair)' }
  if (score <= 3) return { score, label: 'good', color: 'var(--pw-good)' }
  return { score, label: 'strong', color: 'var(--pw-strong)' }
}

export default passwordStrength

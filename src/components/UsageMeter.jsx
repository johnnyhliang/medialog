import { meterState, formatResetIn, AI_WINDOW_HOURS } from '../lib/limits.js'

// Usage bar for a rolling window, modelled on Claude Code's.
//
// Two design rules it follows:
//  1. Warn BEFORE the wall. A limit you discover by hitting it is a bug report;
//     one you watched approach is a decision you made.
//  2. Always say when capacity returns. "You're out" is hostile; "you're out,
//     more in 40m" is information. This is the main reason the window is short —
//     a monthly cap can only ever answer with a date weeks away.
//
// Renders nothing when the limit is unlimited. An empty meter is noise, and AI
// limits are deliberately unset until real usage data exists.
export default function UsageMeter({
  tier, used, resetsAt, label = 'AI usage', unit = 'calls', compact = false,
}) {
  const m = meterState({ tier, used, resetsAt })
  if (m.unlimited) return null

  const resetIn = formatResetIn(m.resetsAt)
  const pctText = `${Math.round(m.pct * 100)}%`

  return (
    <div className={`usage-meter usage-meter--${m.level}${compact ? ' usage-meter--compact' : ''}`}>
      <div className="usage-meter-top">
        <span className="usage-meter-label">{label}</span>
        <span className="usage-meter-count">
          {m.used} / {m.max} {unit}
        </span>
      </div>

      <div
        className="usage-meter-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={m.max}
        aria-valuenow={m.used}
        aria-label={`${label}: ${m.used} of ${m.max} ${unit} used`}
      >
        <div className="usage-meter-fill" style={{ width: pctText }} />
      </div>

      <div className="usage-meter-bottom">
        <span>
          {m.level === 'exceeded'
            ? `Limit reached — resets ${resetIn ?? 'soon'}`
            : m.level === 'warn'
              ? `${m.remaining} left — resets ${resetIn ?? 'soon'}`
              : `Rolling ${AI_WINDOW_HOURS}h window${resetIn ? ` · resets ${resetIn}` : ''}`}
        </span>
        <span className="usage-meter-pct">{pctText}</span>
      </div>
    </div>
  )
}

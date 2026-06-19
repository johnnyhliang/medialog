import { X } from 'lucide-react'

export default function Toast({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-msg">{t.message}</span>
          {t.actions.map((a, i) => (
            <button
              key={i}
              className="toast-action-btn"
              onClick={() => { a.onClick(); onDismiss(t.id) }}
            >
              {a.label}
            </button>
          ))}
          <button className="icon-btn" onClick={() => onDismiss(t.id)} aria-label="Dismiss">
            <X size={13} />
          </button>
          {t.duration && (
            <div
              className="toast-progress"
              style={{ animationDuration: `${t.duration}ms` }}
            />
          )}
        </div>
      ))}
    </div>
  )
}
